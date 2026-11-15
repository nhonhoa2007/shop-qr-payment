import { prisma } from '@server/database/prisma';
import type { PrismaClient } from '@prisma/client';
import type { CustomerCoupon } from '@shared/types/coupon';
import { getCouponAvailability } from '@shared/utils/coupon';

type CouponDb = Pick<PrismaClient, 'coupon' | 'user' | 'order' | '$executeRaw'>;

const displayFields = {
  id: true, code: true, description: true, discountType: true, discountValue: true,
  fixedDiscountAmount: true, percentageRate: true, maxDiscount: true, minOrderAmount: true,
  usageLimit: true, usedCount: true, perUserLimit: true, startDate: true, endDate: true, isActive: true,
} as const;

export class CustomerCouponError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function listCustomerCoupons(userId: string | null, savedOnly = false, db: CouponDb = prisma): Promise<CustomerCoupon[]> {
  const user = userId ? await db.user.findUnique({ where: { id: userId }, select: { savedCouponIds: true } }) : null;
  const savedIds = user?.savedCouponIds ?? [];
  if (savedOnly && !savedIds.length) return [];
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: savedOnly
      ? { id: { in: savedIds } }
      : { isPublic: true, isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    select: displayFields,
    orderBy: [{ endDate: 'asc' }, { id: 'asc' }],
  });
  const usages = userId && coupons.length ? await db.order.groupBy({
    by: ['couponId'],
    where: { userId, couponId: { in: coupons.map(c => c.id) }, couponUsageClaimedAt: { not: null } },
    _count: { _all: true },
  }) : [];
  const counts = new Map(usages.map(usage => [usage.couponId, usage._count._all]));
  return coupons.filter(c => savedOnly || c.usedCount < c.usageLimit).map(c => ({
    id: c.id, code: c.code, description: c.description, discountType: c.discountType,
    discountValue: c.discountValue, percentageRate: c.percentageRate,
    fixedDiscountAmount: c.fixedDiscountAmount?.toString() ?? null,
    maxDiscount: c.maxDiscount?.toString() ?? null, minOrderAmount: c.minOrderAmount.toString(),
    usageLimit: c.usageLimit, usedCount: c.usedCount, perUserLimit: c.perUserLimit,
    startDate: c.startDate.toISOString(), endDate: c.endDate.toISOString(), isActive: c.isActive,
    userUsedCount: counts.get(c.id) ?? 0, saved: savedIds.includes(c.id),
  }));
}

export async function saveCustomerCoupon(userId: string, couponId: string, db: CouponDb = prisma): Promise<void> {
  const coupon = await db.coupon.findUnique({ where: { id: couponId }, select: { ...displayFields, isPublic: true } });
  if (!coupon?.isPublic) throw new CustomerCouponError('Không tìm thấy ưu đãi công khai này', 404);
  const userUsedCount = await db.order.count({ where: { userId, couponId, couponUsageClaimedAt: { not: null } } });
  const availability = getCouponAvailability({
    ...coupon, fixedDiscountAmount: coupon.fixedDiscountAmount?.toString() ?? null,
    maxDiscount: coupon.maxDiscount?.toString() ?? null, minOrderAmount: coupon.minOrderAmount.toString(),
    startDate: coupon.startDate.toISOString(), endDate: coupon.endDate.toISOString(), saved: false, userUsedCount,
  });
  if (availability) throw new CustomerCouponError(availability);
  // UPDATE rechecks its predicate after acquiring the row lock: concurrent saves
  // preserve distinct IDs, avoid duplicates, and respect the account capacity.
  const changed = await db.$executeRaw`
    UPDATE "User" SET "savedCouponIds" = array_append(
      ARRAY(SELECT saved_id FROM unnest("savedCouponIds") AS saved_id
        WHERE EXISTS (SELECT 1 FROM "Coupon" WHERE "Coupon"."id" = saved_id)),
      ${couponId}), "updatedAt" = NOW()
    WHERE "id" = ${userId} AND NOT (${couponId} = ANY("savedCouponIds"))
      AND (SELECT COUNT(*) FROM unnest("savedCouponIds") AS saved_id
        WHERE EXISTS (SELECT 1 FROM "Coupon" WHERE "Coupon"."id" = saved_id)) < 100
  `;
  if (!changed) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { savedCouponIds: true } });
    if (!user) throw new CustomerCouponError('Không tìm thấy tài khoản', 401);
    if (!user.savedCouponIds.includes(couponId)) throw new CustomerCouponError('Bạn chỉ có thể lưu tối đa 100 voucher. Hãy bỏ lưu một mã trước.');
  }
}

export async function removeCustomerCoupon(userId: string, couponId: string, db: CouponDb = prisma): Promise<void> {
  await db.$executeRaw`
    UPDATE "User" SET "savedCouponIds" = array_remove("savedCouponIds", ${couponId}), "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;
}
