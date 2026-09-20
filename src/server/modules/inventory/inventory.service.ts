import type { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface OrderStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/**
 * Đặt trước / Trừ tồn kho nguyên tử cho danh sách sản phẩm trong đơn hàng (Atomic Stock Reservation)
 *
 * @param tx - Prisma Transaction Client để bảo đảm tính nhất quán (All-or-Nothing)
 * @param items - Danh sách các sản phẩm và biến thể cần trừ tồn kho
 * @returns `null` nếu tất cả mặt hàng trừ kho thành công; trả về `string` (productId hoặc variantId) bị thiếu hàng
 *
 * @security & Concurrency Invariants
 * 1. Chống bán âm kho (Overselling Prevention):
 *    - Sử dụng điều kiện nguyên tử `stock: { gte: item.quantity }` trực tiếp trong câu lệnh `updateMany`.
 *    - Nếu số lượng tồn kho hiện tại nhỏ hơn số lượng đặt mua, `result.count === 0` và hàm dừng lại ngay lập tức.
 * 2. Hỗ trợ đa biến thể (Variant & Base Product Granularity):
 *    - Nếu item có `variantId`: Trừ trực tiếp vào bảng `ProductVariant`.
 *    - Nếu item không có biến thể: Trừ vào bảng `Product`.
 * 3. Kiểm tra trạng thái hoạt động: Chỉ cho phép trừ hàng với `isActive: true`.
 * 4. Cơ chế Rollback: Khi một sản phẩm bất kỳ không đủ hàng, hàm trả về ID lỗi để transaction bên ngoài tự động Rollback toàn bộ các mặt hàng trước đó.
 */
export async function reserveOrderStock(
  tx: TransactionClient,
  items: OrderStockItem[]
): Promise<string | null> {
  for (const item of items) {
    if (item.variantId) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          productId: item.productId,
          isActive: true,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count !== 1) {
        return item.variantId;
      }
    } else {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          isActive: true,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count !== 1) {
        return item.productId;
      }
    }
  }

  return null;
}

/**
 * Hoàn trả số lượng hàng tồn kho về lại hệ thống (Inventory Restitution)
 *
 * @param tx - Prisma Transaction Client
 * @param items - Danh sách các sản phẩm và biến thể cần hoàn kho
 *
 * @invariants
 * - Được kích hoạt trong các trường hợp: Admin hủy đơn, Khách hàng hủy đơn, Đơn hàng hết hạn thanh toán (Expire), hoặc Hoàn tiền vào ví (Refund).
 * - Sử dụng phép cộng nguyên tử `stock: { increment: item.quantity }` để bảo đảm số lượng tồn kho chính xác tuyệt đối.
 */
export async function releaseOrderStock(
  tx: TransactionClient,
  items: OrderStockItem[]
): Promise<void> {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

/**
 * Tác vụ định kỳ (Cron / Background Worker) tự động quét và hủy các đơn hàng chưa thanh toán đã quá hạn.
 *
 * @param prisma - PrismaClient instance để thực thi truy vấn và transaction
 * @returns Số lượng đơn hàng đã được quét và xử lý hủy quá hạn
 *
 * @workflow & Invariants
 * 1. Nhận diện đơn quá hạn: Quét các đơn thỏa mãn đồng thời:
 *    `status === 'PENDING'`, `paymentStatus === 'UNPAID'`, và `expiresAt < now` (thường sau 15 phút khởi tạo mã VietQR).
 * 2. Cập nhật trạng thái Atomic CAS: Chuyển sang `paymentStatus: 'EXPIRED'` và `status: 'CANCELLED'`.
 * 3. Hoàn tồn kho tự động: Gọi `releaseOrderStock` để nhả hàng đã giữ về lại kho cho khách hàng khác mua.
 * 4. Thu hồi mã khuyến mại: Nếu đơn có áp dụng Coupon, giảm `usedCount: { decrement: 1 }` và xóa bản ghi `couponUsage` tương ứng.
 */
export async function expireUnpaidOrders(prisma: PrismaClient): Promise<number> {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      expiresAt: { lt: new Date() },
    },
    include: { items: true },
  });

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
        },
        data: { paymentStatus: 'EXPIRED', status: 'CANCELLED' },
      });

      if (updated.count === 1) {
        await releaseOrderStock(tx, order.items);

        // Revert coupon usage if applied
        if (order.couponId) {
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { usedCount: { decrement: 1 } },
          });

          if (order.userId) {
            await tx.couponUsage.deleteMany({
              where: {
                couponId: order.couponId,
                userId: order.userId,
                orderId: order.id,
              },
            });
          }
        }
      }
    });
  }

  return expiredOrders.length;
}
