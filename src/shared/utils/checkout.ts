export const FREE_SHIPPING_THRESHOLD = 500_000;
export const STANDARD_SHIPPING_FEE = 30_000;
export const FREE_SHIPPING_THRESHOLD_BIGINT = BigInt(500_000);
export const STANDARD_SHIPPING_FEE_BIGINT = BigInt(30_000);

export interface CheckoutTotals {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
}

export interface CheckoutTotalsBigInt {
  subtotal: bigint;
  shippingFee: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
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

export function calculateCheckoutTotalsBigInt(
  subtotal: bigint,
  shippingFeeOverride?: bigint | null
): CheckoutTotalsBigInt {
  const safeSubtotal = subtotal < BigInt(0) ? BigInt(0) : subtotal;
  const shippingFee =
    shippingFeeOverride != null
      ? shippingFeeOverride
      : safeSubtotal >= FREE_SHIPPING_THRESHOLD_BIGINT
        ? BigInt(0)
        : STANDARD_SHIPPING_FEE_BIGINT;

  return {
    subtotal: safeSubtotal,
    shippingFee,
    discountAmount: BigInt(0),
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
      discountAmount = Math.floor((subtotal * coupon.discountValue) / 100);
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

export function calculateDiscountBigInt(
  coupon: {
    discountType: string;
    discountValue?: number | bigint;
    fixedDiscountAmount?: bigint | null;
    percentageRate?: number | null;
    maxDiscount?: bigint | number | null;
  },
  subtotal: bigint,
  shippingFee: bigint,
): bigint {
  let discountAmount = BigInt(0);

  switch (coupon.discountType) {
    case 'FIXED':
      if (coupon.fixedDiscountAmount != null) {
        discountAmount = BigInt(coupon.fixedDiscountAmount);
      } else if (coupon.discountValue != null) {
        discountAmount = BigInt(coupon.discountValue);
      }
      break;
    case 'PERCENTAGE':
      const rate = BigInt(coupon.percentageRate ?? coupon.discountValue ?? 0);
      discountAmount = (subtotal * rate) / BigInt(100); // integer floor
      if (coupon.maxDiscount != null && BigInt(coupon.maxDiscount) > BigInt(0)) {
        const max = BigInt(coupon.maxDiscount);
        if (discountAmount > max) {
          discountAmount = max;
        }
      }
      break;
    case 'FREE_SHIPPING':
      discountAmount = shippingFee;
      break;
  }

  if (discountAmount < BigInt(0)) return BigInt(0);
  if (discountAmount > subtotal + shippingFee) {
    return subtotal + shippingFee;
  }
  return discountAmount;
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
