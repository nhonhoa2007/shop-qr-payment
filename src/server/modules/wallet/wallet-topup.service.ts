import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../database/prisma.ts';
import { redis } from '../../infrastructure/redis.ts';
import { generateTopupCode } from '../../../shared/utils/index.ts';
import { parsePayOSOrderCode, createPayOSPaymentLink } from '../payment/payos.service.ts';
import { getBankInfo } from '../payment/vietqr.service.ts';
import { getOrCreateWallet } from './wallet.service.ts';
import type { WalletTopupSession, WalletTopupResponse } from '../../../shared/types/index.ts';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

// In-memory fallback map cho local development và unit tests khi Redis không khả dụng
export const inMemoryTopupStore = new Map<string, WalletTopupSession>();

export interface WalletTopupProcessResult {
  success: boolean;
  error?: string;
  alreadyProcessed?: boolean;
  newBalance?: number;
  transactionId?: string;
  topupCode?: string;
  amount?: number;
  userId?: string;
}

/**
 * Lưu phiên nạp tiền ví vào Redis (distributed cache) và In-memory Fallback
 */
export async function saveWalletTopupSession(session: WalletTopupSession): Promise<void> {
  inMemoryTopupStore.set(session.topupCode, session);
  inMemoryTopupStore.set(String(session.orderCode), session);

  try {
    const ttlSeconds = 86400; // 24 hours
    await redis.set(`wallet:topup:${session.topupCode}`, session, { ex: ttlSeconds });
    await redis.set(`wallet:topup:orderCode:${session.orderCode}`, session, { ex: ttlSeconds });
    if (session.idempotencyToken) {
      await redis.set(`wallet:topup:idempotency:${session.idempotencyToken}`, session, { ex: ttlSeconds });
    }
  } catch (err) {
    console.warn('[Wallet Topup] Lưu cache Redis thất bại, dùng in-memory fallback:', err);
  }
}

/**
 * Truy vấn phiên nạp tiền ví theo topupCode (NAPxxxxx) hoặc orderCode (số PayOS)
 */
export async function getWalletTopupSession(
  identifier: string | number
): Promise<WalletTopupSession | null> {
  const key = String(identifier).trim();
  if (!key) return null;

  // 1. Kiểm tra In-memory trước (nhanh nhất)
  const memoryHit = inMemoryTopupStore.get(key);
  if (memoryHit) return memoryHit;

  // 2. Kiểm tra Redis
  try {
    const session =
      (await redis.get<WalletTopupSession>(`wallet:topup:${key}`)) ||
      (await redis.get<WalletTopupSession>(`wallet:topup:orderCode:${key}`));
    if (session) {
      // Sync lại in-memory store
      inMemoryTopupStore.set(session.topupCode, session);
      inMemoryTopupStore.set(String(session.orderCode), session);
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
  token: string
): Promise<WalletTopupSession | null> {
  const key = String(token).trim();
  if (!key) return null;

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
}): Promise<WalletTopupSession> {
  const amount = Math.round(Number(params.amount));
  if (!Number.isFinite(amount) || amount < 10_000) {
    throw new Error('Số tiền nạp tối thiểu là 10.000đ');
  }

  // Khử trùng lặp theo Idempotency Token nếu client gửi lên
  if (params.idempotencyToken) {
    const existing = await getWalletTopupSessionByIdempotencyToken(params.idempotencyToken);
    if (existing && existing.userId === params.userId && existing.amount === amount) {
      return existing;
    }
  }

  const topupCode = params.topupCode || generateTopupCode();
  const orderCode = parsePayOSOrderCode(topupCode);
  const idempotencyToken = params.idempotencyToken || crypto.randomUUID();

  const session: WalletTopupSession = {
    topupCode,
    orderCode,
    userId: params.userId,
    amount,
    status: 'PENDING',
    idempotencyToken,
    createdAt: new Date().toISOString(),
  };

  await saveWalletTopupSession(session);
  return session;
}

/**
 * Tạo liên kết thanh toán VietQR PayOS cho giao dịch nạp tiền ví
 */
export async function createWalletTopupPaymentLink(params: {
  userId: string;
  amount: number;
  host?: string;
  protocol?: string;
  idempotencyToken?: string;
}): Promise<{
  success: boolean;
  data?: WalletTopupResponse;
  error?: string;
}> {
  const session = await createWalletTopupSession({
    userId: params.userId,
    amount: params.amount,
    idempotencyToken: params.idempotencyToken,
  });

  const host = params.host || 'localhost:3000';
  const protocol = params.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  const returnUrl = `${baseUrl}/wallet?topup=success&code=${session.topupCode}`;
  const cancelUrl = `${baseUrl}/wallet?topup=cancelled&code=${session.topupCode}`;

  const payOSResult = await createPayOSPaymentLink({
    orderCode: session.orderCode,
    amount: session.amount,
    description: session.topupCode, // Tối đa 25 ký tự theo quy định PayOS
    returnUrl,
    cancelUrl,
    items: [
      {
        name: `Nạp ví ShopQR (${session.topupCode})`,
        quantity: 1,
        price: session.amount,
      },
    ],
  });

  if (!payOSResult.success) {
    return {
      success: false,
      error: payOSResult.error || 'Cổng thanh toán PayOS tạm thời không khả dụng',
    };
  }

  const bankInfo = getBankInfo();
  const bankAccount = bankInfo.accountNo || '970422123456789';
  const bankName = bankInfo.displayName || 'MB Bank';
  const bankId = bankInfo.bankId || 'mbbank';
  const accountName = bankInfo.accountName || 'SHOP QR PAYMENT';

  const defaultVietQrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${session.amount}&addInfo=${encodeURIComponent(session.topupCode)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    success: true,
    data: {
      topupCode: session.topupCode,
      orderCode: session.orderCode,
      amount: session.amount,
      checkoutUrl: payOSResult.checkoutUrl,
      qrCode: payOSResult.qrCode,
      qrUrl: payOSResult.qrCode && payOSResult.qrCode.startsWith('http') ? payOSResult.qrCode : defaultVietQrUrl,
      bankInfo: {
        bankName,
        bankId,
        accountNo: bankAccount,
        accountName,
      },
      paymentLinkId: payOSResult.paymentLinkId,
      idempotencyToken: session.idempotencyToken,
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
  }
): Promise<WalletTopupProcessResult> {
  const { topupCode, amount, bankTransId, description } = params;

  // 1. Tìm thông tin session nạp tiền nếu chưa có userId trực tiếp
  const session = await getWalletTopupSession(topupCode);
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

    // 4. Cộng tiền nguyên tử vào ví người dùng
    const updatedWallet = await tx.userWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    // 5. Ghi nhật ký biến động số dư loại TOPUP
    const txRecord = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'TOPUP',
        orderId: topupCode,
        description:
          description ||
          `Nạp tiền vào ví (${topupCode})${bankTransId ? ` [${bankTransId}]` : ''}`,
      },
    });

    // 6. Cập nhật trạng thái session sang COMPLETED
    if (session) {
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
