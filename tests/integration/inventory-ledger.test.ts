import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInventoryMovement,
  reconcileInventoryLedger,
  backfillOpeningLegacyMovements,
} from '@server/modules/inventory/inventory-ledger.service';
import type { ApplyMovementInput, StockTarget } from '@shared/types/inventory-ledger';

describe('Inventory Movement Ledger - Integration & Lifecycle', () => {
  function createInMemoryLedgerDb() {
    const products = new Map<string, any>();
    const variants = new Map<string, any>();
    const movements: any[] = [];

    const tx: any = {
      product: {
        findUnique: async ({ where }: any) => {
          const p = products.get(where.id);
          return p ? { ...p } : null;
        },
        findMany: async () => Array.from(products.values()).map((p) => ({ ...p })),
        updateMany: async ({ where, data }: any) => {
          const p = products.get(where.id);
          if (!p) return { count: 0 };
          if (where.stockVersion !== undefined && p.stockVersion !== where.stockVersion) return { count: 0 };

          if (typeof data.onHandStock === 'number') p.onHandStock = data.onHandStock;
          else if (data.onHandStock?.increment) p.onHandStock += data.onHandStock.increment;
          else if (data.onHandStock?.decrement) p.onHandStock -= data.onHandStock.decrement;

          if (typeof data.reservedStock === 'number') p.reservedStock = data.reservedStock;
          else if (data.reservedStock?.increment) p.reservedStock += data.reservedStock.increment;
          else if (data.reservedStock?.decrement) p.reservedStock -= data.reservedStock.decrement;

          if (typeof data.quarantinedStock === 'number') p.quarantinedStock = data.quarantinedStock;
          else if (data.quarantinedStock?.increment) p.quarantinedStock += data.quarantinedStock.increment;
          else if (data.quarantinedStock?.decrement) p.quarantinedStock -= data.quarantinedStock.decrement;

          if (typeof data.stock === 'number') p.stock = data.stock;
          else if (data.stock?.increment) p.stock += data.stock.increment;
          else if (data.stock?.decrement) p.stock -= data.stock.decrement;

          if (typeof data.stockVersion === 'number') p.stockVersion = data.stockVersion;
          else if (data.stockVersion?.increment) p.stockVersion += data.stockVersion.increment;

          return { count: 1 };
        },
        update: async ({ where, data }: any) => {
          const p = products.get(where.id);
          if (!p) throw new Error('Product not found');
          if (data.onHandStock?.increment) p.onHandStock += data.onHandStock.increment;
          if (data.onHandStock?.decrement) p.onHandStock -= data.onHandStock.decrement;
          if (data.reservedStock?.increment) p.reservedStock += data.reservedStock.increment;
          if (data.reservedStock?.decrement) p.reservedStock -= data.reservedStock.decrement;
          if (data.quarantinedStock?.increment) p.quarantinedStock += data.quarantinedStock.increment;
          if (data.quarantinedStock?.decrement) p.quarantinedStock -= data.quarantinedStock.decrement;
          if (data.stock?.increment) p.stock += data.stock.increment;
          if (data.stock?.decrement) p.stock -= data.stock.decrement;
          if (data.stockVersion?.increment) p.stockVersion += data.stockVersion.increment;
          return { ...p };
        },
      },
      productVariant: {
        findUnique: async ({ where }: any) => {
          const v = variants.get(where.id);
          return v ? { ...v } : null;
        },
        findMany: async () => Array.from(variants.values()).map((v) => ({ ...v })),
        updateMany: async ({ where, data }: any) => {
          const v = variants.get(where.id);
          if (!v) return { count: 0 };
          if (where.stockVersion !== undefined && v.stockVersion !== where.stockVersion) return { count: 0 };

          if (typeof data.onHandStock === 'number') v.onHandStock = data.onHandStock;
          else if (data.onHandStock?.increment) v.onHandStock += data.onHandStock.increment;
          else if (data.onHandStock?.decrement) v.onHandStock -= data.onHandStock.decrement;

          if (typeof data.reservedStock === 'number') v.reservedStock = data.reservedStock;
          else if (data.reservedStock?.increment) v.reservedStock += data.reservedStock.increment;
          else if (data.reservedStock?.decrement) v.reservedStock -= data.reservedStock.decrement;

          if (typeof data.quarantinedStock === 'number') v.quarantinedStock = data.quarantinedStock;
          else if (data.quarantinedStock?.increment) v.quarantinedStock += data.quarantinedStock.increment;
          else if (data.quarantinedStock?.decrement) v.quarantinedStock -= data.quarantinedStock.decrement;

          if (typeof data.stock === 'number') v.stock = data.stock;
          else if (data.stock?.increment) v.stock += data.stock.increment;
          else if (data.stock?.decrement) v.stock -= data.stock.decrement;

          if (typeof data.stockVersion === 'number') v.stockVersion = data.stockVersion;
          else if (data.stockVersion?.increment) v.stockVersion += data.stockVersion.increment;

          return { count: 1 };
        },
      },
      inventoryMovement: {
        findUnique: async ({ where }: any) => {
          return movements.find((m) => m.operationKey === where.operationKey) || null;
        },
        create: async ({ data }: any) => {
          const m = { id: `mov_${movements.length + 1}`, createdAt: new Date(), ...data };
          movements.push(m);
          return m;
        },
        findMany: async ({ where }: any) => {
          return movements.filter((m) => {
            if (where.productId && m.productId !== where.productId) return false;
            if (where.variantId !== undefined && m.variantId !== where.variantId) return false;
            if (where.kind && m.kind !== where.kind) return false;
            return true;
          });
        },
      },
      _seedProduct: (prod: any) => products.set(prod.id, { ...prod }),
      _seedVariant: (variant: any) => variants.set(variant.id, { ...variant }),
      _getMovements: () => movements,
    };

    return tx;
  }

  it('should run full lifecycle and verify movement sum reconciliation', async () => {
    const db = createInMemoryLedgerDb();
    db._seedProduct({
      id: 'laptop_01',
      onHandStock: 0,
      reservedStock: 0,
      quarantinedStock: 0,
      stock: 0,
      stockVersion: 0,
      inventoryMode: 'BASE',
      isActive: true,
    });

    const target: StockTarget = { productId: 'laptop_01' };

    // 1. Receive PO: 10 units received into onHand
    await applyInventoryMovement(db, {
      operationKey: 'po_01:receipt:laptop_01',
      target,
      kind: 'RECEIVE',
      deltaOnHand: 10,
      deltaReserved: 0,
      deltaQuarantined: 0,
      reason: 'PO Receipt from Dell',
      referenceType: 'PURCHASE_ORDER',
      referenceId: 'po_01',
    });

    // 2. Order 1 reserve 3 units
    await applyInventoryMovement(db, {
      operationKey: 'order_1:reserve:laptop_01',
      target,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 3,
      deltaQuarantined: 0,
      reason: 'Order 1 placed',
      referenceType: 'ORDER',
      referenceId: 'order_1',
    });

    // 3. Order 1 ships 3 units (consume from reserved and onHand)
    await applyInventoryMovement(db, {
      operationKey: 'order_1:ship:laptop_01',
      target,
      kind: 'SHIP',
      deltaOnHand: -3,
      deltaReserved: -3,
      deltaQuarantined: 0,
      reason: 'Order 1 delivered to GHN',
      referenceType: 'SHIPMENT',
      referenceId: 'ghn_01',
    });

    // 4. Customer returns 1 unit -> goes into quarantine
    await applyInventoryMovement(db, {
      operationKey: 'return_1:quarantine:laptop_01',
      target,
      kind: 'QUARANTINE',
      deltaOnHand: 1,
      deltaReserved: 0,
      deltaQuarantined: 1,
      reason: 'Return received at warehouse',
      referenceType: 'RETURN',
      referenceId: 'ret_1',
    });

    // 5. Restock the 1 returned unit
    await applyInventoryMovement(db, {
      operationKey: 'return_1:restock:laptop_01',
      target,
      kind: 'RESTOCK',
      deltaOnHand: 0,
      deltaReserved: 0,
      deltaQuarantined: -1,
      reason: 'Restock after technician pass',
      referenceType: 'RETURN',
      referenceId: 'ret_1',
    });

    // Current state check:
    // onHand = 10 - 3 + 1 = 8
    // reserved = 0
    // quarantined = 1 - 1 = 0
    // available = 8
    const finalProduct = await db.product.findUnique({ where: { id: 'laptop_01' } });
    assert.equal(finalProduct.onHandStock, 8);
    assert.equal(finalProduct.reservedStock, 0);
    assert.equal(finalProduct.quarantinedStock, 0);
    assert.equal(finalProduct.stock, 8);

    // Reconcile ledger
    const reconciliation = await reconcileInventoryLedger(db, target);
    assert.equal(reconciliation.isReconciled, true);
    assert.equal(reconciliation.sumOnHand, 8);
    assert.equal(reconciliation.sumReserved, 0);
    assert.equal(reconciliation.sumQuarantined, 0);
    assert.equal(reconciliation.projectionOnHand, 8);
    assert.equal(reconciliation.projectionReserved, 0);
    assert.equal(reconciliation.projectionQuarantined, 0);
    assert.equal(reconciliation.movementCount, 5);
  });

  it('should backfill OPENING_LEGACY movements idempotently', async () => {
    const db = createInMemoryLedgerDb();
    db._seedProduct({
      id: 'prod_legacy_1',
      onHandStock: 0,
      reservedStock: 0,
      quarantinedStock: 0,
      stock: 15,
      stockVersion: 0,
      inventoryMode: 'BASE',
      isActive: true,
    });

    const report1 = await backfillOpeningLegacyMovements(db);
    assert.equal(report1.createdCount, 1);

    const productAfter = await db.product.findUnique({ where: { id: 'prod_legacy_1' } });
    assert.equal(productAfter.onHandStock, 15);
    assert.equal(productAfter.reservedStock, 0);
    assert.equal(productAfter.stock, 15);

    // Running a second time should be idempotent (0 created)
    const report2 = await backfillOpeningLegacyMovements(db);
    assert.equal(report2.createdCount, 0);
  });
});
