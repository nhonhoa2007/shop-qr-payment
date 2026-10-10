import { prisma } from '@server/database/prisma';
import { createGHNShipment } from '@server/modules/shipping/ghn.service';
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
export async function approveAndFulfillOrder(orderId: string): Promise<ApproveAndFulfillResult> {
  const order = await prisma.order.findUnique({
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
      shippingFee: order.shipment.shippingFee,
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

  // 3. Cập nhật trạng thái đơn sang PROCESSING nếu đang ở CONFIRMED hoặc PENDING
  if (order.status !== 'PROCESSING') {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PROCESSING' },
    });
  }

  // 4. Khởi tạo vận đơn GHN
  try {
    const toDistrictId = Number(process.env.DEFAULT_TO_DISTRICT_ID) || 1442;
    const toWardCode = process.env.DEFAULT_TO_WARD_CODE || '20101';
    const shipmentResult = await createGHNShipment({
      orderId: order.id,
      orderCode: order.orderCode,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      toDistrictId,
      toWardCode,
      items: order.items.map((i) => ({
        name: i.product?.name || 'Sản phẩm',
        quantity: i.quantity,
        price: i.price,
      })),
      codAmount: order.paymentStatus === 'PAID' ? 0 : order.totalAmount,
    });

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: shipmentResult.carrier,
        trackingCode: shipmentResult.trackingCode,
        shippingFee: shipmentResult.shippingFee,
        codAmount: order.paymentStatus === 'PAID' ? 0 : order.totalAmount,
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
      shippingFee: shipment.shippingFee,
      carrier: shipment.carrier,
      expectedDeliveryTime: shipment.estimatedArrival,
      isAlreadyProcessed: false,
    };
  } catch (err) {
    console.error('[Fulfillment] Error creating GHN shipment:', err);
    return {
      success: false,
      orderId: order.id,
      orderCode: order.orderCode,
      error: err instanceof Error ? err.message : 'Lỗi khởi tạo vận đơn GHN',
    };
  }
}
