import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCouponAvailability, getCouponSavings } from '@shared/utils/coupon';
import type { CustomerCoupon } from '@shared/types/coupon';
import { listCustomerCoupons, saveCustomerCoupon, removeCustomerCoupon } from '@server/modules/coupon/customer-coupons.service';

const now = new Date('2026-11-15T03:00:00Z');
function coupon(overrides: Partial<CustomerCoupon> = {}): CustomerCoupon {
  return {
    id: 'c1', code: 'SAVE10', description: 'Ưu đãi', discountType: 'PERCENTAGE',
    discountValue: 10, percentageRate: 10, fixedDiscountAmount: null,
    maxDiscount: '50000', minOrderAmount: '500000', startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-11-30T00:00:00Z', isActive: true, usageLimit: 100,
    usedCount: 0, perUserLimit: 1, userUsedCount: 0, saved: false, ...overrides,
  };
}

describe('Customer coupon availability and previews', () => {
  it('allows discovery before the cart meets the minimum and explains checkout shortfall', () => {
    assert.equal(getCouponAvailability(coupon(), undefined, now), null);
    assert.match(getCouponAvailability(coupon(), 400000, now)!, /100\.000/);
    assert.equal(getCouponAvailability(coupon(), 500000, now), null);
  });
  it('distinguishes expired, upcoming, disabled, exhausted and account usage limits', () => {
    assert.match(getCouponAvailability(coupon({ endDate: '2026-11-14' }), undefined, now)!, /hết hạn/);
    assert.match(getCouponAvailability(coupon({ startDate: '2026-11-16' }), undefined, now)!, /Chưa đến/);
    assert.match(getCouponAvailability(coupon({ isActive: false }), undefined, now)!, /Tạm ngừng/);
    assert.match(getCouponAvailability(coupon({ usedCount: 100 }), undefined, now)!, /Hết lượt/);
    assert.match(getCouponAvailability(coupon({ userUsedCount: 1 }), undefined, now)!, /Bạn đã dùng hết/);
  });
  it('previews canonical percentage rates, fixed amounts, caps and actual shipping', () => {
    assert.equal(getCouponSavings(coupon(), 1000000, 30000), 50000);
    assert.equal(getCouponSavings(coupon({ percentageRate: 15, maxDiscount: null }), 500001, 0), 75000);
    assert.equal(getCouponSavings(coupon({ discountType: 'FIXED', fixedDiscountAmount: '80000', discountValue: 1 }), 500000, 0), 80000);
    assert.equal(getCouponSavings(coupon({ discountType: 'FIXED', fixedDiscountAmount: '80000' }), 10000, 30000), 40000);
    assert.equal(getCouponSavings(coupon({ discountType: 'FREE_SHIPPING' }), 500000, 0), 0);
    assert.equal(getCouponSavings(coupon({ discountType: 'FREE_SHIPPING' }), 100000, 23000), 23000);
  });
});

function fakeDb() {
  const rows = [
    { ...coupon({ minOrderAmount: '0' }), isPublic: true },
    { ...coupon({ id: 'private', code: 'SECRET', minOrderAmount: '0' }), isPublic: false },
    { ...coupon({ id: 'expired', endDate: '2020-01-01', minOrderAmount: '0' }), isPublic: true },
  ].map(c => ({ ...c, startDate: new Date(c.startDate), endDate: new Date(c.endDate), minOrderAmount: BigInt(c.minOrderAmount), maxDiscount: c.maxDiscount === null ? null : BigInt(c.maxDiscount) }));
  const users = new Map([['u1', [] as string[]], ['u2', ['private', 'expired']]]);
  const db = {
    coupon: {
      findMany: async ({ where }: any) => rows.filter(c => where.id ? where.id.in.includes(c.id) : c.isPublic && c.isActive && c.startDate <= where.startDate.lte && c.endDate >= where.endDate.gte),
      findUnique: async ({ where }: any) => rows.find(c => c.id === where.id) ?? null,
    },
    user: { findUnique: async ({ where }: any) => users.has(where.id) ? { savedCouponIds: [...users.get(where.id)!] } : null },
    order: { groupBy: async () => [], count: async () => 0 },
    $executeRaw: async (sql: TemplateStringsArray, ...values: any[]) => {
      const remove = sql.join('').includes('array_remove');
      const [id, userId] = values;
      const ids = users.get(userId)!;
      if (remove) { users.set(userId, ids.filter(c => c !== id)); return 1; }
      if (ids.includes(id) || ids.length >= 100) return 0;
      users.set(userId, [...ids, id]);
      return 1;
    },
  };
  return { db: db as any, users, rows };
}

describe('Customer coupon discovery and account saves', () => {
  it('does not expose private/expired codes or account fields publicly', async () => {
    const { db } = fakeDb();
    const result = await listCustomerCoupons(null, false, db);
    assert.deepEqual(result.map(c => c.id), ['c1']);
    assert.equal(result[0].saved, false);
    assert.equal(result[0].minOrderAmount, '0');
    assert.equal('isPublic' in result[0], false);
    assert.equal('savedCouponIds' in result[0], false);
  });
  it('loads private and expired bookmarks only for their owner', async () => {
    const { db } = fakeDb();
    assert.deepEqual((await listCustomerCoupons('u2', true, db)).map(c => c.id), ['private', 'expired']);
    assert.deepEqual(await listCustomerCoupons('u1', true, db), []);
    assert.deepEqual(await listCustomerCoupons(null, true, db), []);
  });
  it('saves idempotently and preserves concurrent distinct bookmarks without consuming usage', async () => {
    const { db, users, rows } = fakeDb();
    rows.push({ ...rows[0], id: 'c2' });
    await Promise.all([saveCustomerCoupon('u1', 'c1', db), saveCustomerCoupon('u1', 'c1', db), saveCustomerCoupon('u1', 'c2', db)]);
    assert.deepEqual(users.get('u1'), ['c1', 'c2']);
    assert.equal(rows[0].usedCount, 0);
    assert.deepEqual(users.get('u2'), ['private', 'expired']);
  });
  it('rejects private, expired and missing coupons without adding bookmarks', async () => {
    const { db, users } = fakeDb();
    for (const id of ['private', 'expired', 'missing']) {
      await assert.rejects(saveCustomerCoupon('u1', id, db));
    }
    assert.deepEqual(users.get('u1'), []);
  });
  it('rejects a new save when this account has used all its redemptions', async () => {
    const { db, users } = fakeDb();
    db.order.count = async () => 1;
    await assert.rejects(saveCustomerCoupon('u1', 'c1', db), /Bạn đã dùng hết/);
    assert.deepEqual(users.get('u1'), []);
  });
  it('enforces capacity but accepts an existing save at capacity; removal is account-scoped', async () => {
    const { db, users } = fakeDb();
    users.set('u1', Array.from({ length: 100 }, (_, i) => `saved-${i}`));
    await assert.rejects(saveCustomerCoupon('u1', 'c1', db), /100/);
    users.set('u1', ['c1', ...users.get('u1')!.slice(1)]);
    await saveCustomerCoupon('u1', 'c1', db);
    await removeCustomerCoupon('u1', 'c1', db);
    assert.equal(users.get('u1')!.length, 99);
    assert.deepEqual(users.get('u2'), ['private', 'expired']);
  });
});
