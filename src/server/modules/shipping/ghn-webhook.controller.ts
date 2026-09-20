import { NextResponse } from 'next/server';
import { prisma } from '@server/database/prisma';
import { mapGHNStatusToShipmentStatus, verifyGHNWebhookAuth } from '@server/modules/shipping/ghn.service';
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
        order: true,
      },
    });

    if (!shipment) {
      console.warn(`[GHN Webhook] Không tìm thấy Shipment cho GHNCode=${ghnOrderCode}, ClientCode=${clientOrderCode}`);
      return NextResponse.json({ success: true, message: 'Đơn hàng không thuộc hệ thống hoặc chưa kích hoạt vận đơn' });
    }

    const mapping = mapGHNStatusToShipmentStatus(rawStatus);
    const existingLogs = Array.isArray(shipment.shippingLogs)
      ? (shipment.shippingLogs as Prisma.JsonArray)
      : [];

    const newLogEntry: Prisma.JsonObject = {
      status: mapping.shipmentStatus,
      rawGhnStatus: rawStatus,
      description: typeof body.Description === 'string' ? body.Description : mapping.description,
      timestamp: new Date().toISOString(),
    };

    const updatedLogs = [...existingLogs, newLogEntry];

    // Cập nhật Shipment & Trạng thái Đơn hàng trong Transaction
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: mapping.shipmentStatus,
          shippingLogs: updatedLogs,
        },
      });

      // Nếu đơn hàng chuyển sang SHIPPING hoặc COMPLETED
      if (mapping.orderStatus && shipment.order.status !== 'COMPLETED' && shipment.order.status !== 'CANCELLED') {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: {
            status: mapping.orderStatus,
          },
        });
      }
    });

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
