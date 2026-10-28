import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { expireUnpaidOrders } from '@server/modules/inventory/inventory.service';

describe('PaymentRequest expiry persistence', () => {
  it('expires an order request in the order cancellation transaction and stale top-ups in the cron run', async () => {
    const requestUpdates: Array<Record<string, unknown>> = [];
    const order = {
      id: 'order_expired',
      couponId: null,
      userId: null,
      items: [],
    };
    const tx = {
      order: {
        updateMany: async () => ({ count: 1 }),
      },
      paymentRequest: {
        updateMany: async (args: Record<string, unknown>) => {
          requestUpdates.push(args);
          return { count: 1 };
        },
      },
    };
    const db = {
      order: { findMany: async () => [order] },
      paymentRequest: {
        updateMany: async (args: Record<string, unknown>) => {
          requestUpdates.push(args);
          return { count: 1 };
        },
      },
      $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => work(tx),
    } as unknown as PrismaClient;

    assert.equal(await expireUnpaidOrders(db), 1);
    assert.ok(requestUpdates.some((args) => {
      const where = args.where as Record<string, unknown>;
      return where.orderId === order.id && where.status === 'PENDING';
    }));
    assert.ok(requestUpdates.some((args) => {
      const where = args.where as Record<string, unknown>;
      return where.kind === 'WALLET_TOPUP' && where.status === 'PENDING';
    }));
    const walletSweep = requestUpdates.find((args) => {
      const where = args.where as Record<string, unknown>;
      return where.kind === 'WALLET_TOPUP';
    });
    const cutoff = ((walletSweep?.where as Record<string, unknown>)
      ?.expiresAt as { lte?: Date })?.lte;
    assert.ok(cutoff instanceof Date);
    assert.ok(Date.now() - cutoff.getTime() >= 5 * 60 * 1000);
  });
});
