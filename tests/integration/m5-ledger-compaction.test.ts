import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateStockAdjustmentsToMovements,
  adjustStockViaLedger,
} from '@server/modules/inventory/stock-adjustment-compaction.service';

describe('M5 Compaction - StockAdjustment to InventoryMovement Migration', () => {
  function createMockDb() {
    const legacyAdjustments: any[] = [];
    const movements: any[] = [];
    const products = new Map<string, any>();
    const variants = new Map<string, any>();

    const tx: any = {
      stockAdjustment: {
        findMany: async () => [...legacyAdjustments],
      },
      inventoryMovement: {
        findUnique: async ({ where }: any) => {
          return movements.find((m) => m.operationKey === where.operationKey) ?? null;
        },
        create: async ({ data }: any) => {
          const m = { id: `mov_${movements.length + 1}`, createdAt: new Date(), ...data };
          movements.push(m);
          return m;
        },
        findMany: async () => [...movements],
      },
      product: {
        findUnique: async ({ where }: any) => products.get(where.id) ? { ...products.get(where.id) } : null,
        updateMany: async ({ where, data }: any) => {
          const p = products.get(where.id);
          if (!p) return { count: 0 };
          if (data.onHandStock?.increment) p.onHandStock += data.onHandStock.increment;
          if (data.stock?.increment) p.stock += data.stock.increment;
          if (data.stockVersion?.increment) p.stockVersion += data.stockVersion.increment;
          return { count: 1 };
        },
      },
      productVariant: {
        findUnique: async ({ where }: any) => variants.get(where.id) ? { ...variants.get(where.id) } : null,
        updateMany: async ({ where, data }: any) => {
          const v = variants.get(where.id);
          if (!v) return { count: 0 };
          if (data.onHandStock?.increment) v.onHandStock += data.onHandStock.increment;
          if (data.stock?.increment) v.stock += data.stock.increment;
          if (data.stockVersion?.increment) v.stockVersion += data.stockVersion.increment;
          return { count: 1 };
        },
      },
      _seedAdjustment: (adj: any) => legacyAdjustments.push({ ...adj }),
      _seedProduct: (prod: any) => products.set(prod.id, { ...prod }),
      _getMovements: () => movements,
    };

    return tx;
  }

  it('backfills legacy StockAdjustment records into InventoryMovement(ADJUST) idempotently', async () => {
    const db = createMockDb();
    const now = new Date();

    db._seedAdjustment({
      id: 'adj_1',
      operationKey: 'adj:key:001',
      productId: 'prod_1',
      variantId: null,
      delta: 5,
      previousStock: 10,
      newStock: 15,
      version: 2,
      reason: 'Physical count found surplus',
      actorId: 'admin_ops',
      createdAt: now,
    });

    db._seedAdjustment({
      id: 'adj_2',
      operationKey: 'adj:key:002',
      productId: 'prod_1',
      variantId: null,
      delta: -2,
      previousStock: 15,
      newStock: 13,
      version: 3,
      reason: 'Damaged item written off',
      actorId: 'admin_ops',
      createdAt: now,
    });

    // 1. Run migration
    const report1 = await migrateStockAdjustmentsToMovements(db);
    assert.equal(report1.migratedCount, 2);
    assert.equal(report1.skippedCount, 0);

    const movements = db._getMovements();
    assert.equal(movements.length, 2);
    assert.equal(movements[0].kind, 'ADJUST');
    assert.equal(movements[0].operationKey, 'adj:key:001');
    assert.equal(movements[0].deltaOnHand, 5);
    assert.equal(movements[0].beforeAvailable, 10);
    assert.equal(movements[0].afterAvailable, 15);

    // 2. Rerun migration: idempotent (0 migrated, 2 skipped)
    const report2 = await migrateStockAdjustmentsToMovements(db);
    assert.equal(report2.migratedCount, 0);
    assert.equal(report2.skippedCount, 2);
    assert.equal(db._getMovements().length, 2);
  });

  it('adjustStockViaLedger directly records InventoryMovement without writing to StockAdjustment', async () => {
    const db = createMockDb();
    db._seedProduct({
      id: 'prod_adjust_test',
      onHandStock: 20,
      reservedStock: 0,
      quarantinedStock: 0,
      stock: 20,
      stockVersion: 1,
      isActive: true,
      inventoryMode: 'BASE',
    });

    const result = await adjustStockViaLedger(db, {
      operationKey: 'adj:new_flow:001',
      productId: 'prod_adjust_test',
      delta: -3,
      reason: 'Expired demo unit',
      actorId: 'admin_1',
      expectedVersion: 1,
    });

    assert.equal(result.success, true);
    assert.equal(result.newStock, 17);

    const mov = db._getMovements().find((m: any) => m.operationKey === 'adj:new_flow:001');
    assert.ok(mov);
    assert.equal(mov.kind, 'ADJUST');
    assert.equal(mov.deltaOnHand, -3);
  });
});
