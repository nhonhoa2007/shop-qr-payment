import { NextResponse } from 'next/server';
import { prisma } from '@server/database/prisma';
import { verifyPayOSWebhookSignature, PAYOS_CHECKSUM_KEY, type PayOSWebhookPayload } from '@server/modules/payment/payos.service';
import { parseOrderCodeFromDescription, parseTopupCodeFromDescription } from '@server/modules/payment/vietqr-parser.service';
import { getWalletTopupSession, processWalletTopup } from '@server/modules/wallet/wallet-topup.service';
import { pusherServer } from '@server/infrastructure/pusher';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { invalidateAnalyticsCache } from '@server/infrastructure/redis';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PayOSWebhookPayload;

    if (!body || !body.data || typeof body.data !== 'object') {
      return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 });
    }

    const checksumKey = PAYOS_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM_KEY;

    // 1. Xác thực Chữ ký số HMAC-SHA256 (Fail-Closed)
    if (!checksumKey) {
      console.error('[PayOS Webhook] PAYOS_CHECKSUM_KEY chưa được cấu hình');
      return NextResponse.json(
        { error: 'Cổng thanh toán chưa cấu hình chữ ký bảo mật' },
        { status: 500 }
      );
    }

    if (
      !body.signature ||
      !verifyPayOSWebhookSignature(
        body.data as Record<string, unknown>,
        body.signature,
        checksumKey
      )
    ) {
      console.warn('[PayOS Webhook] Chữ ký không hợp lệ từ IP client');
      return NextResponse.json({ error: 'Chữ ký số không hợp lệ' }, { status: 400 });
    }

    if (body.code !== '00') {
      return NextResponse.json({ success: true, message: `Bỏ qua trạng thái không thành công: ${body.desc}` });
    }

    const { amount, description, reference, paymentLinkId } = body.data;

    // 2. Nhận diện và Xử lý Giao dịch Nạp tiền Ví điện tử (TOPUP Engine)
    const parsedTopupCode = parseTopupCodeFromDescription(description || '');
    const parsedOrderCode = parseOrderCodeFromDescription(description || '');
    let topupSession = parsedTopupCode
      ? await getWalletTopupSession(parsedTopupCode)
      : null;

    // Fallback tìm kiếm qua orderCode CHỈ KHI description không chứa mã đơn hàng DH...
    if (!topupSession && !parsedOrderCode && body.data.orderCode) {
      topupSession = await getWalletTopupSession(body.data.orderCode);
    }

    if (parsedTopupCode || topupSession) {
      if (!topupSession) {
        console.warn(`[PayOS Webhook] Không tìm thấy phiên nạp tiền cho code="${parsedTopupCode || body.data.orderCode}"`);
        return NextResponse.json({
          success: true,
          message: 'Không tìm thấy thông tin phiên nạp ví hoặc phiên đã hết hạn',
        });
      }

      if (topupSession.status === 'COMPLETED') {
        return NextResponse.json({
          success: true,
          message: 'Giao dịch nạp tiền ví đã được xử lý thành công trước đó (Idempotent)',
          topupCode: topupSession.topupCode,
        });
      }

      if (amount < topupSession.amount) {
        console.warn(`[PayOS Webhook] Số tiền nạp (${amount}) nhỏ hơn yêu cầu (${topupSession.amount})`);
        return NextResponse.json({
          success: true,
          message: 'Số tiền nạp không đủ so với yêu cầu phiên nạp ví',
        });
      }

      const bankTransId = reference || paymentLinkId || `PAYOS_TOPUP_${Date.now()}`;

      const topupResult = await prisma.$transaction(async (tx) => {
        return await processWalletTopup(tx, {
          topupCode: topupSession.topupCode,
          amount,
          userId: topupSession.userId,
          bankTransId,
          description: description || `Nạp ví qua VietQR PayOS ${topupSession.topupCode}`,
        });
      });

      if (!topupResult.success) {
        return NextResponse.json(
          { error: topupResult.error || 'Lỗi hạch toán nạp tiền ví' },
          { status: 500 }
        );
      }

      // Realtime Pusher cho User
      await pusherServer.trigger(`private-user-${topupSession.userId}`, 'wallet-updated', {
        balance: topupResult.newBalance,
        topupAmount: amount,
        topupCode: topupSession.topupCode,
      });

      await pusherServer.trigger(`private-user-${topupSession.userId}`, 'payment-success', {
        topupCode: topupSession.topupCode,
        amount,
        type: 'TOPUP',
      });

      // Tạo thông báo trong ứng dụng
      await createNotification({
        userId: topupSession.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Nạp tiền ví thành công',
        message: `Bạn đã nạp thành công ${amount.toLocaleString('vi-VN')}đ vào Ví Shop qua VietQR PayOS (Mã GD: ${topupSession.topupCode}).`,
        data: {
          topupCode: topupSession.topupCode,
          amount,
          balance: topupResult.newBalance,
        },
      });

      // Realtime Analytics cho Admin
      try {
        await invalidateAnalyticsCache();
        await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
          type: 'WALLET_TOPUP',
          timestamp: Date.now(),
        });
      } catch (pusherErr) {
        console.error('[PayOS Webhook] Pusher admin trigger error:', pusherErr);
      }

      return NextResponse.json({
        success: true,
        type: 'TOPUP',
        topupCode: topupSession.topupCode,
        newBalance: topupResult.newBalance,
        message: 'Ghi nhận giao dịch nạp tiền ví thành công',
      });
    }

    // 3. Định danh đơn hàng qua Description hoặc OrderCode
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

    try {
      await invalidateAnalyticsCache();
      await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
        type: 'PAYOS_PAYMENT',
        timestamp: Date.now(),
      });
    } catch (pusherErr) {
      console.error('[PayOS Webhook] Pusher admin trigger error:', pusherErr);
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
