import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@server/database/prisma';
import { redis } from '@server/infrastructure/redis';
import { generateTopupCode } from '@shared/utils';
import { getBankInfo } from '@server/modules/payment/vietqr.service';
import { generateSePayQrUrl } from '@server/modules/payment/sepay.service';
import {
  completePendingPaymentRequest,
  createPendingPaymentRequest,
  paymentRequestToTopupSession,
  type PaymentRequestRecord,
  type PaymentRequestStore,
} from '@server/modules/payment/payment-request.service';
import { getOrCreateWallet } from './wallet.service';
import type { WalletTopupSession, WalletTopupResponse } from '@shared/types';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

// In-memory fallback map cho local development và unit tests khi Redis không khả dụng
export const inMemoryTopupStore = new Map<string, WalletTopupSession>();

import type { MoneyVnd } from '@shared/types/money';

export interface WalletTopupProcessResult {
  success: boolean;
  error?: string;
  alreadyProcessed?: boolean;
  newBalance?: MoneyVnd | number | bigint;
  transactionId?: string;
  topupCode?: string;
  amount?: MoneyVnd | number | bigint;
  userId?: string;
}

/**
 * Lưu phiên nạp tiền ví vào Redis (distributed cache) và In-memory Fallback
 */
export async function saveWalletTopupSession(session: WalletTopupSession): Promise<void> {
  inMemoryTopupStore.set(session.topupCode, session);

  try {
    const ttlSeconds = 86400; // 24 hours
    await redis.set(`wallet:topup:${session.topupCode}`, session, { ex: ttlSeconds });
    if (session.idempotencyToken) {
      await redis.set(`wallet:topup:idempotency:${session.idempotencyToken}`, session, { ex: ttlSeconds });
    }
  } catch (err) {
    console.warn('[Wallet Topup] Lưu cache Redis thất bại, dùng in-memory fallback:', err);
  }
}
/**
 * Truy vấn phiên nạp tiền ví theo topupCode (NAPxxxxx)
 */
export async function getWalletTopupSession(
  identifier: string | number,
  store: PaymentRequestStore = prisma as unknown as PaymentRequestStore
): Promise<WalletTopupSession | null> {
  const key = String(identifier).trim().toUpperCase();
  if (!key) return null;

  try {
    const request = await store.paymentRequest.findUnique({ where: { code: key } });
    if (request?.kind === 'WALLET_TOPUP') {
      const session = paymentRequestToTopupSession(request);
      inMemoryTopupStore.set(session.topupCode, session);
      return session;
    }
  } catch (err) {
    console.warn('[Wallet Topup] Đọc PaymentRequest thất bại, thử cache legacy:', err);
  }

  return getLegacyWalletTopupSession(key);
}

async function getLegacyWalletTopupSession(key: string): Promise<WalletTopupSession | null> {
  const memoryHit = inMemoryTopupStore.get(key);
  if (memoryHit) return memoryHit;

  try {
    const session = await redis.get<WalletTopupSession>(`wallet:topup:${key}`);
    if (session) {
      // Sync lại in-memory store
      inMemoryTopupStore.set(session.topupCode, session);
      return session;
    }
  } catch (err) {
    console.warn('[Wallet Topup] Đọc Redis thất bại:', err);
  }

  return null;
}

/**
 * Truy vấn phiên nạp tiền ví theo Idempotency Token
 */
export async function getWalletTopupSessionByIdempotencyToken(
  token: string,
  store: PaymentRequestStore = prisma as unknown as PaymentRequestStore
): Promise<WalletTopupSession | null> {
  const key = String(token).trim();
  if (!key) return null;

  try {
    const request = await store.paymentRequest.findUnique({ where: { idempotencyKey: key } });
    if (request?.kind === 'WALLET_TOPUP') return paymentRequestToTopupSession(request);
  } catch (err) {
    console.warn('[Wallet Topup] Đọc PaymentRequest theo idempotency key thất bại:', err);
  }

  try {
    const session = await redis.get<WalletTopupSession>(`wallet:topup:idempotency:${key}`);
    if (session) return session;
  } catch (err) {
    console.warn('[Wallet Topup] Đọc Redis idempotency thất bại:', err);
  }

  for (const session of inMemoryTopupStore.values()) {
    if (session.idempotencyToken === key) return session;
  }

  return null;
}

/**
 * Khởi tạo phiên nạp tiền ví mới với idempotencyToken và mã giao dịch NAPxxxxx
 *
 * @param params.userId - Định danh duy nhất người dùng nạp tiền
 * @param params.amount - Số tiền nạp (tối thiểu 10.000đ)
 * @param params.topupCode - Mã giao dịch NAP tùy chọn (tự sinh nếu không truyền)
 * @param params.idempotencyToken - Idempotency Token từ client (nếu có)
 */
export async function createWalletTopupSession(params: {
  userId: string;
  amount: number;
  topupCode?: string;
  idempotencyToken?: string;
}, store: PaymentRequestStore = prisma as unknown as PaymentRequestStore): Promise<WalletTopupSession> {
  const request = await createWalletTopupRequest(params, store);
  return paymentRequestToTopupSession(request);
}

async function createWalletTopupRequest(params: {
  userId: string;
  amount: number;
  topupCode?: string;
  idempotencyToken?: string;
}, store: PaymentRequestStore): Promise<PaymentRequestRecord> {
  const amount = Math.round(Number(params.amount));
  if (!Number.isSafeInteger(amount) || amount < 10_000) {
    throw new Error('Số tiền nạp tối thiểu là 10.000đ');
  }
  if (amount > 50_000_000) {
    throw new Error('Số tiền nạp tối đa là 50.000.000đ');
  }

  const topupCode = params.topupCode || generateTopupCode();
  const idempotencyToken = params.idempotencyToken || crypto.randomUUID();
  const bankInfo = getBankInfo();
  const qrUrl = generateSePayQrUrl({
    bankId: bankInfo.bankId,
    accountNo: bankInfo.accountNo,
    accountName: bankInfo.accountName,
    amount,
    paymentCode: topupCode,
    memoPrefix: process.env.SEPAY_QR_MEMO_PREFIX,
  });
  const request = await createPendingPaymentRequest(store, {
    code: topupCode,
    kind: 'WALLET_TOPUP',
    amount,
    qrUrl,
    userId: params.userId,
    idempotencyKey: idempotencyToken,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  inMemoryTopupStore.set(request.code, paymentRequestToTopupSession(request));
  return request;
}

/**
 * Tạo phiên nạp tiền ví bền vững kèm QR SePay/VietQR.
 */
export async function createWalletTopupPaymentLink(params: {
  userId: string;
  amount: number;
  idempotencyToken?: string;
}, store: PaymentRequestStore = prisma as unknown as PaymentRequestStore): Promise<{
  success: boolean;
  data?: WalletTopupResponse;
  error?: string;
}> {
  const request = await createWalletTopupRequest({
    userId: params.userId,
    amount: params.amount,
    idempotencyToken: params.idempotencyToken,
  }, store);

  const bankInfo = getBankInfo();

  return {
    success: true,
    data: {
      topupCode: request.code,
      amount: Number(request.amount),
      qrUrl: request.qrUrl,
      expiresAt: request.expiresAt.toISOString(),
      bankInfo: {
        bankName: bankInfo.displayName,
        bankId: bankInfo.bankId,
        accountNo: bankInfo.accountNo,
        accountName: bankInfo.accountName,
      },
      idempotencyToken: request.idempotencyKey ?? undefined,
    },
  };
}

// Set theo dõi các tiến trình nạp tiền đang chạy để chặn đứng Race Condition
export const inFlightTopupLocks = new Set<string>();

/**
 * Xử lý ghi nhận nạp tiền vào ví người dùng một cách nguyên tử (Atomic Balance Accounting)
 *
 * @security & Invariants
 * 1. Khử trùng lặp & Lũy đẳng tuyệt đối (Persistent Idempotency Guard):
 *    - Kiểm tra `WalletTransaction` với `orderId === topupCode` hoặc mô tả chứa mã nạp.
 *    - Nếu đã xử lý, trả về kết quả thành công mà không cộng tiền lần thứ hai.
 * 2. Cộng số dư nguyên tử (Atomic Balance Increment):
 *    - Sử dụng `balance: { increment: amount }` trong Database Transaction ACID.
 * 3. Ghi sổ kép đối soát (Double-Entry Ledger):
 *    - Tạo bản ghi `WalletTransaction` với `type: 'TOPUP'` và số tiền dương.
 */
export async function processWalletTopup(
  tx: TransactionClient = prisma,
  params: {
    topupCode: string;
    amount: number;
    userId?: string;
    bankTransId?: string;
    description?: string;
    completedAt?: Date;
  }
): Promise<WalletTopupProcessResult> {
  const { topupCode, amount, bankTransId, description } = params;

  // 1. Tìm thông tin session nạp tiền nếu chưa có userId trực tiếp
  const requestStore = 'paymentRequest' in tx
    ? tx as unknown as PaymentRequestStore
    : null;
  const session = requestStore
    ? await getWalletTopupSession(topupCode, requestStore)
    : await getLegacyWalletTopupSession(topupCode);
  const targetUserId = params.userId || session?.userId;

  if (!targetUserId) {
    return {
      success: false,
      error: `Không tìm thấy thông tin phiên nạp tiền cho mã ${topupCode}`,
    };
  }

  // 2. Lấy hoặc tạo ví người dùng
  const wallet = await getOrCreateWallet(tx, targetUserId);

  // Idempotency Guard: Nếu phiên đã COMPLETED, trả về kết quả ngay
  if (session?.status === 'COMPLETED') {
    return {
      success: true,
      alreadyProcessed: true,
      newBalance: wallet.balance,
      topupCode,
      amount,
      userId: targetUserId,
    };
  }

  // Concurrency Guard: Chống Race condition nếu 2 webhook đồng thời cùng mã topupCode
  // Sử dụng kết hợp In-memory lock lẫn Distributed Lock trên Redis (hỗ trợ Serverless / Multi-instance)
  if (inFlightTopupLocks.has(topupCode)) {
    return {
      success: true,
      alreadyProcessed: true,
      newBalance: wallet.balance,
      topupCode,
      amount,
      userId: targetUserId,
    };
  }

  const redisLockKey = `lock:wallet:topup:${topupCode}`;
  const acquiredDistributedLock = await redis.setNx(redisLockKey, '1', 15);
  if (!acquiredDistributedLock) {
    return {
      success: true,
      alreadyProcessed: true,
      newBalance: wallet.balance,
      topupCode,
      amount,
      userId: targetUserId,
    };
  }

  inFlightTopupLocks.add(topupCode);

  try {
    // 3. Khử trùng lặp bền vững (Database Idempotency Check)
    const existingTx = await tx.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        type: 'TOPUP',
        OR: [
          { orderId: topupCode },
          { description: { contains: topupCode } },
          ...(bankTransId ? [{ description: { contains: bankTransId } }] : []),
        ],
      },
    });

    if (existingTx) {
      return {
        success: true,
        alreadyProcessed: true,
        newBalance: wallet.balance,
        transactionId: existingTx.id,
        topupCode,
        amount: existingTx.amount,
        userId: targetUserId,
      };
    }

    if (requestStore) {
      const claimed = await completePendingPaymentRequest(
        requestStore,
        topupCode,
        params.completedAt ?? new Date()
      );
      if (!claimed) {
        return {
          success: false,
          error: 'Phiên nạp ví đã hết hạn hoặc không còn chờ thanh toán',
          topupCode,
          amount,
          userId: targetUserId,
        };
      }
    }

    const amountBigInt = BigInt(amount);

    // 4. Cộng tiền nguyên tử vào ví người dùng
    const updatedWallet = await tx.userWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amountBigInt } },
    });

    // 5. Ghi nhật ký biến động số dư loại TOPUP
    const txRecord = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: amountBigInt,
        type: 'TOPUP',
        orderId: topupCode,
        description:
          description ||
          `Nạp tiền vào ví (${topupCode})${bankTransId ? ` [${bankTransId}]` : ''}`,
      },
    });

    // 6. Đồng bộ trạng thái phiên cache legacy. PaymentRequest đã được claim
    // trước khi cộng tiền và sẽ rollback cùng transaction nếu bước sau lỗi.
    if (!requestStore && session) {
      session.status = 'COMPLETED';
      session.completedAt = new Date().toISOString();
      session.bankTransId = bankTransId;
      await saveWalletTopupSession(session);
    }

    return {
      success: true,
      newBalance: updatedWallet.balance,
      transactionId: txRecord.id,
      topupCode,
      amount,
      userId: targetUserId,
    };
  } finally {
    inFlightTopupLocks.delete(topupCode);
    try {
      await redis.del(redisLockKey);
    } catch (delErr) {
      console.warn('[Wallet Topup] Xóa distributed lock thất bại:', delErr);
    }
  }
}
