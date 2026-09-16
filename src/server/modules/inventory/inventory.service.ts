import type { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export interface OrderStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export async function reserveOrderStock(
  tx: TransactionClient,
  items: OrderStockItem[]
): Promise<string | null> {
  for (const item of items) {
    if (item.variantId) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          productId: item.productId,
          isActive: true,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count !== 1) {
        return item.variantId;
      }
    } else {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          isActive: true,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count !== 1) {
        return item.productId;
      }
    }
  }

  return null;
}

export async function releaseOrderStock(
  tx: TransactionClient,
  items: OrderStockItem[]
): Promise<void> {
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
}

export async function expireUnpaidOrders(prisma: PrismaClient): Promise<number> {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      expiresAt: { lt: new Date() },
    },
    include: { items: true },
  });

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
        },
        data: { paymentStatus: 'EXPIRED', status: 'CANCELLED' },
      });

      if (updated.count === 1) {
        await releaseOrderStock(tx, order.items);

        // Revert coupon usage if applied
        if (order.couponId) {
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { usedCount: { decrement: 1 } },
          });

          if (order.userId) {
            await tx.couponUsage.deleteMany({
              where: {
                couponId: order.couponId,
                userId: order.userId,
                orderId: order.id,
              },
            });
          }
        }
      }
    });
  }

  return expiredOrders.length;
}
