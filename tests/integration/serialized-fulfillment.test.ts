import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignSerializedUnits,
  assertOrderSerializationReady,
  markOrderUnitsSold,
  registerSerializedUnitsOnReceipt,
} from '@server/modules/inventory/serialized-unit.service';

describe('Serialized Unit - Fulfillment & Lifecycle Integration', () => {
  function createSerializedMockDb() {
    const units = new Map<string, any>();
    const orders = new Map<string, any>();

    const tx: any = {
      serializedUnit: {
        create: async ({ data }: any) => {
          const id = data.id ?? `unit_${units.size + 1}`;
          const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
          units.set(id, record);
          return record;
        },
        createMany: async ({ data }: any) => {
          for (const item of data) {
            const id = item.id ?? `unit_${units.size + 1}`;
            units.set(id, { id, createdAt: new Date(), updatedAt: new Date(), ...item });
          }
          return { count: data.length };
        },
        findUnique: async ({ where }: any) => {
          if (where.id) return units.get(where.id) ? { ...units.get(where.id) } : null;
          if (where.serialNumber) {
            return Array.from(units.values()).find((u) => u.serialNumber === where.serialNumber) ?? null;
          }
          if (where.imei1) {
            return Array.from(units.values()).find((u) => u.imei1 === where.imei1) ?? null;
          }
          return null;
        },
        findMany: async ({ where }: any) => {
          return Array.from(units.values()).filter((u) => {
            if (where.id?.in && !where.id.in.includes(u.id)) return false;
            if (where.orderId && u.orderId !== where.orderId) return false;
            if (where.orderItemId && u.orderItemId !== where.orderItemId) return false;
            if (where.status?.in && !where.status.in.includes(u.status)) return false;
            else if (typeof where.status === 'string' && u.status !== where.status) return false;
            if (where.productId && u.productId !== where.productId) return false;
            if (where.variantId !== undefined && u.variantId !== where.variantId) return false;
            return true;
          });
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const u of units.values()) {
            if (where.id && u.id !== where.id) continue;
            if (where.id?.in && !where.id.in.includes(u.id)) continue;
            if (where.status && u.status !== where.status) continue;
            if (where.orderId && u.orderId !== where.orderId) continue;

            Object.assign(u, data, { updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      order: {
        findUnique: async ({ where }: any) => {
          const o = orders.get(where.id);
          return o ? { ...o } : null;
        },
      },
      _seedOrder: (order: any) => orders.set(order.id, { ...order }),
      _seedUnit: (unit: any) => units.set(unit.id, { ...unit }),
      _getUnits: () => Array.from(units.values()),
    };

    return tx;
  }

  it('registers serialized units upon PO receipt and enforces identifier normalization', async () => {
    const db = createSerializedMockDb();

    const result = await registerSerializedUnitsOnReceipt(db, {
      productId: 'laptop_01',
      variantId: 'var_16gb',
      purchaseOrderItemId: 'poi_10',
      units: [
        { serialNumber: 'c02f1234abcd', imei1: '3520-9910-1234-567' },
        { serialNumber: 'C02F5678WXYZ' },
      ],
    });

    assert.equal(result.registeredCount, 2);
    const unit1 = await db.serializedUnit.findUnique({ where: { serialNumber: 'C02F1234ABCD' } });
    assert.ok(unit1);
    assert.equal(unit1.imei1, '352099101234567');
    assert.equal(unit1.status, 'AVAILABLE');
  });

  it('assigns available units to order items and prevents selling same unit twice', async () => {
    const db = createSerializedMockDb();
    db._seedUnit({
      id: 'unit_laptop_1',
      productId: 'laptop_01',
      variantId: 'var_1',
      serialNumber: 'SN123456',
      status: 'AVAILABLE',
    });

    // 1. Assign to Order 100
    await assignSerializedUnits(db, {
      orderId: 'ord_100',
      orderItemId: 'item_100_1',
      productId: 'laptop_01',
      variantId: 'var_1',
      unitIds: ['unit_laptop_1'],
    });

    const unit = await db.serializedUnit.findUnique({ where: { id: 'unit_laptop_1' } });
    assert.equal(unit.status, 'ASSIGNED');
    assert.equal(unit.orderId, 'ord_100');

    // 2. Attempt to assign same unit to Order 200 -> must fail
    await assert.rejects(async () => {
      await assignSerializedUnits(db, {
        orderId: 'ord_200',
        orderItemId: 'item_200_1',
        productId: 'laptop_01',
        variantId: 'var_1',
        unitIds: ['unit_laptop_1'],
      });
    }, /not available|already assigned|conflict/i);
  });

  it('assertOrderSerializationReady blocks shipment when required units are missing', async () => {
    const db = createSerializedMockDb();
    db._seedOrder({
      id: 'ord_device_1',
      items: [
        {
          id: 'item_1',
          productId: 'phone_01',
          variantId: 'var_1',
          quantity: 2,
          product: { kind: 'PHONE' },
          variant: { serializationRequired: true },
        },
      ],
    });

    // Only 1 unit assigned while quantity is 2
    db._seedUnit({
      id: 'u_1',
      productId: 'phone_01',
      variantId: 'var_1',
      serialNumber: 'SN_PHONE_1',
      status: 'ASSIGNED',
      orderId: 'ord_device_1',
      orderItemId: 'item_1',
    });

    const readiness = await assertOrderSerializationReady(db, 'ord_device_1');
    assert.equal(readiness.ready, false);
    assert.equal(readiness.missingCount, 1);

    // Legacy admin override allows shipment with reason and audit trail seam
    const override = await assertOrderSerializationReady(db, 'ord_device_1', {
      allowLegacyAdminOverride: true,
      adminUserId: 'admin_super',
      overrideReason: 'Legacy inventory unit without barcode',
    });
    assert.equal(override.ready, true);
    assert.equal(override.overridden, true);
  });

  it('marks assigned units as SOLD when order transitions to SHIPPING or COMPLETED', async () => {
    const db = createSerializedMockDb();
    db._seedUnit({
      id: 'u_sold_test',
      productId: 'laptop_01',
      status: 'ASSIGNED',
      orderId: 'ord_ship_1',
    });

    await markOrderUnitsSold(db, 'ord_ship_1');

    const unit = await db.serializedUnit.findUnique({ where: { id: 'u_sold_test' } });
    assert.equal(unit.status, 'SOLD');
    assert.ok(unit.soldAt);
  });
});
