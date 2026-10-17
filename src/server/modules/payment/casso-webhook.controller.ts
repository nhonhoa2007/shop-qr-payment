import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@server/database/prisma';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { pusherServer } from '@server/infrastructure/pusher';
import { invalidateAnalyticsCache } from '@server/infrastructure/redis';
import { BUSINESS_MAX_VND } from '@shared/utils/money';
import {
  type BankTransactionPayload,
  getTransactionId,
  parseOrderCodeFromDescription,
  parseTopupCodeFromDescription,
  evaluateWebhookDecision,
} from '@server/modules/payment/vietqr-parser.service';
import { processWalletTopup, getWalletTopupSession } from '@server/modules/wallet/wallet-topup.service';
import { formatPaidOrderMessage, sendTelegramMessage } from '@server/infrastructure/telegram';

interface CassoWebhookBody {
  data?: BankTransactionPayload[];
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('secure-token');
    const expectedSecret = process.env.CASSO_WEBHOOK_SECRET;
    if (!expectedSecret || !signature || !safeCompare(signature, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CassoWebhookBody;
    const transactions = Array.isArray(body.data) ? body.data : [];

    for (const txn of transactions) {
      const transactionId = getTransactionId(txn);
      const topupCode = parseTopupCodeFromDescription(txn.description);
      const matchedCode = parseOrderCodeFromDescription(txn.description);
      let parsedBigInt: bigint | null = null;
      try {
        if (typeof txn.amount === 'bigint') {
          parsedBigInt = txn.amount;
        } else if (typeof txn.amount === 'number' && Number.isFinite(txn.amount)) {
          parsedBigInt = BigInt(Math.round(txn.amount));
        } else if (typeof txn.amount === 'string' && /^-?\d+$/.test(txn.amount.trim())) {
          parsedBigInt = BigInt(txn.amount.trim());
        }
      } catch {
        parsedBigInt = null;
      }
      const storedAmount = parsedBigInt != null ? parsedBigInt : 0n;
      const validIncomingAmount = parsedBigInt != null && parsedBigInt > 0n && parsedBigInt <= BUSINESS_MAX_VND;
      const amount = Number(storedAmount);
      const order = matchedCode ? await prisma.order.findFirst({
        where: { orderCode: { equals: matchedCode, mode: 'insensitive' } },
        include: { chatRoom: true },
      }) : null;
      const fingerprint = crypto.createHash('sha256').update(transactionId
        ? `casso:${transactionId}`
        : JSON.stringify({ amount: txn.amount, description: txn.description, when: txn.when, bankSubAccId: txn.bankSubAccId })).digest('hex');
      let ledger;
      try {
        ledger = await prisma.bankTransfer.create({ data: {
          fingerprint, bankTransId: transactionId, amount: storedAmount,
          description: txn.description || '', bankName: txn.bankSubAccId || null,
          receivedAt: txn.when && !Number.isNaN(Date.parse(txn.when)) ? new Date(txn.when) : null,
          rawWebhookData: txn as unknown as Prisma.InputJsonValue,
          orderId: order?.id || null, topupCode,
          reviewReason: !transactionId ? 'Thiếu mã giao dịch ngân hàng' : !validIncomingAmount ? 'Số tiền không hợp lệ, vượt giới hạn hoặc không phải tiền vào' : null,
        } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
      if (!transactionId || !validIncomingAmount) continue;

      // 1. Kiểm tra và Xử lý Giao dịch Nạp tiền Ví điện tử (cú pháp NAPxxxxx)
      if (topupCode) {
        const topupAmount = amount;
        const session = await getWalletTopupSession(topupCode);
        if (!session || session.status !== 'PENDING' || session.amount !== topupAmount) {
          await prisma.bankTransfer.update({ where: { id: ledger.id }, data: { reviewReason: 'Phiên nạp ví không tồn tại, đã xử lý hoặc sai số tiền' } });
          continue;
        }
        if (Number.isFinite(topupAmount) && topupAmount > 0) {
          try {
            const topupResult = await prisma.$transaction(async (tx) => {
              return await processWalletTopup(tx, {
                topupCode,
                amount: Math.round(topupAmount),
                bankTransId: transactionId,
                description: txn.description || `Nạp ví qua chuyển khoản ngân hàng ${topupCode}`,
              }).then(async (result) => {
                if (result.success && !result.alreadyProcessed) await tx.bankTransfer.update({ where: { id: ledger.id }, data: { status: 'APPLIED_TOPUP', reviewReason: null } });
                else await tx.bankTransfer.update({ where: { id: ledger.id }, data: { reviewReason: result.alreadyProcessed ? 'Giao dịch nạp ví đã được xử lý; kiểm tra mã ngân hàng' : result.error || 'Không thể nạp ví; cần đối soát' } });
                return result;
              });
            });

            if (topupResult.success && !topupResult.alreadyProcessed && topupResult.userId) {
              await pusherServer.trigger(`private-user-${topupResult.userId}`, 'wallet-updated', {
                balance: topupResult.newBalance,
                topupAmount: Math.round(topupAmount),
                topupCode,
              });

              await pusherServer.trigger(`private-user-${topupResult.userId}`, 'payment-success', {
                topupCode,
                amount: Math.round(topupAmount),
                type: 'TOPUP',
              });

              await createNotification({
                userId: topupResult.userId,
                type: 'PAYMENT_RECEIVED',
                title: 'Nạp tiền ví thành công',
                message: `Bạn đã nạp thành công ${Math.round(topupAmount).toLocaleString('vi-VN')}đ vào Ví Shop qua ngân hàng (Mã GD: ${topupCode}).`,
                data: {
                  topupCode,
                  amount: Math.round(topupAmount),
                  balance: topupResult.newBalance,
                },
              });
            }
          } catch (topupErr) {
            console.error('[Casso Webhook] Lỗi xử lý nạp tiền ví:', topupErr);
            await prisma.bankTransfer.update({ where: { id: ledger.id }, data: { reviewReason: 'Lỗi xử lý nạp ví; cần đối soát thủ công' } });
          }
        }
        continue;
      }

      const decision = evaluateWebhookDecision(txn, {
        isDuplicateTransaction: false,
        order,
      });
      if (!order || decision.action === 'SKIP' || order.expiresAt <= new Date()) {
        await prisma.bankTransfer.update({ where: { id: ledger.id }, data: { reviewReason: !order ? 'Không tìm thấy đơn hàng' : order.expiresAt <= new Date() ? 'Tiền đến sau hạn thanh toán' : decision.action === 'SKIP' ? decision.reason : 'Cần đối soát' } });
        continue;
      }

      let createdTransaction;
      try {
        createdTransaction = await prisma.$transaction(async (tx) => {
          const changed = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING', paymentStatus: 'UNPAID', expiresAt: { gt: new Date() } },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
          });
          if (changed.count !== 1) return null;

          const payment = await tx.transaction.create({
            data: {
              orderId: order.id,
              bankTransId: transactionId,
              amount: storedAmount,
              description: txn.description || '',
              bankName: txn.bankSubAccId || null,
              receivedAt: txn.when ? new Date(txn.when) : new Date(),
              verified: true,
              rawWebhookData: txn as unknown as Prisma.InputJsonValue,
            },
          });
          await tx.bankTransfer.update({ where: { id: ledger.id }, data: { status: 'APPLIED_ORDER', reviewReason: null } });
          return payment;
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Unique constraint violation (duplicate bankTransId or orderId due to race condition)
          // Gracefully skip to preserve idempotency without failing the webhook request
          await prisma.bankTransfer.update({ where: { id: ledger.id }, data: { reviewReason: 'Đơn đã được xử lý đồng thời; cần đối soát' } });
          continue;
        }
        throw err;
      }

      if (!createdTransaction) {
        await prisma.bankTransfer.update({ where: { id: ledger.id }, data: { reviewReason: 'Trạng thái đơn đã thay đổi; cần đối soát' } });
        continue;
      }

      if (order.userId) {
        await createNotification({
          userId: order.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Thanh toán thành công',
          message: `Đơn hàng ${order.orderCode} đã được thanh toán`,
          data: { orderId: order.id, orderCode: order.orderCode },
        });

        await pusherServer.trigger(
          `private-user-${order.userId}`,
          'payment-success',
          { orderId: order.orderCode, amount: order.totalAmount }
        );
      }

      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'PAYMENT_RECEIVED',
          title: `Nhận thanh toán ${order.totalAmount.toLocaleString('vi-VN')}đ`,
          message: `Đơn hàng ${order.orderCode} từ ${order.customerName}`,
          data: { orderId: order.id },
        });
      }

      if (order.chatRoom) {
        const adminUser = admins[0];
        if (adminUser) {
          const content = `Đơn hàng ${order.orderCode} đã thanh toán thành công.`;
          const message = await prisma.message.create({
            data: {
              roomId: order.chatRoom.id,
              senderId: adminUser.id,
              content,
              type: 'SYSTEM',
            },
            include: { sender: { select: { id: true, name: true, avatar: true } } },
          });
          await pusherServer.trigger(`private-chat-${order.chatRoom.id}`, 'new-message', {
            ...message,
            createdAt: message.createdAt.toISOString(),
          });
        }
      }

      try {
        await invalidateAnalyticsCache();
        await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
          type: 'CASSO_PAYMENT',
          timestamp: Date.now(),
        });
      } catch (pusherErr) {
        console.error('[Casso Webhook] Pusher admin trigger error:', pusherErr);
      }

      // Bắn thông báo Telegram cho Admin khi đơn hàng được thanh toán VietQR (non-blocking)
      try {
        const paidTelegramPayload = formatPaidOrderMessage({
          id: order.id,
          orderCode: order.orderCode,
          customerName: order.customerName,
          totalAmount: Number(order.totalAmount),
          paymentMethod: 'Chuyển khoản VietQR',
        });
        void sendTelegramMessage(paidTelegramPayload).catch((err) => {
          console.error('[Casso Webhook] Telegram notification error:', err);
        });
      } catch (telegramErr) {
        console.error('[Casso Webhook] Telegram format error:', telegramErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
