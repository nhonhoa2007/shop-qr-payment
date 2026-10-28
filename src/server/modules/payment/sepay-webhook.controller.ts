import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@server/database/prisma';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { pusherServer } from '@server/infrastructure/pusher';
import { invalidateAnalyticsCache } from '@server/infrastructure/redis';
import {
  parseOrderCodeFromDescription,
  parseTopupCodeFromDescription,
} from '@server/modules/payment/vietqr-parser.service';
import {
  parseSePayPayload,
  verifySePayWebhook,
  type SePayTransactionPayload,
} from '@server/modules/payment/sepay.service';
import {
  applyBankOrderPayment,
  type ApplyBankOrderPaymentInput,
  type BankOrderPaymentClient,
} from '@server/modules/payment/bank-order-payment.service';
import type { PaymentRequestRecord } from '@server/modules/payment/payment-request.service';
import {
  processWalletTopup,
  type WalletTopupProcessResult,
} from '@server/modules/wallet/wallet-topup.service';
import { scheduleTelegramOutboxFastPath } from '@server/modules/telegram/telegram-outbox.fast-path';
import { BUSINESS_MAX_VND } from '@shared/utils/money';

interface SePayOrderRecord {
  id: string;
  orderCode: string;
  customerName: string;
  totalAmount: bigint;
  userId: string | null;
  status: string;
  paymentStatus: string;
  expiresAt: Date;
  chatRoom: { id: string } | null;
}

interface LedgerRecord {
  id: string;
  status?: string;
  reviewReason?: string | null;
  [key: string]: unknown;
}

interface SePayTransactionClient {
  bankTransfer: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  [key: string]: unknown;
}

interface SePayWebhookDatabase {
  paymentRequest: {
    findUnique(args: Record<string, unknown>): Promise<PaymentRequestRecord | null>;
  };
  order: {
    findFirst(args: Record<string, unknown>): Promise<SePayOrderRecord | null>;
  };
  bankTransfer: {
    create(args: { data: Record<string, unknown> }): Promise<LedgerRecord>;
    findUnique(args: Record<string, unknown>): Promise<LedgerRecord | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  };
  $transaction<T>(work: (tx: SePayTransactionClient) => Promise<T>): Promise<T>;
}

interface WalletTopupInput {
  topupCode: string;
  amount: number;
  userId?: string;
  bankTransId?: string;
  description?: string;
  completedAt?: Date;
}

export interface SePayWebhookDependencies {
  secret: string;
  now(): Date;
  isUniqueViolation(error: unknown): boolean;
  db: SePayWebhookDatabase;
  applyOrderPayment(
    tx: SePayTransactionClient,
    input: ApplyBankOrderPaymentInput
  ): Promise<Record<string, unknown> | null>;
  applyWalletTopup(
    tx: SePayTransactionClient,
    input: WalletTopupInput
  ): Promise<WalletTopupProcessResult>;
  afterOrderPayment(order: SePayOrderRecord): Promise<void>;
  afterWalletTopup(
    result: WalletTopupProcessResult,
    input: { topupCode: string; amount: number }
  ): Promise<void>;
}

function acknowledgement(): NextResponse {
  return NextResponse.json({ success: true });
}

function normalizePaymentCode(payload: SePayTransactionPayload): string | null {
  const direct = payload.code?.trim().toUpperCase() ?? '';
  if (/^(?:DH|NAP)[A-Z0-9]{4,}$/.test(direct)) return direct;

  const searchable = `${payload.content} ${payload.description}`;
  return parseTopupCodeFromDescription(searchable)
    ?? parseOrderCodeFromDescription(searchable);
}

function parseTransactionDate(value: string): Date | null {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}+07:00`
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function reviewReasonFor(
  payload: SePayTransactionPayload,
  code: string | null,
  request: PaymentRequestRecord | null,
  receivedAt: Date | null,
  order: SePayOrderRecord | null
): string | null {
  if (payload.transferType !== 'in') return 'Giao dịch không phải tiền vào';
  if (BigInt(payload.transferAmount) > BUSINESS_MAX_VND) return 'Số tiền vượt giới hạn nghiệp vụ';
  if (!code) return 'Không tìm thấy mã thanh toán DH/NAP';
  if (!request) return 'Không tìm thấy yêu cầu thanh toán';
  if (request.amount !== BigInt(payload.transferAmount)) return 'Giao dịch sai số tiền';
  if (!receivedAt) return 'Thời gian giao dịch không hợp lệ';
  if (receivedAt >= request.expiresAt) return 'Tiền đến sau hạn thanh toán';
  if (request.status !== 'PENDING' && request.status !== 'EXPIRED') {
    return 'Yêu cầu thanh toán đã được xử lý';
  }
  if (request.kind === 'ORDER' && !order) return 'Không tìm thấy đơn hàng';
  if (request.kind === 'WALLET_TOPUP' && !request.userId) return 'Phiên nạp ví không có người nhận';
  return null;
}

async function keepForReview(
  deps: SePayWebhookDependencies,
  ledgerId: string,
  reason: string
): Promise<void> {
  await deps.db.bankTransfer.updateMany({
    where: { id: ledgerId, status: 'PENDING_REVIEW' },
    data: { status: 'PENDING_REVIEW', reviewReason: reason },
  });
}

export async function handleSePayWebhook(
  req: Request,
  deps: SePayWebhookDependencies
): Promise<NextResponse> {
  const rawBody = await req.text();
  if (!verifySePayWebhook(rawBody, req.headers, deps.secret, deps.now().getTime())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const payload = parseSePayPayload(decoded);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid SePay payload' }, { status: 400 });
  }

  const code = normalizePaymentCode(payload);
  const request = code
    ? await deps.db.paymentRequest.findUnique({ where: { code } })
    : null;
  const order = request?.kind === 'ORDER'
    ? await deps.db.order.findFirst({
        where: request.orderId ? { id: request.orderId } : { orderCode: code },
        include: { chatRoom: true },
      })
    : null;
  const receivedAt = parseTransactionDate(payload.transactionDate);
  const reviewReason = reviewReasonFor(payload, code, request, receivedAt, order);
  const bankTransId = `sepay:${payload.id}`;
  const fingerprint = crypto.createHash('sha256').update(bankTransId).digest('hex');

  let ledger: LedgerRecord;
  try {
    ledger = await deps.db.bankTransfer.create({
      data: {
        fingerprint,
        bankTransId,
        amount: BigInt(payload.transferAmount),
        description: payload.content || payload.description,
        bankName: payload.gateway,
        senderAccount: null,
        receivedAt,
        rawWebhookData: payload as unknown as Prisma.InputJsonValue,
        orderId: request?.kind === 'ORDER' ? request.orderId : null,
        topupCode: code?.startsWith('NAP') ? code : null,
        status: 'PENDING_REVIEW',
        reviewReason,
      },
    });
  } catch (error) {
    if (!deps.isUniqueViolation(error)) throw error;
    const existing = await deps.db.bankTransfer.findUnique({ where: { bankTransId } });
    if (
      !existing
      || existing.status !== 'PENDING_REVIEW'
      || Boolean(existing.reviewReason)
    ) {
      return acknowledgement();
    }
    ledger = existing;
  }

  if (reviewReason || !code || !request || !receivedAt) return acknowledgement();

  try {
    if (request.kind === 'ORDER' && order) {
      const applied = await deps.db.$transaction((tx) => deps.applyOrderPayment(tx, {
        order,
        paymentRequestCode: code,
        ledgerId: ledger.id,
        transactionId: bankTransId,
        storedAmount: BigInt(payload.transferAmount),
        description: payload.content || payload.description,
        bankName: payload.gateway,
        receivedAt,
        rawWebhookData: payload,
        now: receivedAt,
      }));
      if (!applied) {
        await keepForReview(deps, ledger.id, 'Trạng thái đơn hàng đã thay đổi; cần đối soát');
        return acknowledgement();
      }
      try {
        await deps.afterOrderPayment(order);
      } catch (error) {
        console.error('[SePay Webhook] Lỗi thông báo thanh toán đơn hàng:', error);
      }
      return acknowledgement();
    }

    if (request.kind === 'WALLET_TOPUP' && request.userId) {
      const attempt = await deps.db.$transaction(async (tx) => {
        const ledgerClaim = await tx.bankTransfer.updateMany({
          where: {
            id: ledger.id,
            status: 'PENDING_REVIEW',
            reviewReason: null,
          },
          data: { status: 'APPLIED_TOPUP', reviewReason: null },
        });
        if (ledgerClaim.count !== 1) {
          return { claimed: false as const, result: null };
        }

        const topupResult = await deps.applyWalletTopup(tx, {
          topupCode: code,
          amount: payload.transferAmount,
          userId: request.userId ?? undefined,
          bankTransId,
          description: payload.content || `Nạp ví qua SePay ${code}`,
          completedAt: receivedAt,
        });
        if (!topupResult.success || topupResult.alreadyProcessed) {
          throw new Error(
            topupResult.error || 'Giao dịch nạp ví đã được xử lý hoặc không còn hợp lệ'
          );
        }
        return { claimed: true as const, result: topupResult };
      });
      if (!attempt.claimed || !attempt.result) return acknowledgement();
      const result = attempt.result;
      try {
        await deps.afterWalletTopup(result, { topupCode: code, amount: payload.transferAmount });
      } catch (error) {
        console.error('[SePay Webhook] Lỗi thông báo nạp ví:', error);
      }
    }
  } catch (error) {
    console.error('[SePay Webhook] Lỗi áp dụng giao dịch:', error);
    await keepForReview(deps, ledger.id, 'Lỗi xử lý tự động; cần đối soát thủ công');
  }

  return acknowledgement();
}

async function notifyOrderPayment(order: SePayOrderRecord): Promise<void> {
  scheduleTelegramOutboxFastPath();
  if (order.userId) {
    await createNotification({
      userId: order.userId,
      type: 'PAYMENT_RECEIVED',
      title: 'Thanh toán thành công',
      message: `Đơn hàng ${order.orderCode} đã được thanh toán`,
      data: { orderId: order.id, orderCode: order.orderCode },
    });
    await pusherServer.trigger(`private-user-${order.userId}`, 'payment-success', {
      orderId: order.orderCode,
      amount: order.totalAmount.toString(),
    });
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

  if (order.chatRoom && admins[0]) {
    const message = await prisma.message.create({
      data: {
        roomId: order.chatRoom.id,
        senderId: admins[0].id,
        content: `Đơn hàng ${order.orderCode} đã thanh toán thành công.`,
        type: 'SYSTEM',
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });
    await pusherServer.trigger(`private-chat-${order.chatRoom.id}`, 'new-message', {
      ...message,
      createdAt: message.createdAt.toISOString(),
    });
  }

  await invalidateAnalyticsCache();
  await pusherServer.trigger('private-admin-channel', 'analytics-updated', {
    type: 'SEPAY_PAYMENT',
    timestamp: Date.now(),
  });
}

async function notifyWalletTopup(
  result: WalletTopupProcessResult,
  input: { topupCode: string; amount: number }
): Promise<void> {
  if (!result.userId) return;
  const jsonSafeBalance = typeof result.newBalance === 'bigint'
    ? result.newBalance.toString()
    : result.newBalance;
  await pusherServer.trigger(`private-user-${result.userId}`, 'wallet-updated', {
    balance: jsonSafeBalance,
    topupAmount: input.amount,
    topupCode: input.topupCode,
  });
  await pusherServer.trigger(`private-user-${result.userId}`, 'payment-success', {
    topupCode: input.topupCode,
    amount: input.amount,
    type: 'TOPUP',
  });
  await createNotification({
    userId: result.userId,
    type: 'PAYMENT_RECEIVED',
    title: 'Nạp tiền ví thành công',
    message: `Bạn đã nạp thành công ${input.amount.toLocaleString('vi-VN')}đ vào Ví Shop qua SePay (Mã GD: ${input.topupCode}).`,
    data: {
      topupCode: input.topupCode,
      amount: input.amount,
      balance: jsonSafeBalance,
    },
  });
}

function createDefaultDependencies(): SePayWebhookDependencies {
  return {
    secret: process.env.SEPAY_WEBHOOK_SECRET || '',
    now: () => new Date(),
    isUniqueViolation: (error) => (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    ),
    db: prisma as unknown as SePayWebhookDatabase,
    applyOrderPayment: (tx, input) => applyBankOrderPayment(
      tx as unknown as BankOrderPaymentClient,
      input
    ),
    applyWalletTopup: (tx, input) => processWalletTopup(tx as never, input),
    afterOrderPayment: notifyOrderPayment,
    afterWalletTopup: notifyWalletTopup,
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    return await handleSePayWebhook(req, createDefaultDependencies());
  } catch (error) {
    console.error('[SePay Webhook] Lỗi webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
