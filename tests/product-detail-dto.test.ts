import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapToProductDetailDto,
  buildProductDetailCacheKey,
  buildProductComparisonMatrix,
} from '../src/server/modules/catalog/product-detail-dto.service.ts';
import type { CategorySpecSchema, ProductSpecs } from '../src/shared/types/catalog.ts';

const LAPTOP_SCHEMA: CategorySpecSchema = {
  schemaVersion: 1,
  definitions: [
    { code: 'cpu_model', label: 'Vi xử lý', valueType: 'TEXT', required: true, comparable: true },
    { code: 'ram_capacity_gb', label: 'Dung lượng RAM', valueType: 'INTEGER', unit: 'GB', required: true, comparable: true, isOption: true },
    { code: 'storage_capacity_gb', label: 'Bộ nhớ trong', valueType: 'INTEGER', unit: 'GB', required: true, comparable: true, isOption: true },
    { code: 'cellular', label: 'Mạng di động', valueType: 'TEXT', allowUnsupported: true, comparable: true },
    { code: 'nfc', label: 'Kết nối NFC', valueType: 'BOOLEAN', allowUnsupported: true, comparable: true },
  ],
  variantOptions: [],
};

describe('ProductDetailDto Mapping & Invariants', () => {
  it('preserves UNKNOWN and UNSUPPORTED spec values distinctly without collapsing', () => {
    const rawSpecs: ProductSpecs = {
      schemaVersion: 1,
      values: {
        cpu_model: { state: 'KNOWN', value: 'Apple M3 Pro' },
        ram_capacity_gb: { state: 'KNOWN', value: 18, unit: 'GB' },
        storage_capacity_gb: { state: 'UNKNOWN' },
        cellular: { state: 'UNSUPPORTED' },
      },
    };

    const rawProduct = {
      id: 'prod-macbook-m3',
      name: 'MacBook Pro 14 M3 Pro',
      slug: 'macbook-pro-14-m3-pro',
      description: 'Chính hãng Apple',
      price: BigInt(49990000),
      stock: 10,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'LAPTOP' as const,
      segment: 'PREMIUM' as const,
      isLegacy: false,
      catalogVersion: 2,
      specs: rawSpecs,
      images: [{ url: 'https://cdn.example.com/mbp14.jpg', alt: 'MacBook Pro 14', sortOrder: 0 }],
      createdAt: new Date('2026-10-18T00:00:00Z'),
      updatedAt: new Date('2026-10-18T01:00:00Z'),
      brand: { id: 'brand-apple', name: 'Apple', slug: 'apple' },
      categoryRef: { id: 'cat-laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const, specSchema: LAPTOP_SCHEMA, specSchemaVersion: 1 },
      variants: [],
      dataSources: [],
    };

    const dto = mapToProductDetailDto(rawProduct, { categorySchema: LAPTOP_SCHEMA });

    assert.equal(dto.id, 'prod-macbook-m3');
    assert.equal(dto.legacy, false);
    assert.ok(dto.specs);
    assert.equal(dto.specs.schemaVersion, 1);

    // Check cpu_model is KNOWN
    const cpu = dto.specs.byCode['cpu_model'];
    assert.equal(cpu?.state, 'KNOWN');
    assert.equal(cpu?.value, 'Apple M3 Pro');

    // Check storage_capacity_gb is strictly UNKNOWN
    const storage = dto.specs.byCode['storage_capacity_gb'];
    assert.equal(storage?.state, 'UNKNOWN');
    assert.equal(storage?.value, undefined);

    // Check cellular is strictly UNSUPPORTED
    const cellular = dto.specs.byCode['cellular'];
    assert.equal(cellular?.state, 'UNSUPPORTED');
    assert.equal(cellular?.value, undefined);

    // Verify UNKNOWN and UNSUPPORTED are not equal
    assert.notEqual(storage?.state, cellular?.state);
  });

  it('excludes inactive, pending, or revoked data sources from the storefront DTO', () => {
    const rawProduct = {
      id: 'prod-iphone-16',
      name: 'iPhone 16 Pro',
      price: 28990000,
      stock: 5,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'PHONE' as const,
      segment: 'FLAGSHIP' as const,
      isLegacy: false,
      catalogVersion: 1,
      specs: null,
      images: [],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T01:00:00Z',
      brand: { id: 'brand-apple', name: 'Apple', slug: 'apple' },
      categoryRef: { id: 'cat-phone', name: 'Điện thoại', slug: 'dien-thoai', kind: 'PHONE' as const },
      variants: [],
      dataSources: [
        {
          id: 'src-1',
          name: 'Official Specs',
          sourceType: 'CATALOG',
          status: 'ACTIVE',
          publisher: 'Apple Vietnam',
          url: 'https://apple.com/vn/iphone-16-pro/specs',
          licenseDecision: 'APPROVED',
          version: '1.0',
          isSynthetic: false,
          checksum: 'sha256-abc123',
        },
        {
          id: 'src-2',
          name: 'Draft Benchmark',
          sourceType: 'BENCHMARK',
          status: 'MAPPING_REVIEW', // Inactive
          publisher: 'Geekbench Labs',
          url: 'https://browser.geekbench.com/v6/cpu/99999',
        },
        {
          id: 'src-3',
          name: 'Revoked Scraper',
          sourceType: 'CATALOG',
          status: 'REVOKED', // Revoked
          publisher: 'Untrusted Site',
          url: 'https://example.com/untrusted',
        },
      ],
    };

    const dto = mapToProductDetailDto(rawProduct);

    assert.equal(dto.sources.length, 1);
    assert.equal(dto.sources[0].id, 'src-1');
    assert.equal(dto.sources[0].publisher, 'Apple Vietnam');
    assert.equal(dto.sources[0].sourceType, 'CATALOG');
  });

  it('serializes BigInt prices to MoneySnapshot with exact amount and formatted VND', () => {
    const rawProduct = {
      id: 'prod-mouse',
      name: 'Chuột không dây Logitech MX Master 3S',
      price: BigInt(2490000),
      stock: 15,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'ACCESSORY' as const,
      segment: 'PREMIUM' as const,
      isLegacy: false,
      catalogVersion: 1,
      specs: null,
      images: [{ url: 'https://cdn.example.com/mx3s.jpg', alt: 'Logitech MX Master 3S', sortOrder: 0 }],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T01:00:00Z',
      category: 'Phụ kiện',
      variants: [],
      dataSources: [],
    };

    const dto = mapToProductDetailDto(rawProduct);

    assert.equal(typeof dto.price.amount, 'string');
    assert.equal(dto.price.amount, '2490000');
    assert.match(dto.price.formatted, /2\.490\.000/);
    assert.equal(dto.effectivePrice.amount, '2490000');
    assert.equal(dto.priceRange.min, '2490000');
    assert.equal(dto.priceRange.max, '2490000');
  });

  it('calculates effective price from active sellable variants in VARIANT mode', () => {
    const rawProduct = {
      id: 'prod-dell-xps',
      name: 'Dell XPS 13',
      price: BigInt(35000000),
      stock: 0,
      isActive: true,
      inventoryMode: 'VARIANT' as const,
      kind: 'LAPTOP' as const,
      segment: 'PREMIUM' as const,
      isLegacy: false,
      catalogVersion: 1,
      specs: null,
      images: [],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T01:00:00Z',
      brand: { id: 'brand-dell', name: 'Dell', slug: 'dell' },
      categoryRef: { id: 'cat-laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
      variants: [
        {
          id: 'var-1',
          productId: 'prod-dell-xps',
          sku: 'DELL-XPS-13-16GB',
          title: 'Dell XPS 13 16GB RAM / 512GB SSD',
          price: BigInt(29990000),
          stock: 4,
          isActive: true,
          color: 'Bạc',
          size: null,
          optionValues: { ram: 16, storage: 512, color: 'Bạc' },
          optionHash: 'hash-var-1',
          serializationRequired: true,
          images: [],
        },
        {
          id: 'var-2',
          productId: 'prod-dell-xps',
          sku: 'DELL-XPS-13-32GB',
          title: 'Dell XPS 13 32GB RAM / 1TB SSD',
          price: BigInt(38990000),
          stock: 2,
          isActive: true,
          color: 'Bạc',
          size: null,
          optionValues: { ram: 32, storage: 1024, color: 'Bạc' },
          optionHash: 'hash-var-2',
          serializationRequired: true,
          images: [],
        },
        {
          id: 'var-inactive',
          productId: 'prod-dell-xps',
          sku: 'DELL-XPS-13-CHEAP-DISCONTINUED',
          title: 'Discontinued SKU',
          price: BigInt(15000000), // Inactive SKU must not skew effective price
          stock: 10,
          isActive: false,
          color: 'Đen',
          size: null,
          optionValues: { ram: 8, storage: 256, color: 'Đen' },
          optionHash: 'hash-var-inactive',
          serializationRequired: true,
          images: [],
        },
      ],
      dataSources: [],
    };

    const dto = mapToProductDetailDto(rawProduct);

    assert.equal(dto.variants.length, 2); // Inactive variant omitted or flagged
    assert.equal(dto.effectivePrice.amount, '29990000');
    assert.equal(dto.priceRange.min, '29990000');
    assert.equal(dto.priceRange.max, '38990000');
    assert.equal(dto.totalStock, 6);
    assert.equal(dto.inStock, true);
  });

  it('maps legacy product faithfully without inventing fake specifications or brand', () => {
    const rawLegacy = {
      id: 'legacy-p1',
      name: 'Sản phẩm cũ chưa phân loại',
      description: 'Hàng tồn kho',
      price: 150000,
      stock: 20,
      isActive: true,
      category: 'Thời trang',
      isLegacy: true,
      specs: null,
      images: null,
      brand: null,
      categoryRef: null,
      variants: [],
      dataSources: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    const dto = mapToProductDetailDto(rawLegacy);

    assert.equal(dto.legacy, true);
    assert.equal(dto.brand, null);
    assert.equal(dto.category.name, 'Thời trang');
    assert.equal(dto.category.kind, 'LEGACY');
    assert.equal(dto.specs, null);
    assert.equal(dto.sources.length, 0);
    assert.equal(dto.images.length, 0);
  });

  it('constructs deterministic cache key incorporating revisions', () => {
    const key = buildProductDetailCacheKey('prod-123', {
      catalogVersion: 3,
      categorySchemaVersion: 2,
      sourceRevision: 'rev-456',
    });

    assert.equal(key, 'cache:product-detail:prod-123:cv3:csv2:srrev-456');
  });
});

describe('Product Comparison Matrix', () => {
  it('creates aligned comparison matrix for 2-3 products and highlights differences', () => {
    const rawP1 = {
      id: 'prod-mac-14',
      name: 'MacBook Pro 14',
      price: BigInt(49990000),
      stock: 5,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'LAPTOP' as const,
      categoryRef: { id: 'cat-laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
      specs: {
        schemaVersion: 1,
        values: {
          cpu_model: { state: 'KNOWN', value: 'Apple M3 Pro' },
          ram_capacity_gb: { state: 'KNOWN', value: 18, unit: 'GB' },
          storage_capacity_gb: { state: 'KNOWN', value: 512, unit: 'GB' },
        },
      },
      images: [],
      variants: [],
      dataSources: [],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    };

    const rawP2 = {
      id: 'prod-mac-16',
      name: 'MacBook Pro 16',
      price: BigInt(64990000),
      stock: 3,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'LAPTOP' as const,
      categoryRef: { id: 'cat-laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
      specs: {
        schemaVersion: 1,
        values: {
          cpu_model: { state: 'KNOWN', value: 'Apple M3 Max' },
          ram_capacity_gb: { state: 'KNOWN', value: 36, unit: 'GB' },
          storage_capacity_gb: { state: 'KNOWN', value: 512, unit: 'GB' },
        },
      },
      images: [],
      variants: [],
      dataSources: [],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    };

    const dto1 = mapToProductDetailDto(rawP1, { categorySchema: LAPTOP_SCHEMA });
    const dto2 = mapToProductDetailDto(rawP2, { categorySchema: LAPTOP_SCHEMA });

    const matrix = buildProductComparisonMatrix([dto1, dto2], LAPTOP_SCHEMA);

    assert.equal(matrix.products.length, 2);
    assert.equal(matrix.compatibleCategory, true);
    assert.ok(matrix.specRows.length >= 3);

    // CPU row has difference
    const cpuRow = matrix.specRows.find((r) => r.code === 'cpu_model');
    assert.ok(cpuRow);
    assert.equal(cpuRow?.hasDifference, true);
    assert.equal(cpuRow?.values[0].value, 'Apple M3 Pro');
    assert.equal(cpuRow?.values[1].value, 'Apple M3 Max');

    // Storage row has no difference (both 512)
    const storageRow = matrix.specRows.find((r) => r.code === 'storage_capacity_gb');
    assert.ok(storageRow);
    assert.equal(storageRow?.hasDifference, false);
  });

  it('flags incompatibleCategory when comparing products from different categories', () => {
    const rawLaptop = {
      id: 'prod-laptop',
      name: 'Laptop Asus',
      price: 20000000,
      stock: 5,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'LAPTOP' as const,
      categoryRef: { id: 'cat-laptop', name: 'Laptop', slug: 'laptop', kind: 'LAPTOP' as const },
      specs: null,
      images: [],
      variants: [],
      dataSources: [],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    };

    const rawPhone = {
      id: 'prod-phone',
      name: 'Phone Samsung',
      price: 15000000,
      stock: 5,
      isActive: true,
      inventoryMode: 'BASE' as const,
      kind: 'PHONE' as const,
      categoryRef: { id: 'cat-phone', name: 'Điện thoại', slug: 'phone', kind: 'PHONE' as const },
      specs: null,
      images: [],
      variants: [],
      dataSources: [],
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z',
    };

    const dto1 = mapToProductDetailDto(rawLaptop);
    const dto2 = mapToProductDetailDto(rawPhone);

    const matrix = buildProductComparisonMatrix([dto1, dto2]);
    assert.equal(matrix.compatibleCategory, false);
  });
});
