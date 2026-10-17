import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStockTarget,
  normalizeOrderStockItems,
  type ProductStockShape,
} from '@shared/types/inventory';

describe('Inventory Mode & Target Stock Validation', () => {
  it('should reject VARIANT product without variantId even when all variants are inactive', () => {
    const product: ProductStockShape = {
      id: 'p-variant',
      name: 'Phone Pro',
      inventoryMode: 'VARIANT',
      stock: 10,
      isActive: true,
      variants: [
        { id: 'v1', title: 'Black', stock: 10, isActive: false },
        { id: 'v2', title: 'White', stock: 5, isActive: false },
      ],
    };

    const res = validateStockTarget(product, {
      productId: 'p-variant',
      variantId: null,
      quantity: 1,
    });

    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /chọn phân loại/i);
  });

  it('should reject BASE product when variantId is provided', () => {
    const product: ProductStockShape = {
      id: 'p-base',
      name: 'USB Cable',
      inventoryMode: 'BASE',
      stock: 50,
      isActive: true,
      variants: [],
    };

    const res = validateStockTarget(product, {
      productId: 'p-base',
      variantId: 'v-unexpected',
      quantity: 1,
    });

    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /không có phân loại/i);
  });

  it('should reject inactive variant', () => {
    const product: ProductStockShape = {
      id: 'p-variant',
      name: 'Phone Pro',
      inventoryMode: 'VARIANT',
      stock: 20,
      isActive: true,
      variants: [
        { id: 'v1', title: 'Black', stock: 10, isActive: false },
        { id: 'v2', title: 'White', stock: 10, isActive: true },
      ],
    };

    const res = validateStockTarget(product, {
      productId: 'p-variant',
      variantId: 'v1',
      quantity: 1,
    });

    assert.equal(res.valid, false);
    assert.match((res as { error: string }).error, /ngừng bán|không tồn tại/i);
  });

  it('should accept valid variant with sufficient stock', () => {
    const product: ProductStockShape = {
      id: 'p-variant',
      name: 'Phone Pro',
      inventoryMode: 'VARIANT',
      stock: 20,
      isActive: true,
      variants: [
        { id: 'v2', title: 'White', stock: 10, isActive: true },
      ],
    };

    const res = validateStockTarget(product, {
      productId: 'p-variant',
      variantId: 'v2',
      quantity: 3,
    });

    assert.equal(res.valid, true);
    if (res.valid) {
      assert.equal(res.variantId, 'v2');
      assert.equal(res.targetStock, 10);
    }
  });

  it('should normalize duplicate product+variant cart lines before CAS', () => {
    const rawItems = [
      { productId: 'p1', variantId: 'v1', quantity: 2 },
      { productId: 'p2', variantId: null, quantity: 1 },
      { productId: 'p1', variantId: 'v1', quantity: 3 },
      { productId: 'p1', variantId: 'v2', quantity: 4 },
      { productId: 'p2', variantId: null, quantity: 5 },
    ];

    const normalized = normalizeOrderStockItems(rawItems);
    assert.equal(normalized.length, 3);

    const p1v1 = normalized.find((i) => i.productId === 'p1' && i.variantId === 'v1');
    assert.equal(p1v1?.quantity, 5);

    const p2base = normalized.find((i) => i.productId === 'p2' && i.variantId === null);
    assert.equal(p2base?.quantity, 6);

    const p1v2 = normalized.find((i) => i.productId === 'p1' && i.variantId === 'v2');
    assert.equal(p1v2?.quantity, 4);
  });
});
