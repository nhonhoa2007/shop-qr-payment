import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProductPricing,
  queryCatalog,
  type CatalogQueryDb,
} from '../src/server/modules/catalog/catalog-query.service.ts';

describe('Catalog Effective SKU Pricing & Sorting', () => {
  it('computes effective price for BASE inventory mode using product base price', () => {
    const product = {
      price: BigInt(15000000),
      stock: 5,
      inventoryMode: 'BASE' as const,
      variants: [],
    };

    const pricing = resolveProductPricing(product);
    assert.equal(pricing.effectivePrice, '15000000');
    assert.equal(pricing.priceRange.min, '15000000');
    assert.equal(pricing.priceRange.max, '15000000');
    assert.equal(pricing.totalStock, 5);
    assert.equal(pricing.inStock, true);
  });

  it('computes effective price for VARIANT inventory mode as min active variant price', () => {
    const product = {
      price: BigInt(50000000), // base placeholder price
      stock: 12,
      inventoryMode: 'VARIANT' as const,
      variants: [
        { id: 'v1', price: BigInt(29990000), stock: 4, isActive: true },
        { id: 'v2', price: BigInt(34990000), stock: 6, isActive: true },
        { id: 'v3', price: BigInt(42990000), stock: 2, isActive: true },
      ],
    };

    const pricing = resolveProductPricing(product);
    assert.equal(pricing.effectivePrice, '29990000');
    assert.equal(pricing.priceRange.min, '29990000');
    assert.equal(pricing.priceRange.max, '42990000');
    assert.equal(pricing.totalStock, 12);
    assert.equal(pricing.inStock, true);
  });

  it('ignores inactive variants when resolving effective price and price range', () => {
    const product = {
      price: BigInt(40000000),
      stock: 10,
      inventoryMode: 'VARIANT' as const,
      variants: [
        { id: 'v_cheap_inactive', price: BigInt(15000000), stock: 0, isActive: false },
        { id: 'v_active_1', price: BigInt(32000000), stock: 5, isActive: true },
        { id: 'v_active_2', price: BigInt(38000000), stock: 5, isActive: true },
      ],
    };

    const pricing = resolveProductPricing(product);
    // 15,000,000 must be ignored because it is inactive!
    assert.equal(pricing.effectivePrice, '32000000');
    assert.equal(pricing.priceRange.min, '32000000');
    assert.equal(pricing.priceRange.max, '38000000');
  });

  it('falls back to product base price if all variants are inactive', () => {
    const product = {
      price: BigInt(25000000),
      stock: 0,
      inventoryMode: 'VARIANT' as const,
      variants: [
        { id: 'v1', price: BigInt(20000000), stock: 0, isActive: false },
        { id: 'v2', price: BigInt(22000000), stock: 0, isActive: false },
      ],
    };

    const pricing = resolveProductPricing(product);
    assert.equal(pricing.effectivePrice, '25000000');
    assert.equal(pricing.priceRange.min, '25000000');
    assert.equal(pricing.priceRange.max, '25000000');
  });

  it('orders products by effective SKU price ascending (price-asc)', async () => {
    // Product A: Base price is 60M, but has active variant for 22M (effective: 22M)
    // Product B: Base price 25M (effective: 25M)
    // Product C: Base price 35M, active variants at 35M and 45M (effective: 35M)
    const mockDb: CatalogQueryDb = {
      findManyProducts: async (params) => {
        const all = [
          {
            id: 'prod_b',
            name: 'Product B',
            price: BigInt(25000000),
            stock: 5,
            isActive: true,
            inventoryMode: 'BASE' as const,
            variants: [],
            createdAt: new Date('2026-10-01'),
          },
          {
            id: 'prod_c',
            name: 'Product C',
            price: BigInt(35000000),
            stock: 8,
            isActive: true,
            inventoryMode: 'VARIANT' as const,
            variants: [
              { id: 'vc1', price: BigInt(35000000), stock: 4, isActive: true },
              { id: 'vc2', price: BigInt(45000000), stock: 4, isActive: true },
            ],
            createdAt: new Date('2026-10-02'),
          },
          {
            id: 'prod_a',
            name: 'Product A',
            price: BigInt(60000000),
            stock: 3,
            isActive: true,
            inventoryMode: 'VARIANT' as const,
            variants: [
              { id: 'va1', price: BigInt(22000000), stock: 3, isActive: true },
              { id: 'va2', price: BigInt(60000000), stock: 0, isActive: true },
            ],
            createdAt: new Date('2026-10-03'),
          },
        ];

        // Sort by effective price ascending
        const sorted = [...all].sort((p1, p2) => {
          const pr1 = BigInt(resolveProductPricing(p1).effectivePrice);
          const pr2 = BigInt(resolveProductPricing(p2).effectivePrice);
          if (params.sort === 'price-asc') {
            return pr1 < pr2 ? -1 : pr1 > pr2 ? 1 : 0;
          }
          if (params.sort === 'price-desc') {
            return pr1 > pr2 ? -1 : pr1 < pr2 ? 1 : 0;
          }
          return p2.createdAt.getTime() - p1.createdAt.getTime();
        });

        return { items: sorted, total: sorted.length };
      },
    };

    const resAsc = await queryCatalog({ sort: 'price-asc', page: 1, limit: 10 }, mockDb);
    assert.equal(resAsc.items[0].id, 'prod_a'); // 22M
    assert.equal(resAsc.items[1].id, 'prod_b'); // 25M
    assert.equal(resAsc.items[2].id, 'prod_c'); // 35M

    const resDesc = await queryCatalog({ sort: 'price-desc', page: 1, limit: 10 }, mockDb);
    assert.equal(resDesc.items[0].id, 'prod_c'); // 35M
    assert.equal(resDesc.items[1].id, 'prod_b'); // 25M
    assert.equal(resDesc.items[2].id, 'prod_a'); // 22M
  });
});
