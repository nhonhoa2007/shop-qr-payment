import type { WalletTopupSession } from '@shared/types';

export type PaymentRequestKindValue = 'ORDER' | 'WALLET_TOPUP';
export type PaymentRequestStatusValue = 'PENDING' | 'COMPLETED' | 'EXPIRED';

export interface PaymentRequestRecord {
  id: string;
  code: string;
  kind: PaymentRequestKindValue;
  status: PaymentRequestStatusValue;
  provider: string;
  amount: bigint;
  qrUrl: string;
  userId: string | null;
  orderId: string | null;
  idempotencyKey: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRequestStore {
  paymentRequest: {
    findUnique(args: Record<string, unknown>): Promise<PaymentRequestRecord | null>;
    create(args: Record<string, unknown>): Promise<PaymentRequestRecord>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
}

export interface CreatePendingPaymentRequestInput {
  code: string;
  kind: PaymentRequestKindValue;
  amount: number | bigint;
  qrUrl: string;
  expiresAt: Date;
  userId?: string | null;
  orderId?: string | null;
  idempotencyKey?: string | null;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function sameRequest(
  existing: PaymentRequestRecord,
  input: CreatePendingPaymentRequestInput,
  amount: bigint
): boolean {
  return existing.kind === input.kind
    && existing.amount === amount
    && existing.userId === (input.userId ?? null)
    && existing.orderId === (input.orderId ?? null);
}

export async function createPendingPaymentRequest(
  store: PaymentRequestStore,
  input: CreatePendingPaymentRequestInput
): Promise<PaymentRequestRecord> {
  const code = normalizeCode(input.code);
  const amount = BigInt(input.amount);
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (!code) throw new Error('Mã thanh toán không được để trống');
  if (amount <= 0n) throw new Error('Số tiền thanh toán phải lớn hơn 0');

  const existing = await store.paymentRequest.findUnique({
    where: idempotencyKey ? { idempotencyKey } : { code },
  });
  if (existing) {
    if (!sameRequest(existing, input, amount)) {
      throw new Error('Idempotency key đã được dùng cho yêu cầu khác');
    }
    return existing;
  }

  return store.paymentRequest.create({
    data: {
      code,
      kind: input.kind,
      status: 'PENDING',
      provider: 'SEPAY',
      amount,
      qrUrl: input.qrUrl,
      userId: input.userId ?? null,
      orderId: input.orderId ?? null,
      idempotencyKey,
      expiresAt: input.expiresAt,
    },
  });
}

export async function findPaymentRequestByCode(
  store: PaymentRequestStore,
  code: string
): Promise<PaymentRequestRecord | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return store.paymentRequest.findUnique({ where: { code: normalized } });
}

export async function completePendingPaymentRequest(
  store: PaymentRequestStore,
  code: string,
  completedAt = new Date()
): Promise<boolean> {
  const changed = await store.paymentRequest.updateMany({
    where: {
      code: normalizeCode(code),
      status: 'PENDING',
      expiresAt: { gt: completedAt },
    },
    data: { status: 'COMPLETED', completedAt },
  });
  return changed.count === 1;
}

export async function expirePendingPaymentRequest(
  store: PaymentRequestStore,
  code: string,
  now = new Date()
): Promise<boolean> {
  const changed = await store.paymentRequest.updateMany({
    where: {
      code: normalizeCode(code),
      status: 'PENDING',
      expiresAt: { lte: now },
    },
    data: { status: 'EXPIRED' },
  });
  return changed.count === 1;
}

export function paymentRequestToTopupSession(
  request: PaymentRequestRecord
): WalletTopupSession {
  if (request.kind !== 'WALLET_TOPUP' || !request.userId) {
    throw new Error('PaymentRequest không phải phiên nạp ví hợp lệ');
  }
  return {
    topupCode: request.code,
    userId: request.userId,
    amount: Number(request.amount),
    status: request.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    idempotencyToken: request.idempotencyKey ?? undefined,
    createdAt: request.createdAt.toISOString(),
  };
}
