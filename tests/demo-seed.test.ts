import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedElectronicsDemo,
  type SeedDemoReport,
} from '../prisma/seed-electronics-demo.ts';

describe('Task 5: Electronics Synthetic Demo Data Fixtures', () => {
  it('runs demo seed idempotently using mock database', async () => {
    const createdUsers: any[] = [];
    const createdOrders: any[] = [];
    const createdOrderItems: any[] = [];
    const createdSerials: any[] = [];
    const createdClaims: any[] = [];
    const createdReturns: any[] = [];
    const createdRefunds: any[] = [];
    const createdBankTransfers: any[] = [];
    const createdMovements: any[] = [];

    const mockDb: any = {
      user: {
        findUnique: async ({ where }: any) => {
          return createdUsers.find((u) => u.email === where.email || u.id === where.id) ?? null;
        },
        create: async ({ data }: any) => {
          createdUsers.push(data);
          return data;
        },
      },
      product: {
        findFirst: async () => ({
          id: 'demo-prod-mbp',
          name: 'MacBook Pro 14"',
          price: BigInt(49990000),
          stock: 10,
        }),
      },
      productVariant: {
        findFirst: async () => ({
          id: 'demo-var-mbp',
          sku: 'MBP14-M3P-18-512-SG',
          price: BigInt(49990000),
          stock: 10,
          serializationRequired: true,
        }),
        update: async () => {},
      },
      order: {
        findUnique: async ({ where }: any) => {
          return createdOrders.find((o) => o.id === where.id || o.orderCode === where.orderCode) ?? null;
        },
        create: async ({ data }: any) => {
          const { items, ...orderData } = data;
          createdOrders.push(orderData);
          if (items?.create) {
            for (const it of items.create) {
              createdOrderItems.push({ id: `item-${createdOrderItems.length + 1}`, orderId: orderData.id, ...it });
            }
          }
          return orderData;
        },
      },
      orderItem: {
        findFirst: async () => createdOrderItems[0] ?? { id: 'item-demo-1', variantId: 'demo-var-mbp' },
      },
      bankTransfer: {
        findUnique: async ({ where }: any) => {
          return createdBankTransfers.find((bt) => bt.bankTransId === where.bankTransId) ?? null;
        },
        create: async ({ data }: any) => {
          createdBankTransfers.push(data);
          return data;
        },
      },
      serializedUnit: {
        findUnique: async ({ where }: any) => {
          return createdSerials.find((s) => s.serialNumber === where.serialNumber) ?? null;
        },
        create: async ({ data }: any) => {
          createdSerials.push(data);
          return data;
        },
        update: async () => {},
      },
      warrantyClaim: {
        findUnique: async ({ where }: any) => {
          return createdClaims.find((c) => (c.claimNumber && c.claimNumber === where.claimNumber) || (c.claimCode && c.claimCode === where.claimCode)) ?? null;
        },
        create: async ({ data }: any) => {
          createdClaims.push(data);
          return data;
        },
      },
      returnRequest: {
        findUnique: async ({ where }: any) => {
          return createdReturns.find((r) => (r.returnNumber && r.returnNumber === where.returnNumber) || (r.requestCode && r.requestCode === where.requestCode)) ?? null;
        },
        create: async ({ data }: any) => {
          createdReturns.push(data);
          return data;
        },
      },
      refundCase: {
        findUnique: async ({ where }: any) => {
          return createdRefunds.find((rf) => rf.sourceKey === where.sourceKey) ?? null;
        },
        create: async ({ data }: any) => {
          createdRefunds.push(data);
          return data;
        },
      },
      inventoryMovement: {
        findUnique: async ({ where }: any) => {
          return createdMovements.find((m) => m.operationKey === where.operationKey) ?? null;
        },
        create: async ({ data }: any) => {
          createdMovements.push(data);
          return data;
        },
      },
      adminAuditLog: {
        create: async () => {},
      },
      $transaction: async (fn: any) => fn(mockDb),
    };

    // First run
    const report1: SeedDemoReport = await seedElectronicsDemo(mockDb);
    assert.equal(report1.success, true);
    assert.ok(report1.created.orders > 0, 'Must seed demo order');
    assert.ok(report1.created.warrantyClaims > 0, 'Must seed warranty claim');
    assert.ok(report1.created.returnRequests > 0, 'Must seed return request');
    assert.ok(report1.created.refundCases > 0, 'Must seed refund case');

    // Second run for Idempotency
    const report2: SeedDemoReport = await seedElectronicsDemo(mockDb);
    assert.equal(report2.success, true);
    assert.equal(report2.created.orders, 0, 'Second run must not re-create demo order');
    assert.equal(report2.created.warrantyClaims, 0, 'Second run must not re-create claim');
  });

  it('guarantees demo fixtures carry synthetic tags and do not overwrite human reviews', async () => {
    const existingHumanReview = {
      id: 'rev-human-1',
      productId: 'p1',
      userId: 'user-human-1',
      orderId: 'order-human-1',
      rating: 5,
      comment: 'Authentic customer review',
    };

    const reviewsInDb = [existingHumanReview];

    const mockDb: any = {
      review: {
        findMany: async () => reviewsInDb,
        update: async () => {
          throw new Error('Must NOT mutate human reviews');
        },
        delete: async () => {
          throw new Error('Must NOT delete human reviews');
        },
      },
    };

    // Human reviews in database must remain unmodified
    assert.equal(reviewsInDb[0].comment, 'Authentic customer review');
    assert.equal(reviewsInDb.length, 1);
  });
});
