import type { Prisma } from '@prisma/client';
import {
  enqueuePaymentReceivedTelegram,
  type TelegramOutboxEnqueueClient,
} from '@server/modules/telegram/telegram-outbox.service';

export class PaymentRequestClaimError extends Error {
  constructor() {
    super('Yêu cầu thanh toán không còn hợp lệ để ghi nhận');
    this.name = 'PaymentRequestClaimError';
  }
}

export class OrderPaymentStateError extends Error {
  constructor() {
    super('Đơn hàng không còn hợp lệ để ghi nhận thanh toán');
    this.name = 'OrderPaymentStateError';
  }
}

export interface BankOrderPaymentClient extends TelegramOutboxEnqueueClient {
  order: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  paymentRequest?: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  transaction?: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  bankTransfer: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
}

export interface ApplyBankOrderPaymentInput {
  order: {
    id: string;
    orderCode: string;
    customerName: string;
    totalAmount: bigint | number;
  };
  paymentRequestCode?: string;
  ledgerId: string;
  transactionId: string;
  storedAmount: bigint;
  description: string;
  bankName: string | null;
  receivedAt: Date;
  rawWebhookData: unknown;
  now?: Date;
}

export async function applyBankOrderPayment(
  tx: BankOrderPaymentClient,
  input: ApplyBankOrderPaymentInput
): Promise<Record<string, unknown> | null> {
  const now = input.now ?? new Date();
  // Claim the bank ledger before touching order or wallet state. This CAS is
  // the shared serialization point with manual reconciliation.
  const ledgerClaim = await tx.bankTransfer.updateMany({
    where: {
      id: input.ledgerId,
      status: 'PENDING_REVIEW',
      reviewReason: null,
    },
    data: {
      status: 'APPLIED_ORDER',
      reviewReason: null,
      orderId: input.order.id,
      rawWebhookData: input.rawWebhookData as Prisma.InputJsonValue,
    },
  });
  if (ledgerClaim.count !== 1) return null;

  const changed = await tx.order.updateMany({
    where: {
      id: input.order.id,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      expiresAt: { gt: now },
    },
    data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
  });
  if (changed.count !== 1) throw new OrderPaymentStateError();

  if (input.paymentRequestCode) {
    if (!tx.paymentRequest) throw new PaymentRequestClaimError();
    const requestChanged = await tx.paymentRequest.updateMany({
      where: {
        code: input.paymentRequestCode.trim().toUpperCase(),
        kind: 'ORDER',
        status: { in: ['PENDING', 'EXPIRED'] },
        expiresAt: { gt: now },
      },
      data: { status: 'COMPLETED', completedAt: now },
    });
    if (requestChanged.count !== 1) throw new PaymentRequestClaimError();
  }

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

  await enqueuePaymentReceivedTelegram(tx, {
    id: input.order.id,
    orderCode: input.order.orderCode,
    customerName: input.order.customerName,
    totalAmount: input.order.totalAmount,
    paymentMethod: 'Chuyển khoản VietQR',
  });

  return payment ?? { id: input.ledgerId };
}
