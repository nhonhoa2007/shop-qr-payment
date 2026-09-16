import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../database/prisma.ts';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface WalletOperationResult {
  success: boolean;
  error?: string;
  refundedAmount?: number;
  paidAmount?: number;
  newBalance?: number;
  transactionId?: string;
  isGuest?: boolean;
}

/**
 * Lấy hoặc khởi tạo ví nội bộ cho người dùng
 */
export async function getOrCreateWallet(
  tx: TransactionClient,
  userId: string
) {
  const existing = await tx.userWallet.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return await tx.userWallet.create({
    data: {
      userId,
      balance: 0,
    },
  });
}

/**
 * Hoàn tiền đơn hàng vào ví nội bộ (Refund Engine)
 * Đảm bảo:
 * 1. Chống Double-Refund (kiểm tra trạng thái PAID -> REFUNDED)
 * 2. Cộng số dư ví nguyên tử
 * 3. Ghi vết lịch sử WalletTransaction
 */
export async function refundOrderToWallet(
  tx: TransactionClient,
  orderId: string,
  reason?: string
): Promise<WalletOperationResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return { success: false, error: 'Không tìm thấy đơn hàng' };
  }

  if (order.paymentStatus === 'REFUNDED') {
    return { success: false, error: 'Đơn hàng này đã được hoàn tiền trước đó' };
  }

  if (order.paymentStatus !== 'PAID') {
    return { success: false, error: 'Chỉ có thể hoàn tiền cho đơn hàng đã thanh toán (PAID)' };
  }

  // Chuyển paymentStatus sang REFUNDED
  await tx.order.update({
    where: { id: order.id },
    data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' },
  });

  // Nếu là tài khoản thành viên có userId -> Hoàn vào ví
  if (order.userId) {
    const wallet = await getOrCreateWallet(tx, order.userId);

    const updatedWallet = await tx.userWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: order.totalAmount } },
    });

    const txRecord = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: order.totalAmount,
        type: 'REFUND',
        orderId: order.id,
        description: reason || `Hoàn tiền 100% cho đơn hàng ${order.orderCode}`,
      },
    });

    return {
      success: true,
      refundedAmount: order.totalAmount,
      newBalance: updatedWallet.balance,
      transactionId: txRecord.id,
    };
  }

  // Khách vãng lai (không có tài khoản đăng nhập)
  return {
    success: true,
    refundedAmount: order.totalAmount,
    isGuest: true,
  };
}

/**
 * Thanh toán đơn hàng trực tiếp bằng số dư ví nội bộ
 * Đảm bảo:
 * 1. Kiểm tra số dư ví >= tổng tiền đơn hàng
 * 2. Trừ tiền nguyên tử (CAS condition: balance >= totalAmount)
 * 3. Ghi vết WalletTransaction và tạo Transaction đơn hàng
 */
export async function payOrderWithWallet(
  tx: TransactionClient,
  userId: string,
  orderId: string
): Promise<WalletOperationResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return { success: false, error: 'Không tìm thấy đơn hàng' };
  }

  if (order.userId && order.userId !== userId) {
    return { success: false, error: 'Bạn không có quyền thanh toán đơn hàng này' };
  }

  if (order.paymentStatus === 'PAID') {
    return { success: false, error: 'Đơn hàng này đã được thanh toán' };
  }

  if (order.status === 'CANCELLED') {
    return { success: false, error: 'Đơn hàng đã bị hủy, không thể thanh toán' };
  }

  if (order.expiresAt < new Date()) {
    return { success: false, error: 'Đơn hàng đã hết hạn thanh toán' };
  }

  const wallet = await getOrCreateWallet(tx, userId);

  if (wallet.balance < order.totalAmount) {
    return {
      success: false,
      error: `Số dư ví không đủ (Hiện có: ${wallet.balance.toLocaleString('vi-VN')}đ, cần: ${order.totalAmount.toLocaleString('vi-VN')}đ)`,
    };
  }

  // Trừ số dư ví nguyên tử
  const updateResult = await tx.userWallet.updateMany({
    where: {
      id: wallet.id,
      balance: { gte: order.totalAmount },
    },
    data: {
      balance: { decrement: order.totalAmount },
    },
  });

  if (updateResult.count !== 1) {
    return {
      success: false,
      error: 'Số dư ví đã thay đổi trong quá trình xử lý, vui lòng thử lại',
    };
  }

  // Ghi nhật ký biến động ví
  const txRecord = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: -order.totalAmount,
      type: 'PURCHASE_PAYMENT',
      orderId: order.id,
      description: `Thanh toán thành công đơn hàng ${order.orderCode}`,
    },
  });

  // Cập nhật trạng thái đơn hàng
  await tx.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
    },
  });

  // Tạo hoặc cập nhật bản ghi Transaction đối soát
  await tx.transaction.upsert({
    where: { orderId: order.id },
    update: {
      amount: order.totalAmount,
      bankName: 'SHOP_WALLET',
      bankTransId: txRecord.id,
      description: `Thanh toán qua Ví nội bộ: ${order.orderCode}`,
      verified: true,
      receivedAt: new Date(),
    },
    create: {
      orderId: order.id,
      amount: order.totalAmount,
      bankName: 'SHOP_WALLET',
      bankTransId: txRecord.id,
      description: `Thanh toán qua Ví nội bộ: ${order.orderCode}`,
      verified: true,
      receivedAt: new Date(),
    },
  });

  return {
    success: true,
    paidAmount: order.totalAmount,
    newBalance: wallet.balance - order.totalAmount,
    transactionId: txRecord.id,
  };
}

/**
 * Lấy thông tin chi tiết ví và 20 giao dịch gần nhất
 */
export async function getWalletDetails(userId: string) {
  const wallet = await getOrCreateWallet(prisma, userId);

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    id: wallet.id,
    balance: wallet.balance,
    updatedAt: wallet.updatedAt,
    transactions,
  };
}
