import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInventoryMovement,
  computeMovementFingerprint,
} from '@server/modules/inventory/inventory-ledger.service';
import type { ApplyMovementInput, StockTarget } from '@shared/types/inventory-ledger';

type MockTx = any;

function createMockTx(initialData?: {
  product?: {
    id: string;
    onHandStock: number;
    reservedStock: number;
    quarantinedStock: number;
    stock: number;
    stockVersion: number;
    inventoryMode?: 'BASE' | 'VARIANT';
    isActive?: boolean;
  };
  variant?: {
    id: string;
    productId: string;
    onHandStock: number;
    reservedStock: number;
    quarantinedStock: number;
    stock: number;
    stockVersion: number;
    isActive?: boolean;
  };
  movements?: any[];
}) {
  const product = initialData?.product
    ? {
        ...initialData.product,
        inventoryMode: initialData.product.inventoryMode ?? 'BASE',
        isActive: initialData.product.isActive ?? true,
      }
    : null;

  const variant = initialData?.variant
    ? {
        ...initialData.variant,
        isActive: initialData.variant.isActive ?? true,
      }
    : null;

  const movements: any[] = initialData?.movements ? [...initialData.movements] : [];

  const tx: MockTx = {
    product: {
      findUnique: async ({ where }: any) => {
        if (product && product.id === where.id) {
          return { ...product };
        }
        return null;
      },
      updateMany: async ({ where, data }: any) => {
        if (!product || product.id !== where.id) return { count: 0 };
        if (where.stockVersion !== undefined && product.stockVersion !== where.stockVersion) {
          return { count: 0 };
        }
        if (where.isActive !== undefined && product.isActive !== where.isActive) {
          return { count: 0 };
        }

        // Apply CAS increments/decrements
        if (data.onHandStock?.increment !== undefined) product.onHandStock += data.onHandStock.increment;
        if (data.onHandStock?.decrement !== undefined) product.onHandStock -= data.onHandStock.decrement;
        if (data.reservedStock?.increment !== undefined) product.reservedStock += data.reservedStock.increment;
        if (data.reservedStock?.decrement !== undefined) product.reservedStock -= data.reservedStock.decrement;
        if (data.quarantinedStock?.increment !== undefined) product.quarantinedStock += data.quarantinedStock.increment;
        if (data.quarantinedStock?.decrement !== undefined) product.quarantinedStock -= data.quarantinedStock.decrement;
        if (data.stock?.increment !== undefined) product.stock += data.stock.increment;
        if (data.stock?.decrement !== undefined) product.stock -= data.stock.decrement;
        if (data.stockVersion?.increment !== undefined) product.stockVersion += data.stockVersion.increment;

        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        if (!product || product.id !== where.id) throw new Error('Product not found');
        if (data.onHandStock?.increment !== undefined) product.onHandStock += data.onHandStock.increment;
        if (data.onHandStock?.decrement !== undefined) product.onHandStock -= data.onHandStock.decrement;
        if (data.reservedStock?.increment !== undefined) product.reservedStock += data.reservedStock.increment;
        if (data.reservedStock?.decrement !== undefined) product.reservedStock -= data.reservedStock.decrement;
        if (data.quarantinedStock?.increment !== undefined) product.quarantinedStock += data.quarantinedStock.increment;
        if (data.quarantinedStock?.decrement !== undefined) product.quarantinedStock -= data.quarantinedStock.decrement;
        if (data.stock?.increment !== undefined) product.stock += data.stock.increment;
        if (data.stock?.decrement !== undefined) product.stock -= data.stock.decrement;
        if (data.stockVersion?.increment !== undefined) product.stockVersion += data.stockVersion.increment;
        return { ...product };
      },
    },
    productVariant: {
      findUnique: async ({ where }: any) => {
        if (variant && variant.id === where.id) {
          return { ...variant };
        }
        return null;
      },
      updateMany: async ({ where, data }: any) => {
        if (!variant || variant.id !== where.id) return { count: 0 };
        if (where.stockVersion !== undefined && variant.stockVersion !== where.stockVersion) {
          return { count: 0 };
        }
        if (where.isActive !== undefined && variant.isActive !== where.isActive) {
          return { count: 0 };
        }

        if (data.onHandStock?.increment !== undefined) variant.onHandStock += data.onHandStock.increment;
        if (data.onHandStock?.decrement !== undefined) variant.onHandStock -= data.onHandStock.decrement;
        if (data.reservedStock?.increment !== undefined) variant.reservedStock += data.reservedStock.increment;
        if (data.reservedStock?.decrement !== undefined) variant.reservedStock -= data.reservedStock.decrement;
        if (data.quarantinedStock?.increment !== undefined) variant.quarantinedStock += data.quarantinedStock.increment;
        if (data.quarantinedStock?.decrement !== undefined) variant.quarantinedStock -= data.quarantinedStock.decrement;
        if (data.stock?.increment !== undefined) variant.stock += data.stock.increment;
        if (data.stock?.decrement !== undefined) variant.stock -= data.stock.decrement;
        if (data.stockVersion?.increment !== undefined) variant.stockVersion += data.stockVersion.increment;

        return { count: 1 };
      },
    },
    inventoryMovement: {
      findUnique: async ({ where }: any) => {
        return movements.find((m) => m.operationKey === where.operationKey) || null;
      },
      create: async ({ data }: any) => {
        const record = { id: `mov_${movements.length + 1}`, createdAt: new Date(), ...data };
        movements.push(record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return movements.filter((m) => {
          if (where.productId && m.productId !== where.productId) return false;
          if (where.variantId !== undefined && m.variantId !== where.variantId) return false;
          return true;
        });
      },
    },
    _state: { product, variant, movements },
  };

  return tx;
}

describe('Inventory Movement Ledger - applyInventoryMovement', () => {
  const target: StockTarget = { productId: 'prod_1' };

  it('should reserve stock: reserve 2 from onHand 5 -> available 3', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 0,
        quarantinedStock: 0,
        stock: 5,
        stockVersion: 1,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'order_100:reserve:prod_1',
      target,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 2,
      deltaQuarantined: 0,
      reason: 'Order reserve',
      referenceType: 'ORDER',
      referenceId: 'order_100',
    };

    const projection = await applyInventoryMovement(tx, input);

    assert.equal(projection.onHandStock, 5);
    assert.equal(projection.reservedStock, 2);
    assert.equal(projection.quarantinedStock, 0);
    assert.equal(projection.availableStock, 3);
    assert.equal(projection.stockVersion, 2);

    assert.equal(tx._state.movements.length, 1);
    const mov = tx._state.movements[0];
    assert.equal(mov.kind, 'RESERVE');
    assert.equal(mov.beforeAvailable, 5);
    assert.equal(mov.afterAvailable, 3);
    assert.equal(mov.beforeOnHand, 5);
    assert.equal(mov.afterOnHand, 5);
    assert.equal(mov.beforeReserved, 0);
    assert.equal(mov.afterReserved, 2);
  });

  it('should release reserved stock: release 1 from reserved 2 -> available increases to 4', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 2,
        quarantinedStock: 0,
        stock: 3,
        stockVersion: 2,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'order_100:release:prod_1',
      target,
      kind: 'RELEASE',
      deltaOnHand: 0,
      deltaReserved: -1,
      deltaQuarantined: 0,
      reason: 'Order item cancellation',
      referenceType: 'ORDER',
      referenceId: 'order_100',
    };

    const projection = await applyInventoryMovement(tx, input);
    assert.equal(projection.onHandStock, 5);
    assert.equal(projection.reservedStock, 1);
    assert.equal(projection.availableStock, 4);
  });

  it('should ship stock: consume 1 from reserved and onHand', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 1,
        quarantinedStock: 0,
        stock: 4,
        stockVersion: 3,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'order_100:ship:prod_1',
      target,
      kind: 'SHIP',
      deltaOnHand: -1,
      deltaReserved: -1,
      deltaQuarantined: 0,
      reason: 'Order shipped to carrier',
      referenceType: 'SHIPMENT',
      referenceId: 'ship_01',
    };

    const projection = await applyInventoryMovement(tx, input);
    assert.equal(projection.onHandStock, 4);
    assert.equal(projection.reservedStock, 0);
    assert.equal(projection.availableStock, 4);
  });

  it('should quarantine returned stock: deltaOnHand -1 (if received) or from onHand to quarantine', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 4,
        reservedStock: 0,
        quarantinedStock: 0,
        stock: 4,
        stockVersion: 4,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'return_100:quarantine:prod_1',
      target,
      kind: 'QUARANTINE',
      deltaOnHand: 1, // received into building
      deltaReserved: 0,
      deltaQuarantined: 1, // goes directly to quarantine
      reason: 'Customer return received at dock',
      referenceType: 'RETURN',
      referenceId: 'ret_100',
    };

    const projection = await applyInventoryMovement(tx, input);
    assert.equal(projection.onHandStock, 5);
    assert.equal(projection.quarantinedStock, 1);
    assert.equal(projection.reservedStock, 0);
    // quarantined items are NOT available for sale
    assert.equal(projection.availableStock, 4);
  });

  it('should restock from quarantine: deltaQuarantined -1, available increases', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 0,
        quarantinedStock: 1,
        stock: 4,
        stockVersion: 5,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'return_100:restock:prod_1',
      target,
      kind: 'RESTOCK',
      deltaOnHand: 0,
      deltaReserved: 0,
      deltaQuarantined: -1,
      reason: 'Passed inspection, restocked',
      referenceType: 'RETURN',
      referenceId: 'ret_100',
    };

    const projection = await applyInventoryMovement(tx, input);
    assert.equal(projection.onHandStock, 5);
    assert.equal(projection.quarantinedStock, 0);
    assert.equal(projection.availableStock, 5);
  });

  it('should be replay-safe: same operationKey with same fingerprint returns identical projection without duplicate movement', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 0,
        quarantinedStock: 0,
        stock: 5,
        stockVersion: 1,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'order_100:reserve:prod_1',
      target,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 2,
      deltaQuarantined: 0,
      reason: 'Order reserve',
      referenceType: 'ORDER',
      referenceId: 'order_100',
    };

    const first = await applyInventoryMovement(tx, input);
    assert.equal(tx._state.movements.length, 1);

    // Replay call with exact same payload
    const second = await applyInventoryMovement(tx, input);
    assert.equal(tx._state.movements.length, 1); // No new movement created!
    assert.deepEqual(first, second);
  });

  it('should reject conflict: same operationKey with different payload throws an error', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 0,
        quarantinedStock: 0,
        stock: 5,
        stockVersion: 1,
      },
    });

    const input1: ApplyMovementInput = {
      operationKey: 'shared_key_1',
      target,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 2,
      deltaQuarantined: 0,
      reason: 'Order reserve',
      referenceType: 'ORDER',
      referenceId: 'order_100',
    };

    await applyInventoryMovement(tx, input1);

    const input2: ApplyMovementInput = {
      operationKey: 'shared_key_1',
      target,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 3, // Different payload!
      deltaQuarantined: 0,
      reason: 'Different order reserve',
      referenceType: 'ORDER',
      referenceId: 'order_101',
    };

    await assert.rejects(async () => {
      await applyInventoryMovement(tx, input2);
    }, /Operation key conflict|Conflict/);
  });

  it('should reject negative projection: cannot reserve more than available stock', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 4,
        quarantinedStock: 0,
        stock: 1,
        stockVersion: 1,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'over_reserve_key',
      target,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 2, // only 1 available!
      deltaQuarantined: 0,
      reason: 'Order reserve',
      referenceType: 'ORDER',
      referenceId: 'order_999',
    };

    await assert.rejects(async () => {
      await applyInventoryMovement(tx, input);
    }, /Insufficient stock|Negative stock/i);
  });

  it('should reject negative projection: cannot release more than reserved stock', async () => {
    const tx = createMockTx({
      product: {
        id: 'prod_1',
        onHandStock: 5,
        reservedStock: 1,
        quarantinedStock: 0,
        stock: 4,
        stockVersion: 1,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'over_release_key',
      target,
      kind: 'RELEASE',
      deltaOnHand: 0,
      deltaReserved: -2, // only 1 was reserved
      deltaQuarantined: 0,
      reason: 'Cancel',
      referenceType: 'ORDER',
      referenceId: 'order_999',
    };

    await assert.rejects(async () => {
      await applyInventoryMovement(tx, input);
    }, /Negative reserved stock|Invalid stock delta/i);
  });

  it('should update variant and synchronize parent product stock', async () => {
    const variantTarget: StockTarget = { productId: 'prod_parent', variantId: 'var_child' };
    const tx = createMockTx({
      product: {
        id: 'prod_parent',
        onHandStock: 10,
        reservedStock: 0,
        quarantinedStock: 0,
        stock: 10,
        stockVersion: 1,
        inventoryMode: 'VARIANT',
      },
      variant: {
        id: 'var_child',
        productId: 'prod_parent',
        onHandStock: 6,
        reservedStock: 0,
        quarantinedStock: 0,
        stock: 6,
        stockVersion: 1,
      },
    });

    const input: ApplyMovementInput = {
      operationKey: 'variant_reserve_1',
      target: variantTarget,
      kind: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: 2,
      deltaQuarantined: 0,
      reason: 'Variant order',
      referenceType: 'ORDER',
      referenceId: 'order_v1',
    };

    const projection = await applyInventoryMovement(tx, input);

    // Variant projection
    assert.equal(projection.onHandStock, 6);
    assert.equal(projection.reservedStock, 2);
    assert.equal(projection.availableStock, 4);

    // Parent product should be synchronized
    assert.equal(tx._state.product.reservedStock, 2);
    assert.equal(tx._state.product.stock, 8);
  });
});
