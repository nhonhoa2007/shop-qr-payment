import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateCouponUsagesToOrders,
  claimCouponForOrder,
  releaseCouponForOrder,
} from '@server/modules/coupon/coupon-compaction.service';

describe('M5 Compaction - CouponUsage to Order Claim Migration', () => {
  function createMockDb() {
    const coupons = new Map<string, any>();
    const orders = new Map<string, any>();
    const legacyUsages: any[] = [];

    const tx: any = {
      coupon: {
        findUnique: async ({ where }: any) => {
          const c = coupons.get(where.id);
          return c ? { ...c } : null;
        },
        update: async ({ where, data }: any) => {
          const c = coupons.get(where.id);
          if (!c) throw new Error('Coupon not found');
          if (data.usedCount?.increment) c.usedCount += data.usedCount.increment;
          if (data.usedCount?.decrement) c.usedCount -= data.usedCount.decrement;
          return { ...c };
        },
        updateMany: async ({ where, data }: any) => {
          const c = coupons.get(where.id);
          if (!c) return { count: 0 };
          if (where.usedCount?.lt !== undefined && c.usedCount >= where.usedCount.lt) {
            return { count: 0 };
          }
          if (data.usedCount?.increment) c.usedCount += data.usedCount.increment;
          if (data.usedCount?.decrement) c.usedCount -= data.usedCount.decrement;
          return { count: 1 };
        },
      },
      order: {
        findUnique: async ({ where }: any) => {
          const o = orders.get(where.id);
          return o ? { ...o } : null;
        },
        findMany: async ({ where }: any) => {
          return Array.from(orders.values()).filter((o) => {
            if (where.couponId && o.couponId !== where.couponId) return false;
            if (where.userId && o.userId !== where.userId) return false;
            if (where.couponUsageClaimedAt?.not === null && !o.couponUsageClaimedAt) return false;
            return true;
          });
        },
        count: async ({ where }: any) => {
          return Array.from(orders.values()).filter((o) => {
            if (where.couponId && o.couponId !== where.couponId) return false;
            if (where.userId && o.userId !== where.userId) return false;
            if (where.couponUsageClaimedAt?.not === null && !o.couponUsageClaimedAt) return false;
            return true;
          }).length;
        },
        update: async ({ where, data }: any) => {
          const o = orders.get(where.id);
          if (!o) throw new Error('Order not found');
          Object.assign(o, data);
          return { ...o };
        },
        updateMany: async ({ where, data }: any) => {
          const o = orders.get(where.id);
          if (!o) return { count: 0 };
          Object.assign(o, data);
          return { count: 1 };
        },
      },
      couponUsage: {
        findMany: async () => [...legacyUsages],
        count: async () => legacyUsages.length,
      },
      _seedCoupon: (c: any) => coupons.set(c.id, { ...c }),
      _seedOrder: (o: any) => orders.set(o.id, { ...o }),
      _seedUsage: (u: any) => legacyUsages.push({ ...u }),
    };

    return tx;
  }

  it('backfills legacy CouponUsage into Order.couponUsageClaimedAt', async () => {
    const db = createMockDb();
    const claimDate = new Date('2026-10-18T10:00:00Z');

    db._seedOrder({
      id: 'ord_1',
      userId: 'u_1',
      couponId: 'coup_10k',
      couponUsageClaimedAt: null,
    });

    db._seedUsage({
      id: 'usage_1',
      couponId: 'coup_10k',
      userId: 'u_1',
      orderId: 'ord_1',
      createdAt: claimDate,
    });

    const report = await migrateCouponUsagesToOrders(db);
    assert.equal(report.migratedCount, 1);

    const orderAfter = await db.order.findUnique({ where: { id: 'ord_1' } });
    assert.ok(orderAfter.couponUsageClaimedAt);
    assert.equal(orderAfter.couponUsageClaimedAt.toISOString(), claimDate.toISOString());

    // Rerun: idempotent
    const report2 = await migrateCouponUsagesToOrders(db);
    assert.equal(report2.migratedCount, 0);
  });

  it('claims coupon atomically respecting per-user limit and total limit', async () => {
    const db = createMockDb();
    db._seedCoupon({
      id: 'coup_limited',
      code: 'VIP50',
      usedCount: 0,
      usageLimit: 2,
      perUserLimit: 1,
      isActive: true,
    });

    db._seedOrder({
      id: 'ord_test_1',
      userId: 'user_a',
      couponId: 'coup_limited',
      couponUsageClaimedAt: null,
    });

    db._seedOrder({
      id: 'ord_test_2',
      userId: 'user_a',
      couponId: 'coup_limited',
      couponUsageClaimedAt: null,
    });

    // 1. First claim by user_a -> Success
    const claim1 = await claimCouponForOrder(db, {
      couponId: 'coup_limited',
      orderId: 'ord_test_1',
      userId: 'user_a',
    });
    assert.equal(claim1.success, true);

    const coupAfter1 = await db.coupon.findUnique({ where: { id: 'coup_limited' } });
    assert.equal(coupAfter1.usedCount, 1);

    // 2. Second claim by same user_a -> Rejected (perUserLimit = 1)
    const claim2 = await claimCouponForOrder(db, {
      couponId: 'coup_limited',
      orderId: 'ord_test_2',
      userId: 'user_a',
    });
    assert.equal(claim2.success, false);
    assert.match(claim2.error || '', /giới hạn lượt dùng/i);
  });

  it('releases coupon on cancellation or expiration', async () => {
    const db = createMockDb();
    db._seedCoupon({
      id: 'coup_release_test',
      usedCount: 1,
      usageLimit: 10,
    });

    db._seedOrder({
      id: 'ord_cancel_1',
      userId: 'u_1',
      couponId: 'coup_release_test',
      couponUsageClaimedAt: new Date(),
    });

    await releaseCouponForOrder(db, 'ord_cancel_1');

    const orderAfter = await db.order.findUnique({ where: { id: 'ord_cancel_1' } });
    assert.equal(orderAfter.couponUsageClaimedAt, null);

    const coupAfter = await db.coupon.findUnique({ where: { id: 'coup_release_test' } });
    assert.equal(coupAfter.usedCount, 0);
  });
});
