import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reserveOrderStock, releaseOrderStock } from '@server/modules/inventory/inventory.service';

type TxClient = Parameters<typeof reserveOrderStock>[0];

describe('Inventory Reservation Logic - reserveOrderStock', () => {
  it('should reserve base product stock atomically when stock is sufficient', async () => {
    let updateCalledWith: unknown = null;
    const fakeTx = {
      product: {
        updateMany: async (args: unknown) => {
          updateCalledWith = args;
          return { count: 1 };
        },
      },
      productVariant: {
        updateMany: async () => ({ count: 1 }),
      },
    } as unknown as TxClient;

    const result = await reserveOrderStock(fakeTx, [{ productId: 'prod_1', quantity: 2 }]);
    assert.equal(result, null);
    assert.deepEqual(updateCalledWith, {
      where: {
        id: 'prod_1',
        isActive: true,
        stock: { gte: 2 },
      },
      data: { stock: { decrement: 2 } },
    });
  });

  it('should fail and return productId if base product stock is insufficient or inactive', async () => {
    const fakeTx = {
      product: {
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as TxClient;

    const result = await reserveOrderStock(fakeTx, [{ productId: 'prod_out_of_stock', quantity: 5 }]);
    assert.equal(result, 'prod_out_of_stock');
  });

  it('should reserve variant stock atomically when variantId is present and stock is sufficient', async () => {
    let variantUpdateArgs: unknown = null;
    let productSyncArgs: unknown = null;
    const fakeTx = {
      product: {
        // updateMany (chốt điều kiện kho) chỉ dành cho item không có biến thể
        updateMany: async () => {
          throw new Error('Should not use product.updateMany when variantId is provided');
        },
        // Stock sản phẩm gốc được đồng bộ giảm tương ứng
        update: async (args: unknown) => {
          productSyncArgs = args;
          return {};
        },
      },
      productVariant: {
        updateMany: async (args: unknown) => {
          variantUpdateArgs = args;
          return { count: 1 };
        },
      },
    } as unknown as TxClient;

    const result = await reserveOrderStock(fakeTx, [
      { productId: 'prod_1', variantId: 'var_size_m', quantity: 3 },
    ]);

    assert.equal(result, null);
    assert.deepEqual(variantUpdateArgs, {
      where: {
        id: 'var_size_m',
        productId: 'prod_1',
        isActive: true,
        stock: { gte: 3 },
      },
      data: { stock: { decrement: 3 } },
    });
    assert.deepEqual(productSyncArgs, {
      where: { id: 'prod_1' },
      data: { stock: { decrement: 3 } },
    });
  });

  it('should fail and return variantId if variant stock is insufficient or inactive', async () => {
    const fakeTx = {
      productVariant: {
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as TxClient;

    const result = await reserveOrderStock(fakeTx, [
      { productId: 'prod_1', variantId: 'var_out_of_stock', quantity: 1 },
    ]);

    assert.equal(result, 'var_out_of_stock');
  });

  it('should handle mixed batch of base products and variants', async () => {
    const executedUpdates: string[] = [];
    const fakeTx = {
      product: {
        updateMany: async () => {
          executedUpdates.push('product:updateMany');
          return { count: 1 };
        },
        update: async () => {
          executedUpdates.push('product:update');
          return {};
        },
      },
      productVariant: {
        updateMany: async () => {
          executedUpdates.push('variant:updateMany');
          return { count: 1 };
        },
      },
    } as unknown as TxClient;

    const result = await reserveOrderStock(fakeTx, [
      { productId: 'prod_1', quantity: 1 },
      { productId: 'prod_2', variantId: 'var_1', quantity: 2 },
    ]);

    assert.equal(result, null);
    // prod_1 (không biến thể): trừ kho Product trực tiếp.
    // prod_2 (biến thể): trừ kho ProductVariant rồi đồng bộ giảm stock Product gốc.
    assert.deepEqual(executedUpdates, [
      'product:updateMany',
      'variant:updateMany',
      'product:update',
    ]);
  });
});

describe('Inventory Release Logic - releaseOrderStock', () => {
  it('should release base product stock when variantId is absent', async () => {
    let releasedProduct: unknown = null;
    const fakeTx = {
      product: {
        update: async (args: unknown) => {
          releasedProduct = args;
          return {};
        },
      },
      productVariant: {
        update: async () => {
          throw new Error('Should not update variant');
        },
      },
    } as unknown as TxClient;

    await releaseOrderStock(fakeTx, [{ productId: 'prod_1', quantity: 4 }]);

    assert.deepEqual(releasedProduct, {
      where: { id: 'prod_1' },
      data: { stock: { increment: 4 } },
    });
  });

  it('should release variant stock and sync base product stock when variantId is present', async () => {
    let releasedVariant: unknown = null;
    let productSyncArgs: unknown = null;
    const fakeTx = {
      product: {
        update: async (args: unknown) => {
          productSyncArgs = args;
          return {};
        },
      },
      productVariant: {
        update: async (args: unknown) => {
          releasedVariant = args;
          return {};
        },
      },
    } as unknown as TxClient;

    await releaseOrderStock(fakeTx, [
      { productId: 'prod_1', variantId: 'var_xl', quantity: 2 },
    ]);

    assert.deepEqual(releasedVariant, {
      where: { id: 'var_xl' },
      data: { stock: { increment: 2 } },
    });
    // Hoàn kho biến thể phải đồng thời hoàn cả stock sản phẩm gốc
    assert.deepEqual(productSyncArgs, {
      where: { id: 'prod_1' },
      data: { stock: { increment: 2 } },
    });
  });
});
