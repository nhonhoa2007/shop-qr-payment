import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../database/prisma.ts';
import { releaseOrderStock } from '../inventory/inventory.service.ts';
import { serializeMoneyVnd } from '@shared/utils/money';
import { serializeWalletDto } from '@server/modules/money/money-serialization';
import type { MoneyVnd } from '@shared/types/money';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface WalletOperationResult {
  success: boolean;
  error?: string;
  refundedAmount?: MoneyVnd | number;
  paidAmount?: MoneyVnd | number;
  newBalance?: MoneyVnd | number;
  transactionId?: string;
  isGuest?: boolean;
}

/**
 * Lấy thông tin ví hoặc tự động khởi tạo ví mới nếu người dùng chưa có ví trong hệ thống.
 *
 * @param tx - Prisma Transaction Client hoặc PrismaClient instance
 * @param userId - Định danh duy nhất (UUID/CUID) của người dùng
 * @returns Bản ghi ví người dùng (`UserWallet`) với số dư khởi tạo = 0đ nếu mới tạo
 *
 * @invariants
 * - Tính duy nhất: 1 User chỉ sở hữu tối đa 1 Ví (`userId` có ràng buộc `@unique`).
 * - Khởi tạo an toàn: Nếu chưa tồn tại, ví được tạo tự động với balance = 0 trong cùng transaction.
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
 * Động cơ hoàn tiền đơn hàng vào ví nội bộ (Refund Engine)
 *
 * @param tx - Prisma Transaction Client để bảo toàn tính toàn vẹn ACID
 * @param orderId - Định danh đơn hàng cần hoàn tiền
 * @param reason - Lý do hoàn tiền (tùy chọn, mặc định: "Hoàn tiền 100% cho đơn hàng...")
 * @returns `WalletOperationResult` chứa kết quả hoàn tiền, số tiền hoàn, số dư mới và mã giao dịch ví
 *
 * @security & Invariants
 * 1. Chống Double-Refund (Race Condition Guard):
 *    - Sử dụng mô hình **Atomic Compare-And-Swap (CAS)** qua `tx.order.updateMany` với điều kiện `{ id, paymentStatus: 'PAID' }`.
 *    - Nếu có 2 luồng hoàn tiền chạy song song, chỉ duy nhất 1 luồng cập nhật được (count === 1). Luồng còn lại nhận count === 0 và bị từ chối ngay lập tức.
 * 2. Bảo toàn hàng tồn kho (Inventory Restitution - QA-01):
 *    - Tự động gọi `releaseOrderStock(tx, order.items)` để hoàn trả số lượng sản phẩm/biến thể về kho.
 * 3. Hạch toán số dư nguyên tử (Atomic Balance Accounting):
 *    - Sử dụng `balance: { increment: order.totalAmount }` đảm bảo số dư không bị ghi đè dưới tải cao.
 *    - Ghi nhận lịch sử giao dịch loại `REFUND` phục vụ đối soát tài chính.
 * 4. Phân luồng khách hàng:
 *    - Thành viên đăng ký (`order.userId` tồn tại): Tiền được nạp trực tiếp vào ví người dùng.
 *    - Khách vãng lai (`order.userId === null`): Trả về cờ `isGuest: true` để kế toán/admin xử lý hoàn tiền mặt/ngân hàng.
 */
export async function refundOrderToWallet(
  tx: TransactionClient,
  orderId: string,
  reason?: string
): Promise<WalletOperationResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
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
  if (order.status === 'CANCELLED') return { success: false, error: 'Đơn hàng đã được hủy trước đó' };

  // Guard against double-refund using Atomic CAS with tx.order.updateMany
  const updateResult = await tx.order.updateMany({
    where: {
      id: order.id,
      paymentStatus: 'PAID',
      status: { not: 'CANCELLED' },
    },
    data: {
      paymentStatus: order.userId ? 'REFUNDED' : 'PAID',
      status: 'CANCELLED',
    },
  });

  if (updateResult.count !== 1) {
    return { success: false, error: 'Đơn hàng đã được xử lý hoàn tiền hoặc không ở trạng thái hợp lệ' };
  }

  // Release order stock
  if (order.items && order.items.length > 0) {
    await releaseOrderStock(tx, order.items);
  }
  if (order.couponId) {
    await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: 1 } } });
    if (order.userId) await tx.couponUsage.deleteMany({ where: { couponId: order.couponId, orderId: order.id, userId: order.userId } });
  }

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
      refundedAmount: serializeMoneyVnd(BigInt(order.totalAmount)),
      newBalance: serializeMoneyVnd(BigInt(updatedWallet.balance)),
      transactionId: txRecord.id,
    };
  }

  // Khách vãng lai (không có tài khoản đăng nhập)
  await tx.refundCase.upsert({
    where: { sourceKey: `order:${order.id}` },
    create: { sourceKey: `order:${order.id}`, orderId: order.id, amount: BigInt(order.totalAmount), reason: reason || 'Đơn đã thanh toán bị hủy; cần hoàn tiền cho khách vãng lai' },
    update: {},
  });
  return {
    success: true,
    refundedAmount: serializeMoneyVnd(BigInt(order.totalAmount)),
    isGuest: true,
  };
}

/**
 * Thanh toán đơn hàng trực tiếp bằng số dư ví nội bộ (Wallet Payment Engine)
 *
 * @param tx - Prisma Transaction Client để bảo đảm tính nguyên tử ACID
 * @param userId - ID người dùng sở hữu ví thực hiện thanh toán
 * @param orderId - ID đơn hàng cần thanh toán
 * @returns `WalletOperationResult` chứa kết quả thanh toán, số tiền đã trừ, số dư còn lại và mã giao dịch ví
 *
 * @security & Invariants
 * 1. Quyền sở hữu (Authorization Guard): Chặn người dùng thanh toán đơn hàng thuộc về tài khoản khác.
 * 2. Vòng đời đơn hàng (Order State Guards):
 *    - Chặn thanh toán đơn đã `PAID` (tránh trừ tiền 2 lần).
 *    - Chặn thanh toán đơn đã `CANCELLED` hoặc quá hạn thanh toán (`expiresAt < now`).
 * 3. Trừ tiền nguyên tử an toàn (Atomic CAS Balance Deduction):
 *    - Kiểm tra số dư hiện tại `wallet.balance >= order.totalAmount`.
 *    - Thực thi trừ tiền qua `updateMany` với điều kiện bảo vệ `balance: { gte: order.totalAmount }`.
 *    - Nếu có tranh chấp đồng thời khiến số dư không còn đủ, thao tác rollback và báo lỗi ngay.
 * 4. Kép khóa trạng thái đơn hàng (Order CAS Transition):
 *    - Cập nhật đơn hàng sang `paymentStatus: 'PAID'` và `status: 'CONFIRMED'` với guard `paymentStatus: 'UNPAID'`.
 * 5. Kép ghi sổ đối soát: Ghi nhận đồng thời `WalletTransaction` (loại `PAYMENT`) và `Transaction` đơn hàng.
 */
export async function payOrderWithWallet(
  tx: TransactionClient,
  userId: string,
  orderId: string,
  now?: Date
): Promise<WalletOperationResult> {
  const currentTime = now || new Date();
  const order = await tx.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return { success: false, error: 'Không tìm thấy đơn hàng' };
  }

  if (order.userId !== userId) {
    return { success: false, error: 'Bạn không có quyền thanh toán đơn hàng này' };
  }

  if (order.paymentStatus === 'PAID') {
    return { success: false, error: 'Đơn hàng này đã được thanh toán' };
  }

  if (order.status === 'CANCELLED') {
    return { success: false, error: 'Đơn hàng đã bị hủy, không thể thanh toán' };
  }

  if (order.expiresAt <= currentTime) {
    return { success: false, error: 'Đơn hàng đã hết hạn thanh toán' };
  }

  const wallet = await getOrCreateWallet(tx, userId);
  const orderAmountBigInt = BigInt(order.totalAmount);

  if (wallet.balance < orderAmountBigInt) {
    return {
      success: false,
      error: `Số dư ví không đủ (Hiện có: ${Number(wallet.balance).toLocaleString('vi-VN')}đ, cần: ${Number(order.totalAmount).toLocaleString('vi-VN')}đ)`,
    };
  }

  // 1. Khóa trạng thái đơn hàng nguyên tử qua CAS
  const orderClaim = await tx.order.updateMany({
    where: {
      id: order.id,
      userId,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      expiresAt: { gt: currentTime },
    },
    data: {
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
    },
  });

  if (orderClaim.count !== 1) {
    return {
      success: false,
      error: 'Đơn hàng không ở trạng thái hợp lệ hoặc đã được xử lý bởi giao dịch khác',
    };
  }

  // 2. Trừ số dư ví nguyên tử (nếu thất bại vì số dư thay đổi giữa lúc check và decrement, throw để rollback order claim)
  const updateResult = await tx.userWallet.updateMany({
    where: {
      id: wallet.id,
      balance: { gte: orderAmountBigInt },
    },
    data: {
      balance: { decrement: orderAmountBigInt },
    },
  });

  if (updateResult.count !== 1) {
    throw new Error('Số dư ví đã thay đổi trong quá trình xử lý, vui lòng thử lại');
  }

  // 3. Ghi nhật ký biến động ví
  const txRecord = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: -orderAmountBigInt,
      type: 'PURCHASE_PAYMENT',
      orderId: order.id,
      description: `Thanh toán thành công đơn hàng ${order.orderCode}`,
    },
  });

  // 4. Tạo bản ghi Transaction đối soát
  await tx.transaction.create({
    data: {
      orderId: order.id,
      amount: orderAmountBigInt,
      bankName: 'SHOP_WALLET',
      bankTransId: txRecord.id,
      description: `Thanh toán qua Ví nội bộ: ${order.orderCode}`,
      verified: true,
      receivedAt: currentTime,
    },
  });

  const remainingBalance = BigInt(wallet.balance) - orderAmountBigInt;
  return {
    success: true,
    paidAmount: serializeMoneyVnd(orderAmountBigInt),
    newBalance: serializeMoneyVnd(remainingBalance),
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

  return serializeWalletDto({
    id: wallet.id,
    balance: wallet.balance,
    updatedAt: wallet.updatedAt,
    transactions,
  });
}
