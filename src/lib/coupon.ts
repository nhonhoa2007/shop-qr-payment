import { prisma } from './prisma';

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    maxDiscount: number | null;
    minOrderAmount: number;
  };
}

/**
 * Thẩm định tính hợp lệ và điều kiện áp dụng mã giảm giá (Voucher Validation Engine)
 *
 * @param code - Mã khuyến mãi do người dùng nhập vào (sẽ được trim và uppercase)
 * @param userId - ID người dùng hiện tại (nếu là khách vãng lai thì truyền `null`)
 * @param subtotal - Tổng giá trị tiền hàng của đơn trước khi áp mã
 * @returns `CouponValidationResult` chứa trạng thái `valid: boolean`, thông báo lỗi (nếu có) và chi tiết mức giảm
 *
 * @business Rules & Constraints
 * 1. Trạng thái kích hoạt: Mã phải tồn tại và có `isActive: true`.
 * 2. Hiệu lực thời gian: Thời điểm hiện tại `now` phải nằm trong khoảng `startDate <= now <= endDate`.
 * 3. Hạn mức toàn hệ thống: Số lượt đã dùng `userUsages` không được vượt quá tổng hạn mức `usageLimit`.
 * 4. Ngưỡng giá trị đơn tối thiểu: `subtotal >= minOrderAmount`.
 * 5. Hạn mức theo từng tài khoản: Nếu đã đăng nhập (`userId` khác null), kiểm tra số lần tài khoản này
 *    đã dùng mã không vượt quá `perUserLimit` (thường là 1 lần/người).
 */
export async function validateCoupon(
  code: string,
  userId: string | null,
  subtotal: number
): Promise<CouponValidationResult> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { _count: { select: { userUsages: true } } },
  });

  if (!coupon || !coupon.isActive) {
    return { valid: false, error: 'Mã giảm giá không tồn tại hoặc đã vô hiệu' };
  }

  const now = new Date();
  if (now < coupon.startDate || now > coupon.endDate) {
    return { valid: false, error: 'Mã giảm giá chưa hoặc đã hết hạn sử dụng' };
  }

  if (coupon._count.userUsages >= coupon.usageLimit) {
    return { valid: false, error: 'Mã giảm giá đã hết lượt sử dụng' };
  }

  if (subtotal < coupon.minOrderAmount) {
    return { valid: false, error: `Đơn hàng tối thiểu để áp dụng mã này là ${coupon.minOrderAmount.toLocaleString('vi-VN')}đ` };
  }

  if (userId) {
    const usageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (usageCount >= coupon.perUserLimit) {
      return { valid: false, error: 'Bạn đã sử dụng hết lượt mã giảm giá này' };
    }
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      minOrderAmount: coupon.minOrderAmount,
    },
  };
}