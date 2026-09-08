import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { pusherServer } from '@/lib/pusher-server';
import {
  type BankTransactionPayload,
  getTransactionAmount,
  getTransactionId,
  parseOrderCodeFromDescription,
} from '@/lib/payment-parser';

interface CassoWebhookBody {
  data?: BankTransactionPayload[];
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('secure-token');
    const expectedSecret = process.env.CASSO_WEBHOOK_SECRET;
    if (!expectedSecret || !signature || signature !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as CassoWebhookBody;
    const transactions = Array.isArray(body.data) ? body.data : [];

    for (const txn of transactions) {
      const transactionId = getTransactionId(txn);
      if (transactionId) {
        const existingTransaction = await prisma.transaction.findUnique({
          where: { bankTransId: transactionId },
        });
        if (existingTransaction) continue;
      }

      const matchedCode = parseOrderCodeFromDescription(txn.description);
      if (!matchedCode) continue;

      const amount = getTransactionAmount(txn);
      if (!amount || amount <= 0) continue;

      const order = await prisma.order.findFirst({
        where: { orderCode: { equals: matchedCode, mode: 'insensitive' } },
        include: { chatRoom: true },
      });

      if (!order || order.paymentStatus === 'PAID') continue;
      if (order.paymentStatus === 'EXPIRED' || order.status === 'CANCELLED') continue;
      if (amount < order.totalAmount) continue;

      const createdTransaction = await prisma.$transaction(async (tx) => {
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
