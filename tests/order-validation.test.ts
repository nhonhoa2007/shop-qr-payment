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

  it('should parse valid items with variantId correctly', () => {
    const res = parseOrderItems([{ productId: 'prod_1', variantId: 'var_1', quantity: 3 }]);
    assert.equal(res.error, undefined);
    assert.equal(res.items?.length, 1);
    assert.equal(res.items?.[0].productId, 'prod_1');
    assert.equal(res.items?.[0].variantId, 'var_1');
    assert.equal(res.items?.[0].quantity, 3);
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

  it('should require variant selection if product has active variants', () => {
    const productsWithVariants = [
      {
        id: 'p_var',
        name: 'Áo thun có size',
        price: 150_000,
        stock: 50,
        isActive: true,
        variants: [
          { id: 'v_s', productId: 'p_var', title: 'Size S', price: 150_000, stock: 5, isActive: true },
          { id: 'v_m', productId: 'p_var', title: 'Size M', price: 160_000, stock: 10, isActive: true },
        ],
      },
    ] as unknown as Product[];

    const res = buildValidatedOrderItems([{ productId: 'p_var', quantity: 1 }], productsWithVariants);
    assert.ok(res.error);
    assert.match(res.error!, /chọn phân loại/);
  });

  it('should return error if variant does not exist or is inactive', () => {
    const productsWithVariants = [
      {
        id: 'p_var',
        name: 'Áo thun',
        price: 150_000,
        stock: 50,
        isActive: true,
        variants: [
          { id: 'v_active', productId: 'p_var', title: 'Size S', price: 150_000, stock: 5, isActive: true },
          { id: 'v_inactive', productId: 'p_var', title: 'Size M', price: 160_000, stock: 10, isActive: false },
        ],
      },
    ] as unknown as Product[];

    const resMissing = buildValidatedOrderItems(
      [{ productId: 'p_var', variantId: 'v_non_existent', quantity: 1 }],
      productsWithVariants
    );
    assert.ok(resMissing.error);
    assert.match(resMissing.error!, /không tồn tại/);

    const resInactive = buildValidatedOrderItems(
      [{ productId: 'p_var', variantId: 'v_inactive', quantity: 1 }],
      productsWithVariants
    );
    assert.ok(resInactive.error);
    assert.match(resInactive.error!, /ngừng bán/);
  });

  it('should return error if quantity exceeds variant stock', () => {
    const productsWithVariants = [
      {
        id: 'p_var',
        name: 'Áo thun',
        price: 150_000,
        stock: 50,
        isActive: true,
        variants: [
          { id: 'v_s', productId: 'p_var', title: 'Size S', price: 150_000, stock: 3, isActive: true },
        ],
      },
    ] as unknown as Product[];

    const res = buildValidatedOrderItems(
      [{ productId: 'p_var', variantId: 'v_s', quantity: 5 }],
      productsWithVariants
    );
    assert.ok(res.error);
    assert.match(res.error!, /chỉ còn 3/);
  });

  it('should calculate totals using variant price and include variant metadata', () => {
    const productsWithVariants = [
      {
        id: 'p_var',
        name: 'Áo thun',
        price: 150_000,
        stock: 50,
        isActive: true,
        variants: [
          { id: 'v_xl', productId: 'p_var', title: 'Size XL', price: 180_000, stock: 10, isActive: true },
        ],
      },
    ] as unknown as Product[];

    const res = buildValidatedOrderItems(
      [{ productId: 'p_var', variantId: 'v_xl', quantity: 2 }],
      productsWithVariants
    );
    assert.equal(res.error, undefined);
    assert.equal(res.orderItems?.length, 1);
    assert.equal(res.orderItems?.[0].variantId, 'v_xl');
    assert.equal(res.orderItems?.[0].variantTitle, 'Size XL');
    assert.equal(res.orderItems?.[0].price, 180_000);
    assert.equal(res.subtotal, 360_000);
    assert.equal(res.shippingFee, 30_000);
    assert.equal(res.totalAmount, 390_000);
  });
});
