import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { validateReconcileInput, canReconcileOrder } from './reconciliation.service.ts';
import { reserveOrderStock } from '@server/modules/inventory/inventory.service';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { pusherServer } from '@server/infrastructure/pusher';
import { invalidateAnalyticsCache } from '@server/infrastructure/redis';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateReconcileInput(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error || 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const { orderId, orderCode, amount, bankTransId, bankName, senderAccount, note } = validation.data;

    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        ...(orderId ? { id: orderId } : {}),
        ...(orderCode ? { orderCode: { equals: orderCode, mode: 'insensitive' } } : {}),
      },
      include: { items: true, chatRoom: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Không tìm thấy đơn hàng tương ứng' }, { status: 404 });
    }

    const check = canReconcileOrder(order, amount);
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. Chống bán âm kho: Nếu đơn đã hủy trước đó (tồn kho đã được nhả về kho),
      // bắt buộc phải giữ lại hàng thành công mới được phục hồi sang CONFIRMED.
      if (order.status === 'CANCELLED' && order.items && order.items.length > 0) {
        const failedStockId = await reserveOrderStock(tx, order.items);
        if (failedStockId) {
          throw new Error(
            `Không thể phục hồi đơn hàng đã hủy: Sản phẩm/Biến thể (ID: ${failedStockId}) hiện tại không đủ tồn kho.`
          );
        }
      }

      // 1. Update order status
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status: order.status === 'PENDING' || order.status === 'CANCELLED' ? 'CONFIRMED' : order.status,
        },
      });

      // 2. Upsert transaction record
      const transaction = await tx.transaction.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          bankTransId,
          amount,
          description: note ? `[Đối soát thủ công] ${note}` : `[Đối soát thủ công] Khớp đơn ${order.orderCode}`,
          bankName,
          senderAccount: senderAccount || null,
          receivedAt: new Date(),
          verified: true,
          rawWebhookData: {
            manualReconcile: true,
            reconciledBy: session.user.email,
            reconciledAt: new Date().toISOString(),
            note,
          },
        },
        update: {
          bankTransId,
          amount,
          bankName,
          senderAccount: senderAccount || null,
          verified: true,
          description: note ? `[Đối soát thủ công] ${note}` : `[Đối soát thủ công] Khớp đơn ${order.orderCode}`,
          rawWebhookData: {
            manualReconcile: true,
            reconciledBy: session.user.email,
            reconciledAt: new Date().toISOString(),
            note,
          },
        },
      });

      return { updatedOrder, transaction };
    });

    // 3. Trigger notification to customer if registered
    if (order.userId) {
      await createNotification({
        userId: order.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Thanh toán đã được đối soát xác nhận',
        message: `Đơn hàng ${order.orderCode} (${amount.toLocaleString('vi-VN')}đ) đã được xác nhận thanh toán thành công qua đối soát ngân hàng.`,
        data: { orderId: order.id, orderCode: order.orderCode },
      });

      try {
        await pusherServer.trigger(
          `private-user-${order.userId}`,
          'payment-success',
          { orderId: order.orderCode, amount }
        );
      } catch (pusherErr) {
        console.error('Pusher trigger error in manual reconcile:', pusherErr);
      }
    }

    try {
      await invalidateAnalyticsCache();
      await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
        type: 'MANUAL_RECONCILE',
        timestamp: Date.now(),
      });
    } catch (pusherErr) {
      console.error('[Reconcile] Pusher admin trigger error:', pusherErr);
    }

    return NextResponse.json({
      success: true,
      order: result.updatedOrder,
      transaction: result.transaction,
      warning: check.warning,
    });
  } catch (error: unknown) {
    console.error('Manual reconciliation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Lỗi thực hiện đối soát';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
