import { NextResponse } from 'next/server';
import { prisma } from '@server/database/prisma';
import { mapGHNStatusToShipmentStatus, verifyGHNWebhookAuth } from '@server/modules/shipping/ghn.service';
import { releaseOrderStock } from '@server/modules/inventory/inventory.service';
import { refundOrderToWallet } from '@server/modules/wallet/wallet.service';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { pusherServer } from '@server/infrastructure/pusher';
import type { Prisma } from '@prisma/client';

interface GHNWebhookPayload {
  OrderCode?: unknown;
  ClientOrderCode?: unknown;
  Status?: unknown;
  TotalFee?: unknown;
  CODAmount?: unknown;
  Description?: unknown;
  Time?: unknown;
}

export async function POST(req: Request) {
  try {
    // SEC-01: GHN Webhook Authentication
    const authResult = verifyGHNWebhookAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    const body = (await req.json()) as GHNWebhookPayload;

    const ghnOrderCode =
      typeof body.OrderCode === 'string'
        ? body.OrderCode.trim()
        : '';
    const clientOrderCode =
      typeof body.ClientOrderCode === 'string'
        ? body.ClientOrderCode.trim()
        : '';
    const rawStatus =
      typeof body.Status === 'string'
        ? body.Status.trim()
        : '';

    if (!rawStatus || (!ghnOrderCode && !clientOrderCode)) {
      return NextResponse.json({ error: 'Payload thiếu mã đơn hoặc trạng thái' }, { status: 400 });
    }

    // Tìm kiếm Shipment theo trackingCode (GHN OrderCode) hoặc orderCode
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          ...(ghnOrderCode ? [{ trackingCode: ghnOrderCode }] : []),
          ...(clientOrderCode ? [{ order: { orderCode: clientOrderCode } }] : []),
        ],
      },
      include: {
        order: {
          include: { items: true },
        },
      },
    });

    if (!shipment) {
      console.warn(`[GHN Webhook] Không tìm thấy Shipment cho GHNCode=${ghnOrderCode}, ClientCode=${clientOrderCode}`);
      return NextResponse.json({ success: true, message: 'Đơn hàng không thuộc hệ thống hoặc chưa kích hoạt vận đơn' });
    }

    const mapping = mapGHNStatusToShipmentStatus(rawStatus);
    const changed = await prisma.$transaction(async (tx) => {
      const fresh = await tx.shipment.findUniqueOrThrow({ where: { id: shipment.id }, include: { order: { include: { items: true } } } });
      const terminal = ['DELIVERED', 'RETURNED', 'CANCELLED'];
      if (fresh.status === mapping.shipmentStatus ||
          (terminal.includes(fresh.status) && !(fresh.status === 'DELIVERED' && mapping.shipmentStatus === 'RETURNED'))) return false;
      const rank: Record<string, number> = { READY_TO_PICK: 0, PICKING: 1, DELIVERING: 2, DELIVERED: 3, RETURNED: 3, CANCELLED: 3 };
      if ((rank[mapping.shipmentStatus] ?? 0) < (rank[fresh.status] ?? 0)) return false;
      if (fresh.order.status === 'CANCELLED') return false;
      const logs = Array.isArray(fresh.shippingLogs) ? fresh.shippingLogs as Prisma.JsonArray : [];
      const updated = await tx.shipment.updateMany({
        where: { id: fresh.id, status: fresh.status },
        data: { status: mapping.shipmentStatus, shippingLogs: [...logs, {
          status: mapping.shipmentStatus, rawGhnStatus: rawStatus,
          description: typeof body.Description === 'string' ? body.Description : mapping.description,
          timestamp: new Date().toISOString(),
        }] },
      });
      if (updated.count !== 1) return false;
      if (mapping.shipmentStatus === 'DELIVERED') {
        await tx.order.updateMany({ where: { id: fresh.orderId, status: { notIn: ['CANCELLED', 'COMPLETED'] } }, data: { status: 'COMPLETED' } });
      } else if (mapping.shipmentStatus === 'CANCELLED' || mapping.shipmentStatus === 'RETURNED') {
        if (fresh.order.paymentStatus === 'PAID') {
          const refund = await refundOrderToWallet(tx, fresh.orderId, `GHN báo ${mapping.shipmentStatus}`);
          if (!refund.success) throw new Error(refund.error || 'Không thể hoàn tiền');
        } else {
          const cancelled = await tx.order.updateMany({ where: { id: fresh.orderId, status: { not: 'CANCELLED' }, paymentStatus: fresh.order.paymentStatus }, data: { status: 'CANCELLED' } });
          if (cancelled.count !== 1) throw new Error('Trạng thái thanh toán đã đổi; cần xử lý lại webhook');
          if (cancelled.count === 1) {
            await releaseOrderStock(tx, fresh.order.items);
            if (fresh.order.couponId) {
              await tx.coupon.update({ where: { id: fresh.order.couponId }, data: { usedCount: { decrement: 1 } } });
              if (fresh.order.userId) await tx.couponUsage.deleteMany({ where: { couponId: fresh.order.couponId, orderId: fresh.orderId, userId: fresh.order.userId } });
            }
          }
        }
      } else if (mapping.orderStatus) {
        await tx.order.updateMany({ where: { id: fresh.orderId, status: { notIn: ['CANCELLED', 'COMPLETED'] } }, data: { status: mapping.orderStatus } });
      }
      return true;
    });
    if (!changed) return NextResponse.json({ success: true, duplicate: true });

    // Bắn thông báo và realtime Pusher
    if (shipment.order.userId) {
      if (mapping.orderStatus === 'COMPLETED') {
        await createNotification({
          userId: shipment.order.userId,
          type: 'ORDER_COMPLETED',
          title: 'Giao hàng thành công',
          message: `Đơn hàng ${shipment.order.orderCode} đã được giao thành công. Cảm ơn bạn đã mua sắm!`,
          data: { orderId: shipment.orderId, trackingCode: shipment.trackingCode },
        });

        await pusherServer.trigger(`private-user-${shipment.order.userId}`, 'order-status-changed', {
          orderId: shipment.orderId,
          orderCode: shipment.order.orderCode,
          status: 'COMPLETED',
        });
      } else if (mapping.orderStatus === 'SHIPPING') {
        await createNotification({
          userId: shipment.order.userId,
          type: 'ORDER_SHIPPING',
          title: 'Đơn hàng đang giao',
          message: `Đơn hàng ${shipment.order.orderCode} đang được GHN vận chuyển tới bạn (Mã vận đơn: ${shipment.trackingCode}).`,
          data: { orderId: shipment.orderId, trackingCode: shipment.trackingCode },
        });

        await pusherServer.trigger(`private-user-${shipment.order.userId}`, 'order-status-changed', {
          orderId: shipment.orderId,
          orderCode: shipment.order.orderCode,
          status: 'SHIPPING',
        });
      }
    }

    return NextResponse.json({
      success: true,
      shipmentStatus: mapping.shipmentStatus,
      orderStatus: mapping.orderStatus,
    });
  } catch (error) {
    console.error('GHN webhook error:', error);
    return NextResponse.json({ error: 'Lỗi xử lý webhook GHN' }, { status: 500 });
  }
}
