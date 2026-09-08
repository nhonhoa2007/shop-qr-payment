import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDiscount,
  calculateCheckoutTotalsWithCoupon,
  STANDARD_SHIPPING_FEE,
} from '../src/lib/checkout.ts';

describe('Coupon Discount Calculations', () => {
  it('should calculate FIXED discount correctly', () => {
    const discount = calculateDiscount(
      { discountType: 'FIXED', discountValue: 50_000 },
      300_000,
      30_000
    );
    assert.equal(discount, 50_000);
  });

  it('should calculate PERCENTAGE discount correctly', () => {
    const discount = calculateDiscount(
      { discountType: 'PERCENTAGE', discountValue: 10 },
      200_000,
      30_000
    );
    assert.equal(discount, 20_000);
  });

  it('should cap PERCENTAGE discount with maxDiscount', () => {
    const discount = calculateDiscount(
      { discountType: 'PERCENTAGE', discountValue: 20, maxDiscount: 30_000 },
      300_000,
      30_000
    );
    assert.equal(discount, 30_000); // 20% of 300k is 60k, capped at 30k
  });

  it('should calculate FREE_SHIPPING discount correctly', () => {
    const discount = calculateDiscount(
      { discountType: 'FREE_SHIPPING', discountValue: 0 },
      300_000,
      STANDARD_SHIPPING_FEE
    );
    assert.equal(discount, STANDARD_SHIPPING_FEE);
  });

  it('should integrate coupon into checkout totals', () => {
    const totals = calculateCheckoutTotalsWithCoupon(400_000, {
      discountType: 'FIXED',
      discountValue: 50_000,
    });
    assert.equal(totals.subtotal, 400_000);
    assert.equal(totals.shippingFee, STANDARD_SHIPPING_FEE);
    assert.equal(totals.discountAmount, 50_000);
    assert.equal(totals.totalAmount, 400_000 + STANDARD_SHIPPING_FEE - 50_000);
  });
});
