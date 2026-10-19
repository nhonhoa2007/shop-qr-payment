import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPurchaseOrder,
  receivePurchaseOrderItems,
  transitionPurchaseOrder,
} from '@server/modules/procurement/procurement.service';
import type { CreatePoInput, ReceivePoInput } from '@shared/types/procurement';

describe('Procurement Receipt & Movement Integration', () => {
  function createProcurementMockDb() {
    const suppliers = new Map<string, any>();
    const purchaseOrders = new Map<string, any>();
    const poItems = new Map<string, any>();
    const products = new Map<string, any>();
    const variants = new Map<string, any>();
    const movements: any[] = [];

    const tx: any = {
      supplier: {
        findUnique: async ({ where }: any) => {
          return suppliers.get(where.id) ? { ...suppliers.get(where.id) } : null;
        },
      },
      purchaseOrder: {
        findUnique: async ({ where }: any) => {
          const po = purchaseOrders.get(where.id);
          if (!po) return null;
          const items = Array.from(poItems.values()).filter((item) => item.purchaseOrderId === po.id);
          return { ...po, items };
        },
        create: async ({ data }: any) => {
          const id = data.id ?? `po_${purchaseOrders.size + 1}`;
          const po = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
          purchaseOrders.set(id, po);
          return po;
        },
        update: async ({ where, data }: any) => {
          const po = purchaseOrders.get(where.id);
          if (!po) throw new Error('PO not found');
          Object.assign(po, data, { updatedAt: new Date() });
          return { ...po };
        },
        updateMany: async ({ where, data }: any) => {
          const po = purchaseOrders.get(where.id);
          if (!po) return { count: 0 };
          if (where.status && po.status !== where.status) return { count: 0 };
          Object.assign(po, data, { updatedAt: new Date() });
          return { count: 1 };
        },
      },
      purchaseOrderItem: {
        create: async ({ data }: any) => {
          const id = data.id ?? `poi_${poItems.size + 1}`;
          const item = { id, receivedQuantity: 0, ...data };
          poItems.set(id, item);
          return item;
        },
        findUnique: async ({ where }: any) => {
          const item = poItems.get(where.id);
          return item ? { ...item } : null;
        },
        findMany: async ({ where }: any) => {
          return Array.from(poItems.values())
            .filter((item) => (where.purchaseOrderId ? item.purchaseOrderId === where.purchaseOrderId : true))
            .map((item) => ({ ...item }));
        },
        update: async ({ where, data }: any) => {
          const item = poItems.get(where.id);
          if (!item) throw new Error('PO item not found');
          if (data.receivedQuantity?.increment) {
            item.receivedQuantity += data.receivedQuantity.increment;
          }
          return { ...item };
        },
      },
      product: {
        findUnique: async ({ where }: any) => {
          const p = products.get(where.id);
          return p ? { ...p } : null;
        },
        updateMany: async ({ where, data }: any) => {
          const p = products.get(where.id);
          if (!p) return { count: 0 };
          if (data.onHandStock?.increment) p.onHandStock += data.onHandStock.increment;
          if (data.stock?.increment) p.stock += data.stock.increment;
          if (data.stockVersion?.increment) p.stockVersion += data.stockVersion.increment;
          return { count: 1 };
        },
        update: async ({ where, data }: any) => {
          const p = products.get(where.id);
          if (!p) throw new Error('Product not found');
          if (data.onHandStock?.increment) p.onHandStock += data.onHandStock.increment;
          if (data.stock?.increment) p.stock += data.stock.increment;
          if (data.stockVersion?.increment) p.stockVersion += data.stockVersion.increment;
          return { ...p };
        },
      },
      productVariant: {
        findUnique: async ({ where }: any) => {
          const v = variants.get(where.id);
          return v ? { ...v } : null;
        },
        updateMany: async ({ where, data }: any) => {
          const v = variants.get(where.id);
          if (!v) return { count: 0 };
          if (data.onHandStock?.increment) v.onHandStock += data.onHandStock.increment;
          if (data.stock?.increment) v.stock += data.stock.increment;
          if (data.stockVersion?.increment) v.stockVersion += data.stockVersion.increment;
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
            return true;
          });
        },
      },
      _seedSupplier: (sup: any) => suppliers.set(sup.id, { ...sup }),
      _seedProduct: (prod: any) => products.set(prod.id, { ...prod }),
      _seedVariant: (v: any) => variants.set(v.id, { ...v }),
      _getMovements: () => movements,
    };

    return tx;
  }

  it('creates a PO, transitions to ORDERED, and performs partial receipts (2 then 3 of 5)', async () => {
    const db = createProcurementMockDb();
    db._seedSupplier({ id: 'sup_apple', name: 'Apple Authorized Distributor', code: 'AAPL_VN' });
    db._seedProduct({
      id: 'macbook_m3',
      onHandStock: 0,
      reservedStock: 0,
      quarantinedStock: 0,
      stock: 0,
      stockVersion: 0,
      isActive: true,
      inventoryMode: 'BASE',
    });

    const createInput: CreatePoInput = {
      supplierId: 'sup_apple',
      poNumber: 'PO-2026-001',
      items: [
        {
          productId: 'macbook_m3',
          orderedQuantity: 5,
          unitCost: 30_000_000n,
        },
      ],
    };

    const po = await createPurchaseOrder(db, createInput);
    assert.equal(po.status, 'DRAFT');
    assert.equal(po.items.length, 1);
    assert.equal(po.items[0].orderedQuantity, 5);
    assert.equal(po.items[0].receivedQuantity, 0);

    // Transition DRAFT -> ORDERED
    await transitionPurchaseOrder(db, {
      purchaseOrderId: po.id,
      nextStatus: 'ORDERED',
    });

    const poiId = po.items[0].id;

    // First receipt: receive 2 units
    const receipt1 = await receivePurchaseOrderItems(db, {
      operationKey: 'receipt:po_001:part1',
      purchaseOrderId: po.id,
      items: [{ purchaseOrderItemId: poiId, quantity: 2 }],
    });

    assert.equal(receipt1.status, 'PARTIALLY_RECEIVED');
    assert.equal(receipt1.isFullyReceived, false);
    assert.equal(receipt1.receivedItems[0].quantityReceived, 2);
    assert.equal(receipt1.receivedItems[0].cumulativeReceivedQuantity, 2);
    assert.equal(receipt1.receivedItems[0].remainingQuantity, 3);

    const prodAfter1 = await db.product.findUnique({ where: { id: 'macbook_m3' } });
    assert.equal(prodAfter1.onHandStock, 2);
    assert.equal(prodAfter1.stock, 2);

    // Second receipt: receive remaining 3 units
    const receipt2 = await receivePurchaseOrderItems(db, {
      operationKey: 'receipt:po_001:part2',
      purchaseOrderId: po.id,
      items: [{ purchaseOrderItemId: poiId, quantity: 3 }],
    });

    assert.equal(receipt2.status, 'RECEIVED');
    assert.equal(receipt2.isFullyReceived, true);
    assert.equal(receipt2.receivedItems[0].cumulativeReceivedQuantity, 5);
    assert.equal(receipt2.receivedItems[0].remainingQuantity, 0);

    const prodAfter2 = await db.product.findUnique({ where: { id: 'macbook_m3' } });
    assert.equal(prodAfter2.onHandStock, 5);
    assert.equal(prodAfter2.stock, 5);

    // Verify exactly 2 RECEIVE movements in ledger
    const movements = db._getMovements();
    assert.equal(movements.length, 2);
    assert.equal(movements[0].kind, 'RECEIVE');
    assert.equal(movements[1].kind, 'RECEIVE');
  });

  it('rejects over-receipt: cannot receive more than ordered quantity', async () => {
    const db = createProcurementMockDb();
    db._seedSupplier({ id: 'sup_1', code: 'S1', name: 'Supplier 1' });
    db._seedProduct({ id: 'p1', onHandStock: 0, reservedStock: 0, quarantinedStock: 0, stock: 0, stockVersion: 0, isActive: true, inventoryMode: 'BASE' });

    const po = await createPurchaseOrder(db, {
      supplierId: 'sup_1',
      items: [{ productId: 'p1', orderedQuantity: 5, unitCost: 1000n }],
    });
    await transitionPurchaseOrder(db, { purchaseOrderId: po.id, nextStatus: 'ORDERED' });

    await assert.rejects(async () => {
      await receivePurchaseOrderItems(db, {
        operationKey: 'receipt:over_receive',
        purchaseOrderId: po.id,
        items: [{ purchaseOrderItemId: po.items[0].id, quantity: 6 }], // 6 > 5!
      });
    }, /cannot exceed ordered quantity|over-receipt/i);
  });

  it('is replay-safe: same operationKey with same receipt payload returns identical receipt without duplicate movements', async () => {
    const db = createProcurementMockDb();
    db._seedSupplier({ id: 'sup_1', code: 'S1', name: 'Supplier 1' });
    db._seedProduct({ id: 'p1', onHandStock: 0, reservedStock: 0, quarantinedStock: 0, stock: 0, stockVersion: 0, isActive: true, inventoryMode: 'BASE' });

    const po = await createPurchaseOrder(db, {
      supplierId: 'sup_1',
      items: [{ productId: 'p1', orderedQuantity: 10, unitCost: 1000n }],
    });
    await transitionPurchaseOrder(db, { purchaseOrderId: po.id, nextStatus: 'ORDERED' });

    const input: ReceivePoInput = {
      operationKey: 'receipt:stable_key_99',
      purchaseOrderId: po.id,
      items: [{ purchaseOrderItemId: po.items[0].id, quantity: 4 }],
    };

    const first = await receivePurchaseOrderItems(db, input);
    assert.equal(db._getMovements().length, 1);

    const second = await receivePurchaseOrderItems(db, input);
    assert.equal(db._getMovements().length, 1); // No duplicate movement
    assert.deepEqual(first, second);
  });
});
