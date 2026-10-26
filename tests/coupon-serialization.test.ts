import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeCouponForJson } from '@server/modules/admin/coupon-serialization';

test('serializeCouponForJson converts coupon BigInt money fields to decimal strings', () => {
  const prismaCoupon = {
    id: 'coupon-1',
    code: 'SAVE50',
    discountType: 'FIXED',
    discountValue: 50_000,
    fixedDiscountAmount: 50_000n,
    maxDiscount: null,
    minOrderAmount: 200_000n,
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    _count: { orders: 2 },
  };

  assert.throws(() => JSON.stringify(prismaCoupon), /BigInt/);

  const coupon = serializeCouponForJson(prismaCoupon);

  assert.doesNotThrow(() => JSON.stringify(coupon));
  assert.equal(coupon.discountValue, 50_000);
  assert.equal(coupon.fixedDiscountAmount, '50000');
  assert.equal(coupon.maxDiscount, null);
  assert.equal(coupon.minOrderAmount, '200000');
  assert.deepEqual(coupon._count, { orders: 2 });
});

test('serializeCouponForJson also handles the legacy BigInt discountValue shape', () => {
  const coupon = serializeCouponForJson({
    discountValue: 75_000n,
    minOrderAmount: 0n,
  });

  assert.deepEqual(coupon, {
    discountValue: '75000',
    minOrderAmount: '0',
  });
});
