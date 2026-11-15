import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '@server/database/prisma';
import { listCustomerCoupons, saveCustomerCoupon, removeCustomerCoupon } from '@server/modules/coupon/customer-coupons.service';
import { validateCoupon } from '@server/modules/admin/coupon.service';
import { serializeCouponDto } from '@server/modules/money/money-serialization';

it('PostgreSQL: concurrent saves, stale bookmarks, isolation and private direct entry', { skip: process.env.COUPON_DATABASE_TEST !== '1' }, async () => {
  const prefix = `coupon-test-${randomUUID()}`;
  const user = await prisma.user.create({ data: { email: `${prefix}@example.invalid`, passwordHash: 'test-fixture' } });
  try {
    await prisma.coupon.createMany({ data: Array.from({ length: 102 }, (_, i) => ({
      id: `${prefix}-${i}`, code: `${prefix}-${i}`.toUpperCase(), discountType: 'FIXED' as const,
      discountValue: 10000, fixedDiscountAmount: 20000n, minOrderAmount: 0n,
      startDate: new Date(Date.now() - 60000), endDate: new Date(Date.now() + 3600000),
      isPublic: i !== 101,
    })) });
    await Promise.all(Array.from({ length: 15 }, (_, i) => saveCustomerCoupon(user.id, `${prefix}-${i % 10}`)));
    let saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(saved.savedCouponIds.length, 10);
    assert.equal(new Set(saved.savedCouponIds).size, 10);
    assert.equal(await prisma.coupon.count({ where: { id: { startsWith: prefix }, usedCount: { not: 0 } } }), 0);
    await prisma.user.update({ where: { id: user.id }, data: { savedCouponIds: Array.from({ length: 100 }, (_, i) => `${prefix}-${i}`) } });
    await assert.rejects(saveCustomerCoupon(user.id, `${prefix}-100`), /100/);
    await prisma.coupon.delete({ where: { id: `${prefix}-0` } });
    assert.equal((await listCustomerCoupons(user.id, true)).length, 99);
    await saveCustomerCoupon(user.id, `${prefix}-100`);
    saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(saved.savedCouponIds.length, 100);
    assert.equal(saved.savedCouponIds.includes(`${prefix}-0`), false);
    await removeCustomerCoupon(user.id, `${prefix}-100`);
    assert.equal((await listCustomerCoupons(user.id, true)).length, 99);
    assert.equal((await listCustomerCoupons(null)).some(c => c.id === `${prefix}-101`), false);
    await assert.rejects(saveCustomerCoupon(user.id, `${prefix}-101`));
    const validated = await validateCoupon(`${prefix}-101`, user.id, 100000);
    assert.equal(validated.valid, true);
    assert.ok(validated.coupon);
    assert.equal(serializeCouponDto(validated.coupon).fixedDiscountAmount, '20000');
    assert.doesNotThrow(() => JSON.stringify(serializeCouponDto(validated.coupon!)));
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.coupon.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
