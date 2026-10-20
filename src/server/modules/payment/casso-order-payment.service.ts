import type { Prisma } from '@prisma/client';
import {
  enqueuePaymentReceivedTelegram,
  type TelegramOutboxEnqueueClient,
} from '@server/modules/telegram/telegram-outbox.service';

interface CassoPaymentClient extends TelegramOutboxEnqueueClient {
  order: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  transaction?: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  bankTransfer: {
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
}

export interface ApplyCassoOrderPaymentInput {
  order: {
    id: string;
    orderCode: string;
    customerName: string;
    totalAmount: bigint | number;
  };
  ledgerId: string;
  transactionId: string;
  storedAmount: bigint;
  description: string;
  bankName: string | null;
  receivedAt: Date;
  rawWebhookData: unknown;
  now?: Date;
}

export async function applyCassoOrderPayment(
  tx: CassoPaymentClient,
  input: ApplyCassoOrderPaymentInput
): Promise<Record<string, unknown> | null> {
  const now = input.now ?? new Date();
  const changed = await tx.order.updateMany({
    where: {
      id: input.order.id,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      expiresAt: { gt: now },
    },
    data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
  });
  if (changed.count !== 1) return null;

  let payment: Record<string, unknown> | null = null;
  if (tx.transaction?.create) {
    payment = await tx.transaction.create({
      data: {
        orderId: input.order.id,
        bankTransId: input.transactionId,
        amount: input.storedAmount,
        description: input.description,
        bankName: input.bankName,
        receivedAt: input.receivedAt,
        verified: true,
        rawWebhookData: input.rawWebhookData as Prisma.InputJsonValue,
      },
    });
  }

  const appliedTransfer = await tx.bankTransfer.update({
    where: { id: input.ledgerId },
    data: {
      status: 'APPLIED_ORDER',
      reviewReason: null,
      orderId: input.order.id,
      rawWebhookData: input.rawWebhookData as Prisma.InputJsonValue,
    },
  });

  await enqueuePaymentReceivedTelegram(tx, {
    id: input.order.id,
    orderCode: input.order.orderCode,
    customerName: input.order.customerName,
    totalAmount: input.order.totalAmount,
    paymentMethod: 'Chuyển khoản VietQR',
  });

  return payment ?? appliedTransfer;
}
