export interface ClaimCouponInput {
  couponId: string;
  orderId: string;
  userId: string;
}

export async function migrateCouponUsagesToOrders(
  tx: any
): Promise<{ migratedCount: number; skippedCount: number }> {
  let migratedCount = 0;
  let skippedCount = 0;

  if (!('couponUsage' in tx) || typeof (tx as any).couponUsage?.findMany !== 'function') {
    return { migratedCount: 0, skippedCount: 0 };
  }

  const legacyUsages = await tx.couponUsage.findMany();

  for (const usage of legacyUsages) {
    const order = await tx.order.findUnique({
      where: { id: usage.orderId },
    });

    if (order && !order.couponUsageClaimedAt) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          couponId: usage.couponId,
          couponUsageClaimedAt: usage.createdAt,
        },
      });
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  return { migratedCount, skippedCount };
}

export async function claimCouponForOrder(
  tx: any,
  input: ClaimCouponInput
): Promise<{ success: boolean; error?: string }> {
  const coupon = await tx.coupon.findUnique({
    where: { id: input.couponId },
  });

  if (!coupon || !coupon.isActive) {
    return { success: false, error: 'Mã giảm giá không tồn tại hoặc đã hết hiệu lực' };
  }

  // 1. Total usage limit check
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { success: false, error: 'Mã giảm giá đã hết lượt sử dụng' };
  }

  // 2. Per-user limit check: count valid claimed orders
  if (coupon.perUserLimit !== null) {
    const userClaimCount = await tx.order.count({
      where: {
        couponId: input.couponId,
        userId: input.userId,
        couponUsageClaimedAt: { not: null },
      },
    });

    if (userClaimCount >= coupon.perUserLimit) {
      return { success: false, error: 'Bạn đã đạt giới hạn lượt dùng mã giảm giá này' };
    }
  }

  // 3. Atomic increment usedCount with CAS condition
  const updateResult = await tx.coupon.updateMany({
    where: {
      id: input.couponId,
      isActive: true,
      ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
    },
    data: {
      usedCount: { increment: 1 },
    },
  });

  if (updateResult.count !== 1) {
    return { success: false, error: 'Mã giảm giá vừa hết lượt sử dụng đồng thời' };
  }

  // 4. Update order with claim timestamp
  await tx.order.update({
    where: { id: input.orderId },
    data: {
      couponId: input.couponId,
      couponUsageClaimedAt: new Date(),
    },
  });

  return { success: true };
}

export async function releaseCouponForOrder(tx: any, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
  });

  if (!order || !order.couponId || !order.couponUsageClaimedAt) {
    return;
  }

  // Atomic decrement of usedCount
  await tx.coupon.update({
    where: { id: order.couponId },
    data: {
      usedCount: { decrement: 1 },
    },
  });

  // Clear claim timestamp
  await tx.order.update({
    where: { id: order.id },
    data: {
      couponUsageClaimedAt: null,
    },
  });
}
