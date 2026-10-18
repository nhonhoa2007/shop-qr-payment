import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNetSales } from '../src/server/modules/intelligence/sales.service.ts';
import type { PrismaClientOrTx } from '../src/server/modules/intelligence/scoring.service.ts';

describe('Commerce Intelligence: Net Sales Calculation with Completed Window', () => {
  it('calculates net sales strictly from COMPLETED orders within the completedAt window', async () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-15T23:59:59.999Z');

    const mockDb = {
      orderItem: {
        async findMany(args: {
          where: {
            productId: { in: string[] };
            order: {
              status: string;
              completedAt: { gte: Date; lte: Date };
            };
          };
          include?: { order: boolean };
        }) {
          assert.equal(args.where.order.status, 'COMPLETED');
          assert.deepEqual(args.where.order.completedAt.gte, from);
          assert.deepEqual(args.where.order.completedAt.lte, to);

          return [
            {
              id: 'item_1',
              orderId: 'ord_completed_1',
              productId: 'prod_macbook_pro',
              variantId: 'var_m3_16gb',
              quantity: 2,
              price: BigInt(35_000_000), // 35M VND each
              order: {
                id: 'ord_completed_1',
                status: 'COMPLETED',
                completedAt: new Date('2026-10-05T10:00:00.000Z'),
              },
            },
            {
              id: 'item_2',
              orderId: 'ord_completed_2',
              productId: 'prod_macbook_pro',
              variantId: 'var_m3_32gb',
              quantity: 1,
              price: BigInt(45_000_000), // 45M VND
              order: {
                id: 'ord_completed_2',
                status: 'COMPLETED',
                completedAt: new Date('2026-10-10T14:30:00.000Z'),
              },
            },
          ];
        },
      },
    };

    const results = await getNetSales(
      {
        productIds: ['prod_macbook_pro'],
        from,
        to,
      },
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(results.length, 1);
    const macSales = results[0];
    assert.equal(macSales.productId, 'prod_macbook_pro');
    assert.equal(macSales.status, 'AVAILABLE');
    assert.equal(macSales.grossUnits, 3);
    assert.equal(macSales.returnedUnits, 0);
    assert.equal(macSales.netUnits, 3);
    assert.equal(macSales.grossRevenueVnd, '115000000'); // (2 * 35M) + (1 * 45M) = 115M
    assert.equal(macSales.netRevenueVnd, '115000000');
    assert.equal(macSales.hasUncertainReturns, false);
  });

  it('deducts resolved returned quantities from gross units and revenue', async () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-15T23:59:59.999Z');

    const mockDb = {
      orderItem: {
        async findMany() {
          return [
            {
              id: 'item_1',
              orderId: 'ord_1',
              productId: 'prod_phone',
              variantId: null,
              quantity: 5,
              returnedQuantity: 2, // 2 units returned
              price: BigInt(10_000_000), // 10M VND each
              order: {
                id: 'ord_1',
                status: 'COMPLETED',
                completedAt: new Date('2026-10-08T09:00:00.000Z'),
              },
            },
          ];
        },
      },
    };

    const results = await getNetSales(
      {
        productIds: ['prod_phone'],
        from,
        to,
      },
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(results.length, 1);
    const phoneSales = results[0];
    assert.equal(phoneSales.grossUnits, 5);
    assert.equal(phoneSales.returnedUnits, 2);
    assert.equal(phoneSales.netUnits, 3);
    assert.equal(phoneSales.grossRevenueVnd, '50000000');
    assert.equal(phoneSales.netRevenueVnd, '30000000');
    assert.equal(phoneSales.status, 'AVAILABLE');
  });

  it('marks sales status as UNAVAILABLE when uncertain legacy returns exist rather than fabricating numbers', async () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-15T23:59:59.999Z');

    const mockDb = {
      orderItem: {
        async findMany() {
          return [
            {
              id: 'item_uncertain',
              orderId: 'ord_uncertain',
              productId: 'prod_legacy',
              variantId: null,
              quantity: 4,
              hasUncertainReturn: true, // Marked as legacy return without exact item breakdown
              price: BigInt(5_000_000),
              order: {
                id: 'ord_uncertain',
                status: 'COMPLETED',
                completedAt: new Date('2026-10-03T12:00:00.000Z'),
              },
            },
          ];
        },
      },
    };

    const results = await getNetSales(
      {
        productIds: ['prod_legacy'],
        from,
        to,
      },
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(results.length, 1);
    const legacySales = results[0];
    assert.equal(legacySales.hasUncertainReturns, true);
    assert.equal(legacySales.status, 'UNAVAILABLE');
  });

  it('filters specifically by variantId when provided in the input', async () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-15T23:59:59.999Z');

    const mockDb = {
      orderItem: {
        async findMany(args: { where: { variantId?: string | null } }) {
          assert.equal(args.where.variantId, 'var_specific');
          return [
            {
              id: 'item_var',
              orderId: 'ord_1',
              productId: 'prod_1',
              variantId: 'var_specific',
              quantity: 1,
              returnedQuantity: 0,
              price: BigInt(20_000_000),
              order: {
                id: 'ord_1',
                status: 'COMPLETED',
                completedAt: new Date('2026-10-05T00:00:00.000Z'),
              },
            },
          ];
        },
      },
    };

    const results = await getNetSales(
      {
        productIds: ['prod_1'],
        variantId: 'var_specific',
        from,
        to,
      },
      mockDb as unknown as PrismaClientOrTx
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].variantId, 'var_specific');
    assert.equal(results[0].netUnits, 1);
  });
});
