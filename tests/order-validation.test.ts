import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderItems, buildValidatedOrderItems, MAX_QUANTITY_PER_ITEM } from '../src/lib/order-validation.ts';
import type { Product } from '@prisma/client';

describe('Order Validation - parseOrderItems', () => {
  it('should return error for empty or invalid array', () => {
    assert.ok(parseOrderItems([]).error);
    assert.ok(parseOrderItems(null).error);
    assert.ok(parseOrderItems({}).error);
  });

  it('should return error for missing productId', () => {
    const res = parseOrderItems([{ quantity: 2 }]);
    assert.ok(res.error);
    assert.match(res.error!, /Thiếu mã sản phẩm/);
  });

  it('should return error for invalid or zero quantity', () => {
    assert.match(parseOrderItems([{ productId: '1', quantity: 0 }]).error!, /Số lượng/);
    assert.match(parseOrderItems([{ productId: '1', quantity: -5 }]).error!, /Số lượng/);
    assert.match(parseOrderItems([{ productId: '1', quantity: 2.5 }]).error!, /Số lượng/);
  });

  it('should enforce max quantity per item limit', () => {
    assert.match(parseOrderItems([{ productId: '1', quantity: MAX_QUANTITY_PER_ITEM + 1 }]).error!, /tối đa/);
  });

  it('should parse valid items correctly', () => {
    const res = parseOrderItems([{ productId: 'prod_1', quantity: 5 }]);
    assert.equal(res.error, undefined);
    assert.equal(res.items?.length, 1);
    assert.equal(res.items?.[0].productId, 'prod_1');
    assert.equal(res.items?.[0].quantity, 5);
  });
});

describe('Order Validation - buildValidatedOrderItems', () => {
  const mockProducts = [
    { id: '1', name: 'Product 1', price: 100_000, stock: 10, isActive: true },
    { id: '2', name: 'Product 2', price: 200_000, stock: 0, isActive: true },
    { id: '3', name: 'Product 3', price: 50_000, stock: 50, isActive: false },
  ] as Product[];

  it('should return error if product does not exist', () => {
    const res = buildValidatedOrderItems([{ productId: 'invalid', quantity: 1 }], mockProducts);
    assert.ok(res.error);
    assert.match(res.error!, /không tồn tại/);
  });

  it('should return error if product is inactive', () => {
    const res = buildValidatedOrderItems([{ productId: '3', quantity: 1 }], mockProducts);
    assert.ok(res.error);
    assert.match(res.error!, /ngừng bán/);
  });

  it('should return error if quantity exceeds stock', () => {
    const res = buildValidatedOrderItems([{ productId: '1', quantity: 15 }], mockProducts);
    assert.ok(res.error);
    assert.match(res.error!, /chỉ còn 10/);
  });

  it('should calculate totals and return valid order items', () => {
    const res = buildValidatedOrderItems(
      [
        { productId: '1', quantity: 2 }, // 200k
      ],
      mockProducts
    );
    assert.equal(res.error, undefined);
    assert.equal(res.orderItems?.length, 1);
    assert.equal(res.subtotal, 200_000);
    assert.equal(res.shippingFee, 30_000);
    assert.equal(res.totalAmount, 230_000);
  });
});
