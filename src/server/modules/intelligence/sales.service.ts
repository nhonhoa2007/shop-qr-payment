import { prisma as globalPrisma } from '@server/database/prisma.ts';
import type { PrismaClientOrTx } from './scoring.service.ts';
import type { SalesWindowInput, NetSalesDto } from '@shared/types/intelligence.ts';

interface RawOrderItemWithOrder {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  returnedQuantity?: number | null;
  hasUncertainReturn?: boolean | null;
  price: bigint;
  order: {
    id: string;
    status: string;
    paymentStatus?: string | null;
    completedAt: Date | null;
  };
}

export async function getNetSales(
  input: SalesWindowInput,
  db?: PrismaClientOrTx
): Promise<NetSalesDto[]> {
  const client = db || globalPrisma;
  const fromDate = typeof input.from === 'string' ? new Date(input.from) : input.from;
  const toDate = typeof input.to === 'string' ? new Date(input.to) : input.to;

  const whereClause: {
    productId: { in: string[] };
    variantId?: string | null;
    order: {
      status: string;
      completedAt: { gte: Date; lte: Date };
    };
  } = {
    productId: { in: input.productIds },
    order: {
      status: 'COMPLETED',
      completedAt: {
        gte: fromDate,
        lte: toDate,
      },
    },
  };

  if (input.variantId !== undefined) {
    whereClause.variantId = input.variantId;
  }

  // Fetch all completed order items in window
  // Using type cast for query flexibility across mock and real prisma client
  const items = (await (client as unknown as {
    orderItem: {
      findMany(args: {
        where: typeof whereClause;
        include?: { order: boolean };
      }): Promise<RawOrderItemWithOrder[]>;
    };
  }).orderItem.findMany({
    where: whereClause,
    include: { order: true },
  })) as RawOrderItemWithOrder[];

  // Group items by productId (or productId + variantId)
  const productSalesMap = new Map<
    string,
    {
      productId: string;
      variantId?: string | null;
      grossUnits: number;
      returnedUnits: number;
      grossRevenue: bigint;
      netRevenue: bigint;
      hasUncertainReturns: boolean;
    }
  >();

  // Initialize for all requested productIds
  for (const pid of input.productIds) {
    productSalesMap.set(pid, {
      productId: pid,
      variantId: input.variantId ?? null,
      grossUnits: 0,
      returnedUnits: 0,
      grossRevenue: BigInt(0),
      netRevenue: BigInt(0),
      hasUncertainReturns: false,
    });
  }

  for (const item of items) {
    const entry = productSalesMap.get(item.productId);
    if (!entry) continue;

    // Check for uncertain legacy return signal:
    // 1) Explicit item property `hasUncertainReturn`
    // 2) Order was marked REFUNDED while completed, but returnedQuantity is 0
    const hasUncertain =
      item.hasUncertainReturn === true ||
      (item.order.paymentStatus === 'REFUNDED' && (!item.returnedQuantity || item.returnedQuantity === 0));

    if (hasUncertain) {
      entry.hasUncertainReturns = true;
    }

    const grossUnits = item.quantity;
    const returnedUnits = Math.min(item.returnedQuantity ?? 0, grossUnits);
    const netUnits = Math.max(grossUnits - returnedUnits, 0);

    const unitPrice = item.price;
    const itemGrossRevenue = unitPrice * BigInt(grossUnits);
    const itemNetRevenue = unitPrice * BigInt(netUnits);

    entry.grossUnits += grossUnits;
    entry.returnedUnits += returnedUnits;
    entry.grossRevenue += itemGrossRevenue;
    entry.netRevenue += itemNetRevenue;
  }

  const results: NetSalesDto[] = [];
  for (const pid of input.productIds) {
    const data = productSalesMap.get(pid)!;
    const netUnits = Math.max(data.grossUnits - data.returnedUnits, 0);

    results.push({
      productId: data.productId,
      variantId: data.variantId,
      grossUnits: data.grossUnits,
      returnedUnits: data.returnedUnits,
      netUnits,
      grossRevenueVnd: data.grossRevenue.toString(),
      netRevenueVnd: data.netRevenue.toString(),
      status: data.hasUncertainReturns ? 'UNAVAILABLE' : 'AVAILABLE',
      hasUncertainReturns: data.hasUncertainReturns,
      window: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
    });
  }

  return results;
}
