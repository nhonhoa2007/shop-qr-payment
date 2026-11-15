import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Keep validation and response serialization real; replace authentication and database I/O.
const modules = new Map([
  ['next-auth', `export async function getServerSession() { return { user: { role: 'ADMIN' } }; }`],
  ['@server/modules/auth/auth-options', `export const authOptions = {};`],
  ['@server/database/prisma', `export const prisma = { coupon: { async create({ data }) {
    return { id: 'coupon-1', usedCount: 0, ...data,
      minOrderAmount: BigInt(data.minOrderAmount),
      maxDiscount: data.maxDiscount == null ? null : BigInt(data.maxDiscount) };
  } } };`],
]);

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const source = context.parentURL?.endsWith('/coupons.controller.ts') ? modules.get(specifier) : undefined;
  return source
    ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
    : nextResolve(specifier, context);
} });
const { POST } = await import('@server/modules/admin/coupons.controller');
hooks.deregister();

function createCoupon(overrides: Record<string, unknown> = {}) {
  return POST(new Request('http://localhost/api/admin/coupons', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: ' save20 ', discountType: 'FIXED', discountValue: 20000,
      minOrderAmount: 100000, maxDiscount: null, usageLimit: 100, perUserLimit: 1,
      startDate: '2026-11-15', endDate: '2026-12-15', isPublic: false, ...overrides }),
  }));
}

test('creates a free-shipping coupon with zero discount value', async () => {
  const response = await createCoupon({ discountType: 'FREE_SHIPPING', discountValue: 0 });
  assert.equal(response.status, 201);
  const coupon = await response.json();
  assert.equal(coupon.discountType, 'FREE_SHIPPING');
  assert.equal(coupon.discountValue, 0);
  assert.equal(coupon.code, 'SAVE20');
  assert.equal(coupon.minOrderAmount, '100000');
});

test('creates fixed and percentage coupons with canonical discount fields', async () => {
  const fixedResponse = await createCoupon();
  assert.equal(fixedResponse.status, 201);
  const fixed = await fixedResponse.json();
  assert.equal(fixed.fixedDiscountAmount, '20000');
  assert.equal(fixed.percentageRate, null);

  const percentageResponse = await createCoupon({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 50000 });
  assert.equal(percentageResponse.status, 201);
  const percentage = await percentageResponse.json();
  assert.equal(percentage.percentageRate, 15);
  assert.equal(percentage.fixedDiscountAmount, null);
  assert.equal(percentage.maxDiscount, '50000');
});

test('rejects invalid coupon fields with actionable errors before writing', async () => {
  for (const [input, expected] of [
    [{ code: '   ' }, /mã giảm giá/i],
    [{ discountType: 'UNKNOWN' }, /loại giảm giá/i],
    [{ discountValue: 0 }, /mức giảm/i],
    [{ discountValue: 1.5 }, /mức giảm/i],
    [{ discountType: 'PERCENTAGE', discountValue: 101 }, /100/],
    [{ discountType: 'FREE_SHIPPING', discountValue: -1 }, /mức giảm/i],
    [{ minOrderAmount: -1 }, /đơn tối thiểu/i],
    [{ maxDiscount: -1 }, /giảm tối đa/i],
    [{ usageLimit: -1 }, /lượt/i],
    [{ perUserLimit: 0 }, /lượt/i],
    [{ startDate: '' }, /ngày/i],
    [{ endDate: 'invalid' }, /ngày/i],
    [{ endDate: '2026-11-14' }, /ngày/i],
    [{ isPublic: 'true' }, /trạng thái/i],
  ] as const) {
    const response = await createCoupon(input);
    assert.equal(response.status, 400, JSON.stringify(input));
    const body = await response.json();
    assert.match(body.error, expected);
    assert.equal(body.id, undefined);
  }
});
