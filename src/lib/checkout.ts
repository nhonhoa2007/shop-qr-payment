export const FREE_SHIPPING_THRESHOLD = 500_000;
export const STANDARD_SHIPPING_FEE = 30_000;

export interface CheckoutTotals {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
}

export function calculateCheckoutTotals(subtotal: number): CheckoutTotals {
  const safeSubtotal = Math.max(0, Math.round(subtotal));
  const shippingFee = safeSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;

  return {
    subtotal: safeSubtotal,
    shippingFee,
    discountAmount: 0,
    totalAmount: safeSubtotal + shippingFee,
  };
}

export function calculateDiscount(
  coupon: { discountType: string; discountValue: number; maxDiscount?: number | null },
  subtotal: number,
  shippingFee: number,
): number {
  let discountAmount = 0;

  switch (coupon.discountType) {
    case 'FIXED':
      discountAmount = coupon.discountValue;
      break;
    case 'PERCENTAGE':
      discountAmount = Math.round(subtotal * coupon.discountValue / 100);
      if (coupon.maxDiscount != null && coupon.maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
      break;
    case 'FREE_SHIPPING':
      discountAmount = shippingFee;
      break;
  }

  return Math.max(0, discountAmount);
}

export function calculateCheckoutTotalsWithCoupon(
  subtotal: number,
  coupon?: { discountType: string; discountValue: number; maxDiscount?: number | null } | null,
): CheckoutTotals {
  const base = calculateCheckoutTotals(subtotal);
  const discountAmount = coupon
    ? calculateDiscount(coupon, base.subtotal, base.shippingFee)
    : 0;

  return {
    subtotal: base.subtotal,
    shippingFee: base.shippingFee,
    discountAmount,
    totalAmount: Math.max(0, base.subtotal + base.shippingFee - discountAmount),
  };
}
