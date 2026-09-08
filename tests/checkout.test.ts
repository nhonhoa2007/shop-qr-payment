import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCheckoutTotals, FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from '../src/lib/checkout.ts';

describe('Checkout Calculation Logic', () => {
  it('should add standard shipping fee when subtotal is below threshold', () => {
    const totals = calculateCheckoutTotals(200_000);
    assert.equal(totals.subtotal, 200_000);
    assert.equal(totals.shippingFee, STANDARD_SHIPPING_FEE);
    assert.equal(totals.totalAmount, 200_000 + STANDARD_SHIPPING_FEE);
  });

  it('should apply free shipping when subtotal equals or exceeds threshold', () => {
    const totalsEqual = calculateCheckoutTotals(FREE_SHIPPING_THRESHOLD);
    assert.equal(totalsEqual.subtotal, FREE_SHIPPING_THRESHOLD);
    assert.equal(totalsEqual.shippingFee, 0);
    assert.equal(totalsEqual.totalAmount, FREE_SHIPPING_THRESHOLD);

    const totalsExceed = calculateCheckoutTotals(FREE_SHIPPING_THRESHOLD + 100_000);
    assert.equal(totalsExceed.shippingFee, 0);
    assert.equal(totalsExceed.totalAmount, FREE_SHIPPING_THRESHOLD + 100_000);
  });

  it('should handle zero and negative subtotal safely', () => {
    const totalsZero = calculateCheckoutTotals(0);
    assert.equal(totalsZero.subtotal, 0);
    assert.equal(totalsZero.shippingFee, STANDARD_SHIPPING_FEE);
    assert.equal(totalsZero.totalAmount, STANDARD_SHIPPING_FEE);

    const totalsNegative = calculateCheckoutTotals(-50_000);
    assert.equal(totalsNegative.subtotal, 0);
    assert.equal(totalsNegative.shippingFee, STANDARD_SHIPPING_FEE);
  });
});
