import { prisma } from '@server/database/prisma';
import { createGHNShipment, GHNShipmentError } from '@server/modules/shipping/ghn.service';
import { pusherServer } from '@server/infrastructure/pusher';
import { createNotification } from '@server/modules/notifications/notifications.service';

export interface ApproveAndFulfillResult {
  success: boolean;
  orderId: string;
  orderCode: string;
  trackingCode?: string;
  shippingFee?: number;
  carrier?: string;
  expectedDeliveryTime?: Date | null;
  error?: string;
  isAlreadyProcessed?: boolean;
}

/**
 * Duyệt đơn hàng và tự động tạo vận đơn GHN (Fulfillment Engine)
 * Đảm bảo tính Idempotent: gọi nhiều lần cho cùng một đơn chỉ sinh 1 vận đơn duy nhất
 */
export async function approveAndFulfillOrder(orderId: string, db: typeof prisma = prisma): Promise<ApproveAndFulfillResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      shipment: true,
      items: { include: { product: true } },
    },
  });

  if (!order) {
    return {
      success: false,
      orderId,
      orderCode: '',
      error: 'Đơn hàng không tồn tại',
    };
  }

  // 1. Kiểm tra đơn hàng đã có vận đơn chưa (Idempotency Guard)
  if (order.shipment) {
    return {
      success: true,
      orderId: order.id,
      orderCode: order.orderCode,
      trackingCode: order.shipment.trackingCode,
      shippingFee: Number(order.shipment.shippingFee),
      carrier: order.shipment.carrier,
      expectedDeliveryTime: order.shipment.estimatedArrival,
      isAlreadyProcessed: true,
    };
  }

  // 2. Kiểm tra ràng buộc thanh toán & trạng thái
  if (order.status === 'CANCELLED') {
    return {
      success: false,
      orderId: order.id,
      orderCode: order.orderCode,
      error: 'Không thể duyệt đơn hàng đã hủy',
    };
  }

  if (order.paymentStatus !== 'PAID') {
    return {
      success: false,
      orderId: order.id,
      orderCode: order.orderCode,
      error: 'Đơn hàng chưa được thanh toán',
    };
  }

  if (!order.toDistrictId || !order.toWardCode) {
    return { success: false, orderId, orderCode: order.orderCode, error: 'Đơn hàng thiếu địa bàn nhận hàng GHN' };
  }

  // Đơn hàng giá trị cao (> 5.000.000đ) vượt hạn mức bảo hiểm mặc định GHN -> Chuyển sang REVIEW trực tiếp
  if (BigInt(order.totalAmount) > 5_000_000n) {
    await db.order.updateMany({
      where: { id: order.id, fulfillmentState: 'NONE' },
      data: { fulfillmentState: 'REVIEW' },
    });
    return {
      success: false,
      orderId: order.id,
      orderCode: order.orderCode,
      error: 'Đơn hàng giá trị cao (>5.000.000đ) vượt hạn mức bảo hiểm tự động của GHN; đã chuyển sang kiểm tra thủ công.',
    };
  }

  const claimed = await db.order.updateMany({
    where: { id: order.id, fulfillmentState: 'NONE', paymentStatus: 'PAID', status: { in: ['CONFIRMED', 'PROCESSING'] } },
    data: { fulfillmentState: 'REQUESTING' },
  });
  if (claimed.count !== 1) {
    return { success: false, orderId, orderCode: order.orderCode, error: 'Vận đơn đang xử lý hoặc cần kiểm tra trên GHN trước khi gửi lại' };
  }

  // 4. Khởi tạo vận đơn GHN
  try {
    const packing = order.packingSnapshot as {
      totalWeightGrams?: number;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
    } | null;

    const shipmentResult = await createGHNShipment({
      orderId: order.id,
      orderCode: order.orderCode,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      toDistrictId: order.toDistrictId,
      toWardCode: order.toWardCode,
      weight: packing?.totalWeightGrams,
      length: packing?.lengthCm,
      width: packing?.widthCm,
      height: packing?.heightCm,
      items: order.items.map((i) => ({
        name: i.product?.name || 'Sản phẩm',
        quantity: i.quantity,
        price: Number(i.price),
      })),
      codAmount: order.paymentStatus === 'PAID' ? 0 : Number(order.totalAmount),
    });

    const shipment = await db.shipment.create({
      data: {
        orderId: order.id,
        carrier: shipmentResult.carrier,
        trackingCode: shipmentResult.trackingCode,
        shippingFee: BigInt(shipmentResult.shippingFee),
        codAmount: order.paymentStatus === 'PAID' ? 0n : BigInt(order.totalAmount),
        weightGrams: packing?.totalWeightGrams ?? null,
        status: 'READY_TO_PICK',
        estimatedArrival: shipmentResult.expectedDeliveryTime,
        shippingLogs: [
          {
            status: 'READY_TO_PICK',
            description: 'Đã tạo vận đơn tự động qua GHN OpenAPI v2',
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });
    await db.order.update({ where: { id: order.id }, data: { status: 'PROCESSING', fulfillmentState: 'CREATED' } });

    // 5. Gửi thông báo và kích hoạt realtime event
    if (order.userId) {
      try {
        await createNotification({
          userId: order.userId,
          type: 'ORDER_CONFIRMED',
          title: 'Đơn hàng đang chuẩn bị',
          message: `Shop đã tiếp nhận đơn ${order.orderCode} và đang chuẩn bị hàng đóng gói.`,
          data: {
            orderId: order.id,
            orderCode: order.orderCode,
            trackingCode: shipment.trackingCode,
          },
        });

        await pusherServer.trigger(`private-user-${order.userId}`, 'order-status-updated', {
          orderId: order.id,
          orderCode: order.orderCode,
          status: 'PROCESSING',
          trackingCode: shipment.trackingCode,
        });
      } catch (notifyErr) {
        console.error('[Fulfillment] User notification error:', notifyErr);
      }
    }

    try {
      await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
        type: 'ORDER_PROCESSING',
        timestamp: Date.now(),
      });
    } catch (adminErr) {
      console.error('[Fulfillment] Admin Pusher error:', adminErr);
    }

    return {
      success: true,
      orderId: order.id,
      orderCode: order.orderCode,
      trackingCode: shipment.trackingCode,
      shippingFee: Number(shipment.shippingFee),
      carrier: shipment.carrier,
      expectedDeliveryTime: shipment.estimatedArrival,
      isAlreadyProcessed: false,
    };
  } catch (err) {
    await db.order.update({
      where: { id: order.id },
      data: { fulfillmentState: err instanceof GHNShipmentError && !err.mayHaveCreated ? 'NONE' : 'REVIEW' },
    });
    console.error('[Fulfillment] Error creating GHN shipment:', err);
    return {
      success: false,
      orderId: order.id,
      orderCode: order.orderCode,
      error: err instanceof Error ? err.message : 'Lỗi khởi tạo vận đơn GHN',
    };
  }
}
