import type { CustomerCoupon } from '@shared/types/coupon';
import { calculateDiscountBigInt } from '@shared/utils/checkout';

export function getCouponAvailability(coupon: CustomerCoupon, subtotal?: number, now = new Date()): string | null {
  if (!coupon.isActive) return 'Tạm ngừng áp dụng';
  if (now < new Date(coupon.startDate)) return 'Chưa đến thời gian áp dụng';
  if (now > new Date(coupon.endDate)) return 'Đã hết hạn';
  if (coupon.usedCount >= coupon.usageLimit) return 'Hết lượt sử dụng';
  if (coupon.userUsedCount >= coupon.perUserLimit) return 'Bạn đã dùng hết lượt';
  if (subtotal !== undefined && BigInt(Math.max(0, Math.floor(subtotal))) < BigInt(coupon.minOrderAmount)) {
    const shortfall = BigInt(coupon.minOrderAmount) - BigInt(Math.max(0, Math.floor(subtotal)));
    return `Mua thêm ${shortfall.toLocaleString('vi-VN')}đ để sử dụng`;
  }
  return null;
}

export function getCouponSavings(coupon: CustomerCoupon, subtotal: number, shippingFee: number): number {
  return Number(calculateDiscountBigInt({
    ...coupon,
    fixedDiscountAmount: coupon.fixedDiscountAmount === null ? null : BigInt(coupon.fixedDiscountAmount),
    maxDiscount: coupon.maxDiscount === null ? null : BigInt(coupon.maxDiscount),
  }, BigInt(Math.max(0, Math.floor(subtotal))), BigInt(Math.max(0, Math.floor(shippingFee)))));
}

export function getCouponTitle(coupon: CustomerCoupon): string {
  if (coupon.discountType === 'FREE_SHIPPING') return 'Miễn phí vận chuyển';
  if (coupon.discountType === 'PERCENTAGE') return `Giảm ${coupon.percentageRate ?? coupon.discountValue}%`;
  return `Giảm ${BigInt(coupon.fixedDiscountAmount ?? coupon.discountValue).toLocaleString('vi-VN')}đ`;
}
