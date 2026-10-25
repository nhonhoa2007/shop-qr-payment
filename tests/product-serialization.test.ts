import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeProductForJson } from '@server/modules/products/product-serialization';

test('serializeProductForJson makes the product deletion result JSON-safe', () => {
  const deletedProduct = {
    id: 'product-1',
    name: 'Laptop',
    price: 35_000_000n,
    stock: 4,
    variants: [
      {
        id: 'variant-1',
        sku: 'LAPTOP-32GB',
        price: 42_000_000n,
        stock: 2,
      },
    ],
  };

  assert.throws(() => JSON.stringify({ success: true, product: deletedProduct }), /BigInt/);

  const responseBody = {
    success: true,
    type: 'PRODUCT',
    productId: deletedProduct.id,
    product: serializeProductForJson(deletedProduct),
  };

  assert.doesNotThrow(() => JSON.stringify(responseBody));
  assert.equal(responseBody.product.price, '35000000');
  assert.equal(responseBody.product.variants[0].price, '42000000');
});
