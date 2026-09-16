import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { OrderStatus, PaymentStatus } from '@/types';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createNotification } from '@/lib/notifications';
import { pusherServer } from '@/lib/pusher-server';
import { formatVND } from '@/lib/utils';
import { releaseOrderStock } from '@/lib/inventory';
import { createGHNShipment } from '@/lib/ghn';
import { refundOrderToWallet } from '@/lib/wallet';
import {
  STATUS_NOTIFICATION_MAP,
  isOrderStatus,
  isPaymentStatus,
  validateOrderTransition,
} from '@/lib/order-transitions';

interface UpdateOrderBody {
  status?: unknown;
  paymentStatus?: unknown;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variant: true } },
        transaction: true,
        shipment: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN' && order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = (await req.json()) as UpdateOrderBody;
    const status = body.status === undefined ? undefined : body.status;
    const paymentStatus = body.paymentStatus === undefined ? undefined : body.paymentStatus;

    if (status !== undefined && !isOrderStatus(status)) {
      return NextResponse.json({ error: 'Trạng thái đơn hàng không hợp lệ' }, { status: 400 });
    }
    if (paymentStatus !== undefined && !isPaymentStatus(paymentStatus)) {
      return NextResponse.json({ error: 'Trạng thái thanh toán không hợp lệ' }, { status: 400 });
    }

    const currentOrder = await prisma.order.findUnique({
      where: { id },
      include: { chatRoom: true, items: { include: { product: true } }, shipment: true },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng' }, { status: 404 });
    }

    const nextStatus = status as OrderStatus | undefined;
    const nextPaymentStatus = paymentStatus as PaymentStatus | undefined;
    const transitionError = validateOrderTransition({
      currentStatus: currentOrder.status,
      currentPaymentStatus: currentOrder.paymentStatus,
      nextStatus,
      nextPaymentStatus,
    });
    if (transitionError) {
      return NextResponse.json({ error: transitionError }, { status: 400 });
    }

    const shouldRefundPaidOrder =
      nextStatus === 'CANCELLED' &&
      currentOrder.status !== 'CANCELLED' &&
      currentOrder.paymentStatus === 'PAID';

    const shouldReleaseStock =
      nextStatus === 'CANCELLED' &&
      currentOrder.status !== 'CANCELLED' &&
      currentOrder.paymentStatus !== 'PAID';

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: {
          ...(nextStatus && { status: nextStatus }),
          ...(nextPaymentStatus && { paymentStatus: nextPaymentStatus }),
        },
        include: { items: { include: { product: true, variant: true } } },
      });

      if (shouldRefundPaidOrder) {
        await refundOrderToWallet(tx, currentOrder.id, 'Hủy đơn hàng bởi Quản trị viên');
        await releaseOrderStock(tx, currentOrder.items);
      } else if (shouldReleaseStock) {
        await releaseOrderStock(tx, currentOrder.items);

        // Revert coupon usage if cancelled unpaid
        if (currentOrder.couponId) {
          await tx.coupon.update({
            where: { id: currentOrder.couponId },
            data: { usedCount: { decrement: 1 } },
          });

          if (currentOrder.userId) {
            await tx.couponUsage.deleteMany({
              where: {
                couponId: currentOrder.couponId,
                userId: currentOrder.userId,
                orderId: currentOrder.id,
              },
            });
          }
        }
      }

      // Tự động khởi tạo vận đơn GHN khi đơn hàng chuyển sang PROCESSING
      if (nextStatus === 'PROCESSING' && !currentOrder.shipment) {
        const shipmentResult = await createGHNShipment({
          orderId: currentOrder.id,
          orderCode: currentOrder.orderCode,
          customerName: currentOrder.customerName,
          customerPhone: currentOrder.customerPhone,
          customerAddress: currentOrder.customerAddress,
          toDistrictId: 1442,
          toWardCode: '20101',
          items: currentOrder.items.map((i) => ({
            name: i.product?.name || 'Sản phẩm',
            quantity: i.quantity,
            price: i.price,
          })),
          codAmount: currentOrder.paymentStatus === 'PAID' ? 0 : currentOrder.totalAmount,
        });

        await tx.shipment.create({
          data: {
            orderId: currentOrder.id,
            carrier: shipmentResult.carrier,
            trackingCode: shipmentResult.trackingCode,
            shippingFee: shipmentResult.shippingFee,
            codAmount: currentOrder.paymentStatus === 'PAID' ? 0 : currentOrder.totalAmount,
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
      }

      return order;
    });

    if (currentOrder.userId) {
      if (nextPaymentStatus === 'PAID' && currentOrder.paymentStatus !== 'PAID') {
        await createNotification({
          userId: currentOrder.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Thanh toán đã được xác nhận',
          message: `Đơn hàng ${currentOrder.orderCode} (${formatVND(currentOrder.totalAmount)}) đã được xác nhận thanh toán.`,
          data: { orderId: currentOrder.id, orderCode: currentOrder.orderCode },
        });

        await pusherServer.trigger(
          `private-user-${currentOrder.userId}`,
          'payment-success',
          { orderId: currentOrder.orderCode, amount: currentOrder.totalAmount }
        );
      }

      if (nextStatus && nextStatus !== currentOrder.status) {
        if (shouldRefundPaidOrder) {
          await pusherServer.trigger(`private-user-${currentOrder.userId}`, 'wallet-updated', {});
          await createNotification({
            userId: currentOrder.userId,
            type: 'PAYMENT_RECEIVED',
            title: 'Đơn hàng đã hủy & hoàn tiền',
            message: `Đơn hàng ${currentOrder.orderCode} đã bị hủy và được hoàn ${formatVND(currentOrder.totalAmount)} vào Ví Shop.`,
            data: { orderId: currentOrder.id, refundedAmount: currentOrder.totalAmount },
          });
        } else {
          const notif = STATUS_NOTIFICATION_MAP[nextStatus];
          if (notif) {
            await createNotification({
              userId: currentOrder.userId,
              type: notif.type,
              title: notif.title,
              message: notif.message(currentOrder.orderCode),
              data: { orderId: currentOrder.id, orderCode: currentOrder.orderCode },
            });
          }
        }
      }
    }

    if (currentOrder.chatRoom) {
      let sysMsg = '';
      if (nextPaymentStatus === 'PAID' && currentOrder.paymentStatus !== 'PAID') {
        sysMsg = `Đơn hàng ${currentOrder.orderCode} đã được xác nhận thanh toán thành công.`;
      } else if (nextStatus && nextStatus !== currentOrder.status) {
        sysMsg = `Trạng thái đơn hàng cập nhật: ${nextStatus}`;
      }

      if (sysMsg) {
        await prisma.message.create({
          data: {
            roomId: currentOrder.chatRoom.id,
            senderId: session.user.id,
            content: sysMsg,
            type: 'SYSTEM',
          },
        });

        await pusherServer.trigger(`private-chat-${currentOrder.chatRoom.id}`, 'new-message', {
          content: sysMsg,
          type: 'SYSTEM',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật đơn hàng' }, { status: 500 });
  }
}
