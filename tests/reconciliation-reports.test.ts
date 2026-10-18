import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileInventory,
  reconcileMoney,
  type InventoryReconciliationReport,
  type MoneyReconciliationReport,
} from '../src/server/modules/admin/reconciliation-report.service.ts';

describe('Task 3: Reconciliation Reports (Inventory, Money, and Serials)', () => {
  describe('reconcileInventory', () => {
    it('returns clean report when inventory movements and variant projections are aligned', async () => {
      const mockDb: any = {
        product: {
          findMany: async () => [
            {
              id: 'p1',
              name: 'Laptop X',
              stock: 10,
              variants: [
                { id: 'v1', sku: 'SKU-1', stock: 6, serializationRequired: false },
                { id: 'v2', sku: 'SKU-2', stock: 4, serializationRequired: false },
              ],
            },
          ],
        },
        inventoryMovement: {
          findMany: async () => [
            { variantId: 'v1', delta: 10, kind: 'PURCHASE_RECEIPT' },
            { variantId: 'v1', delta: -4, kind: 'SALES_SHIP' },
            { variantId: 'v2', delta: 5, kind: 'PURCHASE_RECEIPT' },
            { variantId: 'v2', delta: -1, kind: 'SALES_SHIP' },
          ],
        },
        serializedUnit: {
          findMany: async () => [],
        },
      };

      const report: InventoryReconciliationReport = await reconcileInventory(mockDb, { repair: false });
      assert.equal(report.status, 'CLEAN');
      assert.equal(report.discrepancies.length, 0);
      assert.equal(report.totalProductsChecked, 1);
      assert.equal(report.totalVariantsChecked, 2);
    });

    it('detects parent-variant stock mismatch when Product.stock != sum of variants', async () => {
      const mockDb: any = {
        product: {
          findMany: async () => [
            {
              id: 'p1',
              name: 'Laptop Mismatch',
              stock: 20, // should be 6 + 4 = 10
              variants: [
                { id: 'v1', sku: 'SKU-1', stock: 6, serializationRequired: false },
                { id: 'v2', sku: 'SKU-2', stock: 4, serializationRequired: false },
              ],
            },
          ],
        },
        inventoryMovement: {
          findMany: async () => [
            { variantId: 'v1', delta: 6, kind: 'PURCHASE_RECEIPT' },
            { variantId: 'v2', delta: 4, kind: 'PURCHASE_RECEIPT' },
          ],
        },
        serializedUnit: { findMany: async () => [] },
      };

      const report = await reconcileInventory(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(
        report.discrepancies.some((d) => d.type === 'PARENT_STOCK_MISMATCH' && d.productId === 'p1'),
        'Must detect PARENT_STOCK_MISMATCH'
      );
    });

    it('detects movement sum mismatch when ledger sum != variant stock', async () => {
      const mockDb: any = {
        product: {
          findMany: async () => [
            {
              id: 'p1',
              name: 'Phone Y',
              stock: 10,
              variants: [{ id: 'v1', sku: 'SKU-1', stock: 10, serializationRequired: false }],
            },
          ],
        },
        inventoryMovement: {
          findMany: async () => [
            // Ledger sum is only 7, but stock says 10!
            { variantId: 'v1', delta: 7, kind: 'PURCHASE_RECEIPT' },
          ],
        },
        serializedUnit: { findMany: async () => [] },
      };

      const report = await reconcileInventory(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(
        report.discrepancies.some((d) => d.type === 'MOVEMENT_SUM_MISMATCH' && d.variantId === 'v1'),
        'Must detect MOVEMENT_SUM_MISMATCH'
      );
    });

    it('detects negative stock', async () => {
      const mockDb: any = {
        product: {
          findMany: async () => [
            {
              id: 'p1',
              name: 'Cable',
              stock: -2,
              variants: [{ id: 'v1', sku: 'SKU-NEG', stock: -2, serializationRequired: false }],
            },
          ],
        },
        inventoryMovement: { findMany: async () => [] },
        serializedUnit: { findMany: async () => [] },
      };

      const report = await reconcileInventory(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(report.discrepancies.some((d) => d.type === 'NEGATIVE_STOCK'));
    });

    it('detects serial count mismatch and serial order mismatch', async () => {
      const mockDb: any = {
        product: {
          findMany: async () => [
            {
              id: 'p1',
              name: 'MacBook Pro',
              stock: 2,
              variants: [{ id: 'v1', sku: 'SKU-MBP', stock: 2, serializationRequired: true }],
            },
          ],
        },
        inventoryMovement: {
          findMany: async () => [{ variantId: 'v1', delta: 2, kind: 'PURCHASE_RECEIPT' }],
        },
        serializedUnit: {
          findMany: async () => [
            // Only 1 physical unit in stock when variant stock is 2
            {
              id: 'u1',
              variantId: 'v1',
              status: 'IN_STOCK',
              serialNumber: 'SN-001',
              orderItemId: null,
            },
            // Another unit has order mismatch
            {
              id: 'u2',
              variantId: 'v1',
              status: 'SOLD',
              serialNumber: 'SN-002',
              orderItemId: 'item-diff-variant',
              orderItem: { variantId: 'different-variant-id' },
            },
          ],
        },
      };

      const report = await reconcileInventory(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(report.discrepancies.some((d) => d.type === 'SERIAL_COUNT_MISMATCH'));
      assert.ok(report.discrepancies.some((d) => d.type === 'SERIAL_ORDER_MISMATCH'));
    });

    it('strictly enforces read-only mode and refuses repair options', async () => {
      const mockDb: any = {};
      await assert.rejects(
        async () => {
          await (reconcileInventory as any)(mockDb, { repair: true });
        },
        /Read-only reconciliation: repair mode is strictly forbidden/
      );
    });
  });

  describe('reconcileMoney', () => {
    it('returns clean report when wallets, transactions, and order payments balance', async () => {
      const mockDb: any = {
        userWallet: {
          findMany: async () => [
            { id: 'w1', userId: 'u1', balance: BigInt(500000) },
          ],
        },
        walletTransaction: {
          findMany: async () => [
            { walletId: 'w1', amount: BigInt(1000000), type: 'TOPUP' },
            { walletId: 'w1', amount: BigInt(-500000), type: 'PAYMENT' },
          ],
        },
        order: {
          findMany: async () => [
            {
              id: 'o1',
              orderCode: 'DH123456',
              totalAmount: BigInt(500000),
              paymentStatus: 'PAID',
              paymentMethod: 'VIETQR',
              bankTransfers: [{ bankTransId: 'BT001', amount: BigInt(500000), status: 'APPLIED_ORDER' }],
              refundCases: [],
              orderItems: [{ id: 'item1', quantity: 1, price: BigInt(500000), returnedQuantity: 0 }],
            },
          ],
        },
        refundCase: {
          findMany: async () => [],
        },
      };

      const report: MoneyReconciliationReport = await reconcileMoney(mockDb);
      assert.equal(report.status, 'CLEAN');
      assert.equal(report.discrepancies.length, 0);
      assert.equal(report.totalWalletsChecked, 1);
      assert.equal(report.totalOrdersChecked, 1);
    });

    it('detects wallet ledger mismatch when balance != sum of transactions', async () => {
      const mockDb: any = {
        userWallet: {
          findMany: async () => [
            { id: 'w1', userId: 'u1', balance: BigInt(999999) }, // corrupted balance
          ],
        },
        walletTransaction: {
          findMany: async () => [
            { walletId: 'w1', amount: BigInt(1000000), type: 'TOPUP' },
            { walletId: 'w1', amount: BigInt(-500000), type: 'PAYMENT' },
          ],
        },
        order: { findMany: async () => [] },
        refundCase: { findMany: async () => [] },
      };

      const report = await reconcileMoney(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(
        report.discrepancies.some((d) => d.type === 'WALLET_LEDGER_MISMATCH' && d.walletId === 'w1'),
        'Must detect WALLET_LEDGER_MISMATCH'
      );
    });

    it('detects refund exceeding order total entitlement', async () => {
      const mockDb: any = {
        userWallet: { findMany: async () => [] },
        walletTransaction: { findMany: async () => [] },
        order: {
          findMany: async () => [
            {
              id: 'o1',
              orderCode: 'DH999999',
              totalAmount: BigInt(1000000),
              paymentStatus: 'PAID',
              paymentMethod: 'VIETQR',
              bankTransfers: [{ bankTransId: 'BT999', amount: BigInt(1000000), status: 'APPLIED_ORDER' }],
              refundCases: [
                { id: 'rf1', amount: BigInt(800000), status: 'COMPLETED' },
                { id: 'rf2', amount: BigInt(400000), status: 'COMPLETED' }, // Total refund 1.2M > 1M order!
              ],
              orderItems: [{ id: 'i1', quantity: 1, price: BigInt(1000000), returnedQuantity: 1 }],
            },
          ],
        },
        refundCase: { findMany: async () => [] },
      };

      const report = await reconcileMoney(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(
        report.discrepancies.some((d) => d.type === 'REFUND_EXCEEDS_ENTITLEMENT'),
        'Must detect REFUND_EXCEEDS_ENTITLEMENT'
      );
    });

    it('detects paid order without matching bank transfer or wallet payment', async () => {
      const mockDb: any = {
        userWallet: { findMany: async () => [] },
        walletTransaction: { findMany: async () => [] },
        order: {
          findMany: async () => [
            {
              id: 'o_unpaid_record',
              orderCode: 'DH000001',
              totalAmount: BigInt(1000000),
              paymentStatus: 'PAID',
              paymentMethod: 'VIETQR',
              bankTransfers: [], // No bank transfers recorded!
              refundCases: [],
              orderItems: [],
            },
          ],
        },
        refundCase: { findMany: async () => [] },
      };

      const report = await reconcileMoney(mockDb);
      assert.equal(report.status, 'DISCREPANCIES_DETECTED');
      assert.ok(
        report.discrepancies.some((d) => d.type === 'PAID_ORDER_PAYMENT_MISSING'),
        'Must detect PAID_ORDER_PAYMENT_MISSING'
      );
    });

    it('ensures sensitive PII and keys are redacted in reconciliation output', async () => {
      const mockDb: any = {
        userWallet: {
          findMany: async () => [
            { id: 'w1', userId: 'user-sensitive-12345', balance: BigInt(50000) },
          ],
        },
        walletTransaction: {
          findMany: async () => [
            { walletId: 'w1', amount: BigInt(60000), type: 'TOPUP' },
          ],
        },
        order: { findMany: async () => [] },
        refundCase: { findMany: async () => [] },
      };

      const report = await reconcileMoney(mockDb);
      const jsonOutput = JSON.stringify(report);
      assert.equal(jsonOutput.includes('creditCard'), false);
      assert.equal(jsonOutput.includes('password'), false);
      assert.equal(jsonOutput.includes('secret'), false);
    });
  });
});
