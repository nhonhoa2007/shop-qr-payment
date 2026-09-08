import type { Prisma, PrismaClient } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient | PrismaClient;

export async function reserveOrderStock(
  tx: TransactionClient,
  items: { productId: string; quantity: number }[]
): Promise<string | null> {
  for (const item of items) {
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

  return null;
}

export async function releaseOrderStock(
  tx: TransactionClient,
  items: { productId: string; quantity: number }[]
): Promise<void> {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
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
      }
    });
  }

  return expiredOrders.length;
}
