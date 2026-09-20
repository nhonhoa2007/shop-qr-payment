import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@server/database/prisma';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { pusherServer } from '@server/infrastructure/pusher';
import {
  type BankTransactionPayload,
  getTransactionId,
  parseOrderCodeFromDescription,
  evaluateWebhookDecision,
} from '@server/modules/payment/vietqr-parser.service';

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
      const isDuplicate = transactionId
        ? !!(await prisma.transaction.findUnique({
            where: { bankTransId: transactionId },
          }))
        : false;

      const matchedCode = parseOrderCodeFromDescription(txn.description);
      const order = matchedCode
        ? await prisma.order.findFirst({
            where: { orderCode: { equals: matchedCode, mode: 'insensitive' } },
            include: { chatRoom: true },
          })
        : null;

      const decision = evaluateWebhookDecision(txn, {
        isDuplicateTransaction: isDuplicate,
        order,
      });

      if (decision.action === 'SKIP' || !order) continue;

      const amount = decision.amount;

      let createdTransaction;
      try {
        createdTransaction = await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
          });

          return tx.transaction.create({
            data: {
              orderId: order.id,
              bankTransId: transactionId,
              amount,
              description: txn.description || '',
              bankName: txn.bankSubAccId || null,
              receivedAt: txn.when ? new Date(txn.when) : new Date(),
              verified: true,
              rawWebhookData: txn as unknown as Prisma.InputJsonValue,
            },
          });
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Unique constraint violation (duplicate bankTransId or orderId due to race condition)
          // Gracefully skip to preserve idempotency without failing the webhook request
          continue;
        }
        throw err;
      }

      if (!createdTransaction) continue;

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
        await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
          type: 'CASSO_PAYMENT',
          timestamp: Date.now(),
        });
      } catch (pusherErr) {
        console.error('[Casso Webhook] Pusher admin trigger error:', pusherErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
