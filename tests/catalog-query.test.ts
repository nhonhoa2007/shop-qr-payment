import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCatalogQuery,
  queryCatalog,
  type CatalogQueryDb,
} from '../src/server/modules/catalog/catalog-query.service.ts';
import type { CatalogQuery } from '../src/shared/types/catalog-query.ts';
import type { ProductSpecs } from '../src/shared/types/catalog.ts';

describe('Catalog Query Normalization & Security', () => {
  it('clamps page and limit to safe boundaries', () => {
    const q1 = normalizeCatalogQuery({ page: 0, limit: 0 });
    assert.equal(q1.page, 1);
    assert.equal(q1.limit, 1);

    const q2 = normalizeCatalogQuery({ page: -5, limit: 100 });
    assert.equal(q2.page, 1);
    assert.equal(q2.limit, 48);

    const q3 = normalizeCatalogQuery({});
    assert.equal(q3.page, 1);
    assert.equal(q3.limit, 12);
  });

  it('normalizes sort and defaults to newest for invalid sort values', () => {
    assert.equal(normalizeCatalogQuery({ sort: 'price-asc' }).sort, 'price-asc');
    assert.equal(normalizeCatalogQuery({ sort: 'price-desc' }).sort, 'price-desc');
    assert.equal(normalizeCatalogQuery({ sort: 'newest' }).sort, 'newest');
    // @ts-expect-error testing invalid sort
    assert.equal(normalizeCatalogQuery({ sort: 'hacked-sort' }).sort, 'newest');
  });

  it('validates and parses minPrice and maxPrice with BigInt precision', () => {
    const q = normalizeCatalogQuery({ minPrice: '10000000', maxPrice: 25000000 });
    assert.equal(q.minPrice, BigInt(10000000));
    assert.equal(q.maxPrice, BigInt(25000000));
  });

  it('rejects negative prices or minPrice greater than maxPrice', () => {
    assert.throws(
      () => normalizeCatalogQuery({ minPrice: -100 }),
      /must be nonnegative/i
    );
    assert.throws(
      () => normalizeCatalogQuery({ minPrice: 30000000, maxPrice: 20000000 }),
      /minPrice cannot be greater than maxPrice/i
    );
  });

  it('filters out invalid segments and trims brands', () => {
    const q = normalizeCatalogQuery({
      // @ts-expect-error testing invalid segment
      segment: ['FLAGSHIP', 'INVALID_SEGMENT', 'BUDGET'],
      brand: ['  apple ', '', '  samsung  '],
    });
    assert.deepEqual(q.segment, ['FLAGSHIP', 'BUDGET']);
    assert.deepEqual(q.brand, ['apple', 'samsung']);
  });

  it('rejects unknown or malicious spec filter codes', () => {
    assert.throws(
      () =>
        normalizeCatalogQuery({
          specs: {
            'malicious_code; DROP TABLE "Product";--': ['val'],
          },
        }),
      /Invalid or unallowlisted spec code/i
    );

    assert.throws(
      () =>
        normalizeCatalogQuery({
          specs: {
            random_unknown_field: ['16GB'],
          },
        }),
      /Invalid or unallowlisted spec code/i
    );
  });

  it('accepts allowlisted spec codes and cleanses array values', () => {
    const q = normalizeCatalogQuery({
      specs: {
        ram_capacity_gb: ['16', '32', ''],
        cpu_model: ['Apple M3 Pro'],
      },
    });
    assert.deepEqual(q.specs, {
      ram_capacity_gb: ['16', '32'],
      cpu_model: ['Apple M3 Pro'],
    });
  });

  it('rejects empty spec filter value arrays', () => {
    assert.throws(
      () =>
        normalizeCatalogQuery({
          specs: {
            ram_capacity_gb: ['', '  '],
          },
        }),
      /must contain at least one valid value/i
    );
  });
});

describe('Catalog Query Execution with JSON Specs Filter', () => {
  const laptopSpecs16GB: ProductSpecs = {
    schemaVersion: 1,
    attributes: {
      cpu_model: { state: 'KNOWN', value: 'Apple M3' },
      ram_capacity_gb: { state: 'KNOWN', value: 16, unit: 'GB' },
      storage_capacity_gb: { state: 'KNOWN', value: 512, unit: 'GB' },
    },
  };

  const laptopSpecs32GB: ProductSpecs = {
    schemaVersion: 1,
    attributes: {
      cpu_model: { state: 'KNOWN', value: 'Apple M3 Pro' },
      ram_capacity_gb: { state: 'KNOWN', value: 32, unit: 'GB' },
      storage_capacity_gb: { state: 'KNOWN', value: 1024, unit: 'GB' },
    },
  };

  const laptopSpecsUnknownRam: ProductSpecs = {
    schemaVersion: 1,
    attributes: {
      cpu_model: { state: 'KNOWN', value: 'Intel Core i5' },
      ram_capacity_gb: { state: 'UNKNOWN' },
      storage_capacity_gb: { state: 'KNOWN', value: 256, unit: 'GB' },
    },
  };

  const mockDb: CatalogQueryDb = {
    findManyProducts: async (params) => {
      const all = [
        {
          id: 'p1',
          name: 'MacBook Pro 14 M3 16GB',
          slug: 'macbook-pro-14-m3-16gb',
          description: 'MacBook Pro 14',
          price: BigInt(39990000),
          image: '/mbp14.jpg',
          category: 'Laptop',
          brandId: 'b_apple',
          categoryId: 'c_laptop',
          kind: 'LAPTOP' as const,
          segment: 'PREMIUM' as const,
          stock: 10,
          isActive: true,
          inventoryMode: 'VARIANT' as const,
          specs: laptopSpecs16GB,
          createdAt: new Date('2026-10-01'),
          brand: { id: 'b_apple', name: 'Apple', slug: 'apple' },
          categoryRef: { id: 'c_laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
          variants: [
            { id: 'v1', price: BigInt(39990000), stock: 6, isActive: true },
            { id: 'v2', price: BigInt(44990000), stock: 4, isActive: true },
          ],
          reviews: [{ rating: 5 }, { rating: 4 }],
        },
        {
          id: 'p2',
          name: 'MacBook Pro 16 M3 Max 32GB',
          slug: 'macbook-pro-16-m3-max-32gb',
          description: 'MacBook Pro 16',
          price: BigInt(65990000),
          image: '/mbp16.jpg',
          category: 'Laptop',
          brandId: 'b_apple',
          categoryId: 'c_laptop',
          kind: 'LAPTOP' as const,
          segment: 'FLAGSHIP' as const,
          stock: 5,
          isActive: true,
          inventoryMode: 'VARIANT' as const,
          specs: laptopSpecs32GB,
          createdAt: new Date('2026-10-05'),
          brand: { id: 'b_apple', name: 'Apple', slug: 'apple' },
          categoryRef: { id: 'c_laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
          variants: [
            { id: 'v3', price: BigInt(65990000), stock: 5, isActive: true },
          ],
          reviews: [{ rating: 5 }],
        },
        {
          id: 'p3',
          name: 'Laptop Văn Phòng Cũ',
          slug: 'laptop-van-phong-cu',
          description: 'Laptop Cũ',
          price: BigInt(8000000),
          image: '/laptop-old.jpg',
          category: 'Laptop',
          brandId: 'b_dell',
          categoryId: 'c_laptop',
          kind: 'LAPTOP' as const,
          segment: 'BUDGET' as const,
          stock: 2,
          isActive: true,
          inventoryMode: 'BASE' as const,
          specs: laptopSpecsUnknownRam,
          createdAt: new Date('2026-09-15'),
          brand: { id: 'b_dell', name: 'Dell', slug: 'dell' },
          categoryRef: { id: 'c_laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
          variants: [],
          reviews: [],
        },
      ];

      // In-memory filtration matching the query specification
      let filtered = all.filter((p) => p.isActive);

      if (params.category) {
        filtered = filtered.filter(
          (p) => p.category === params.category || p.categoryRef?.slug === params.category || p.categoryId === params.category
        );
      }

      if (params.brand && params.brand.length > 0) {
        filtered = filtered.filter(
          (p) => params.brand!.includes(p.brandId) || (p.brand && params.brand!.includes(p.brand.slug))
        );
      }

      if (params.segment && params.segment.length > 0) {
        filtered = filtered.filter((p) => params.segment!.includes(p.segment));
      }

      if (params.specs && Object.keys(params.specs).length > 0) {
        for (const [code, expectedValues] of Object.entries(params.specs)) {
          filtered = filtered.filter((p) => {
            const attr = p.specs?.attributes?.[code];
            if (!attr || attr.state !== 'KNOWN') return false;
            return expectedValues.includes(String(attr.value));
          });
        }
      }

      const total = filtered.length;
      const skip = (params.page - 1) * params.limit;
      const paginated = filtered.slice(skip, skip + params.limit);

      return { items: paginated, total };
    },
  };

  it('filters products matching specific known JSON spec values', async () => {
    const query: CatalogQuery = {
      category: 'Laptop',
      specs: {
        ram_capacity_gb: ['16'],
      },
      page: 1,
      limit: 10,
    };

    const res = await queryCatalog(query, mockDb);
    assert.equal(res.total, 1);
    assert.equal(res.items[0].id, 'p1');
    assert.equal(res.items[0].effectivePrice, '39990000');
  });

  it('three-state knowledge: UNKNOWN specs do not match specific value filters', async () => {
    const query: CatalogQuery = {
      specs: {
        ram_capacity_gb: ['8', '16', '32'],
      },
    };

    const res = await queryCatalog(query, mockDb);
    // p1 (16GB) and p2 (32GB) match. p3 has UNKNOWN ram so it MUST NOT match!
    assert.equal(res.total, 2);
    const ids = res.items.map((i) => i.id);
    assert.ok(ids.includes('p1'));
    assert.ok(ids.includes('p2'));
    assert.ok(!ids.includes('p3'));
  });

  it('filters with multiple spec criteria (AND logic)', async () => {
    const query: CatalogQuery = {
      specs: {
        ram_capacity_gb: ['16', '32'],
        storage_capacity_gb: ['1024'],
      },
    };

    const res = await queryCatalog(query, mockDb);
    assert.equal(res.total, 1);
    assert.equal(res.items[0].id, 'p2');
  });

  it('returns correctly formatted CatalogItemDto with MoneyVnd strings and pagination', async () => {
    const query: CatalogQuery = {
      page: 1,
      limit: 2,
    };

    const res = await queryCatalog(query, mockDb);
    assert.equal(res.page, 1);
    assert.equal(res.limit, 2);
    assert.equal(res.total, 3);
    assert.equal(res.totalPages, 2);
    assert.equal(res.items.length, 2);

    const first = res.items[0];
    assert.equal(typeof first.price, 'string');
    assert.equal(typeof first.effectivePrice, 'string');
    assert.equal(typeof first.priceRange.min, 'string');
    assert.equal(typeof first.priceRange.max, 'string');
    assert.equal(first.brand?.name, 'Apple');
    assert.equal(first.category?.kind, 'LAPTOP');
  });
});
