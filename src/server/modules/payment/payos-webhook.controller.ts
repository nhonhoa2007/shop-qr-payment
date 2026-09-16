import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPayOSWebhookSignature, PAYOS_CHECKSUM_KEY, type PayOSWebhookPayload } from '@/lib/payos';
import { parseOrderCodeFromDescription } from '@/lib/payment-parser';
import { pusherServer } from '@/lib/pusher-server';
import { createNotification } from '@/lib/notifications';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PayOSWebhookPayload;

    if (!body || !body.data || typeof body.data !== 'object') {
      return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 });
    }

    // 1. Xác thực Chữ ký số HMAC-SHA256 (nếu môi trường có cấu hình PAYOS_CHECKSUM_KEY)
    if (PAYOS_CHECKSUM_KEY) {
      const isValid = verifyPayOSWebhookSignature(
        body.data as Record<string, unknown>,
        body.signature,
        PAYOS_CHECKSUM_KEY
      );

      if (!isValid) {
        console.warn('[PayOS Webhook] Chữ ký không hợp lệ từ IP client');
        return NextResponse.json({ error: 'Chữ ký số không hợp lệ' }, { status: 400 });
      }
    }

    if (body.code !== '00') {
      return NextResponse.json({ success: true, message: `Bỏ qua trạng thái không thành công: ${body.desc}` });
    }

    const { amount, description, reference, paymentLinkId } = body.data;

    // 2. Định danh đơn hàng qua Description hoặc OrderCode
    let parsedCode = parseOrderCodeFromDescription(description || '');
    let order = null;

    if (parsedCode) {
      order = await prisma.order.findUnique({
        where: { orderCode: parsedCode },
      });
    }

    // Fallback tìm kiếm qua OrderCode số nếu không tìm thấy bằng regex DH...
    if (!order && body.data.orderCode) {
      const allPending = await prisma.order.findMany({
        where: { paymentStatus: 'UNPAID' },
        select: { id: true, orderCode: true, totalAmount: true, userId: true, paymentStatus: true, status: true },
      });

      const matched = allPending.find((o) => o.orderCode.endsWith(String(body.data.orderCode)));
      if (matched) {
        order = matched;
        parsedCode = matched.orderCode;
      }
    }

    if (!order) {
      console.warn(`[PayOS Webhook] Không tìm thấy đơn hàng cho desc="${description}"`);
      return NextResponse.json({ success: true, message: 'Đơn hàng không thuộc hệ thống hoặc đã thanh lý' });
    }

    // 3. Xử lý Idempotency & Guards - Bỏ qua nếu đơn đã thanh toán, đã hủy, hết hạn hoặc chuyển thiếu tiền
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true, message: 'Đơn hàng đã được xác nhận thanh toán trước đó' });
    }

    if (order.status === 'CANCELLED') {
      console.warn(`[PayOS Webhook] Bỏ qua đơn hàng đã bị hủy: ${order.orderCode}`);
      return NextResponse.json({ success: true, message: 'Đơn hàng đã bị hủy, không thể tiếp nhận thanh toán' });
    }

    if (order.paymentStatus === 'EXPIRED') {
      console.warn(`[PayOS Webhook] Bỏ qua đơn hàng đã quá hạn thanh toán: ${order.orderCode}`);
      return NextResponse.json({ success: true, message: 'Đơn hàng đã quá thời hạn thanh toán' });
    }

    if (amount < order.totalAmount) {
      console.warn(`[PayOS Webhook] Số tiền thanh toán (${amount}) nhỏ hơn giá trị đơn hàng (${order.totalAmount})`);
      return NextResponse.json({ success: true, message: 'Số tiền thanh toán không khớp với giá trị đơn hàng' });
    }

    const bankTransId = reference || paymentLinkId || `PAYOS_${Date.now()}`;

    // 4. Kích hoạt cập nhật trạng thái trong Transaction nguyên tử
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
        },
      });

      await tx.transaction.upsert({
        where: { orderId: order.id },
        update: {
          amount,
          bankName: 'PAYOS',
          bankTransId,
          description: description || 'Thanh toán qua PayOS',
          verified: true,
          receivedAt: new Date(),
          rawWebhookData: body as unknown as object,
        },
        create: {
          orderId: order.id,
          amount,
          bankName: 'PAYOS',
          bankTransId,
          description: description || 'Thanh toán qua PayOS',
          verified: true,
          receivedAt: new Date(),
          rawWebhookData: body as unknown as object,
        },
      });
    });

    // 5. Bắn thông báo và Realtime Pusher
    if (order.userId) {
      await pusherServer.trigger(`private-user-${order.userId}`, 'payment-success', {
        orderId: order.id,
        orderCode: order.orderCode,
        amount,
      });

      await createNotification({
        userId: order.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Thanh toán thành công',
        message: `Đơn hàng ${order.orderCode} đã được thanh toán thành công qua PayOS (${amount.toLocaleString('vi-VN')}đ).`,
        data: { orderId: order.id, orderCode: order.orderCode, amount },
      });
    }

    return NextResponse.json({
      success: true,
      orderCode: order.orderCode,
      paymentStatus: 'PAID',
    });
  } catch (error) {
    console.error('PayOS webhook processing error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ xử lý webhook PayOS' }, { status: 500 });
  }
}
