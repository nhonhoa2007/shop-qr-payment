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