import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCatalogReadiness,
  type CatalogReadinessDb,
  type ProductForReadiness,
  type DataSourceForReadiness,
} from '../src/server/modules/catalog/catalog-readiness.service.ts';
import type { CategorySpecSchema } from '../src/shared/types/catalog.ts';

const SAMPLE_LAPTOP_SCHEMA: CategorySpecSchema = {
  schemaVersion: 1,
  definitions: [
    {
      code: 'cpu_model',
      label: 'Vi xử lý (CPU)',
      valueType: 'TEXT',
      required: true,
    },
    {
      code: 'ram_capacity',
      label: 'Dung lượng RAM',
      valueType: 'INTEGER',
      unit: 'GB',
      required: true,
    },
  ],
  variantOptions: [
    {
      code: 'storage_capacity',
      label: 'Ổ cứng',
      valueType: 'INTEGER',
      unit: 'GB',
      isOption: true,
    },
  ],
};

function createMockReadinessDb(data: {
  products?: Record<string, ProductForReadiness>;
  dataSources?: DataSourceForReadiness[];
}): CatalogReadinessDb {
  const products = new Map<string, ProductForReadiness>(Object.entries(data.products || {}));
  const sources = data.dataSources || [];

  return {
    product: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        const prod = products.get(id);
        if (!prod) return null;
        return { ...prod };
      },
    },
    dataSource: {
      async findMany(args?: {
        where?: {
          status?: string;
          sourceType?: { in: string[] } | string;
        };
      }) {
        let list = [...sources];
        if (args?.where?.status) {
          list = list.filter((s) => s.status === args.where?.status);
        }
        if (args?.where?.sourceType) {
          const st = args.where.sourceType;
          if (typeof st === 'object' && st !== null && 'in' in st) {
            list = list.filter((s) => st.in.includes(s.sourceType));
          } else if (typeof st === 'string') {
            list = list.filter((s) => s.sourceType === st);
          }
        }
        return list;
      },
    },
  };
}

describe('Catalog Readiness Evaluation', () => {
  it('marks valid Laptop as publishable when all requirements are satisfied', async () => {
    const validLaptop: ProductForReadiness = {
      id: 'prod_rog_g16',
      name: 'ASUS ROG Strix G16 (2026)',
      slug: 'asus-rog-strix-g16-2026',
      kind: 'LAPTOP',
      isLegacy: false,
      brandId: 'brand_asus',
      categoryId: 'cat_laptop_gaming',
      catalogVersion: 1,
      weight: 2500,
      length: 354,
      width: 264,
      height: 30,
      specs: {
        schemaVersion: 1,
        values: {
          cpu_model: { state: 'KNOWN', value: 'Intel Core i9-14900HX' },
          ram_capacity: { state: 'KNOWN', value: 32, unit: 'GB' },
        },
      },
      warrantyConfig: {
        periodMonths: 24,
        type: 'OFFICIAL_MANUFACTURER',
      },
      brand: {
        id: 'brand_asus',
        name: 'ASUS',
        slug: 'asus',
        isActive: true,
      },
      categoryRef: {
        id: 'cat_laptop_gaming',
        name: 'Laptop Gaming',
        slug: 'laptop-gaming',
        kind: 'LAPTOP',
        specSchemaVersion: 1,
        specSchema: SAMPLE_LAPTOP_SCHEMA,
        warrantyConfig: { periodMonths: 12 },
        isActive: true,
      },
      variants: [
        {
          id: 'var_1',
          productId: 'prod_rog_g16',
          sku: 'G16-I9-32-1TB',
          price: 49990000,
          stock: 10,
          isActive: true,
          optionValues: { storage_capacity: 1024 },
        },
      ],
    };

    const activeSource: DataSourceForReadiness = {
      id: 'ds_asus_official',
      name: 'ASUS ROG Tech Specs',
      sourceType: 'MANUFACTURER',
      status: 'ACTIVE',
      payload: {
        mapping: { productId: 'prod_rog_g16' },
      },
    };

    const db = createMockReadinessDb({
      products: { prod_rog_g16: validLaptop },
      dataSources: [activeSource],
    });

    const result = await evaluateCatalogReadiness('prod_rog_g16', db);
    assert.equal(result.publishable, true);
    assert.deepEqual(result.missing, []);
    assert.equal(result.details?.hasBrand, true);
    assert.equal(result.details?.hasCategory, true);
    assert.equal(result.details?.hasSpecs, true);
    assert.equal(result.details?.hasActiveSource, true);
    assert.equal(result.details?.hasPacking, true);
    assert.equal(result.details?.hasWarranty, true);
    assert.equal(result.details?.hasSellableVariant, true);
  });

  it('rejects product when brand is missing or inactive', async () => {
    const laptopWithoutBrand: ProductForReadiness = {
      id: 'prod_nobrand',
      kind: 'LAPTOP',
      isLegacy: false,
      brandId: null,
      brand: null,
      categoryId: 'cat_laptop',
      categoryRef: {
        id: 'cat_laptop',
        name: 'Laptop',
        slug: 'laptop',
        kind: 'LAPTOP',
        isActive: true,
        specSchema: SAMPLE_LAPTOP_SCHEMA,
        specSchemaVersion: 1,
      },
      specs: { schemaVersion: 1, values: {} },
      weight: 2000,
      length: 300,
      width: 200,
      height: 20,
      variants: [{ id: 'v1', price: 1000, stock: 1, isActive: true }],
    };

    const db = createMockReadinessDb({
      products: { prod_nobrand: laptopWithoutBrand },
    });

    const result = await evaluateCatalogReadiness('prod_nobrand', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('brand'));
  });

  it('rejects product when category is missing, inactive, or kind mismatches', async () => {
    const laptopBadCategory: ProductForReadiness = {
      id: 'prod_badcat',
      kind: 'LAPTOP',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_phone',
      categoryRef: {
        id: 'cat_phone',
        name: 'Phone',
        slug: 'phone',
        kind: 'PHONE', // Kind mismatch: Product is LAPTOP but Category is PHONE!
        isActive: true,
        specSchema: { schemaVersion: 1, definitions: [] },
        specSchemaVersion: 1,
      },
      specs: { schemaVersion: 1, values: {} },
      weight: 2000,
      length: 300,
      width: 200,
      height: 20,
      variants: [{ id: 'v1', price: 1000, stock: 1, isActive: true }],
    };

    const db = createMockReadinessDb({
      products: { prod_badcat: laptopBadCategory },
    });

    const result = await evaluateCatalogReadiness('prod_badcat', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('category'));
  });

  it('rejects product when specs do not satisfy required category specSchema', async () => {
    const laptopMissingRequiredSpec: ProductForReadiness = {
      id: 'prod_badspecs',
      kind: 'LAPTOP',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_laptop',
      categoryRef: {
        id: 'cat_laptop',
        name: 'Laptop',
        slug: 'laptop',
        kind: 'LAPTOP',
        isActive: true,
        specSchema: SAMPLE_LAPTOP_SCHEMA, // Requires cpu_model and ram_capacity
        specSchemaVersion: 1,
      },
      specs: {
        schemaVersion: 1,
        values: {
          // cpu_model is missing!
          ram_capacity: { state: 'KNOWN', value: 16, unit: 'GB' },
        },
      },
      weight: 2000,
      length: 300,
      width: 200,
      height: 20,
      variants: [{ id: 'v1', price: 1000, stock: 1, isActive: true }],
    };

    const db = createMockReadinessDb({
      products: { prod_badspecs: laptopMissingRequiredSpec },
    });

    const result = await evaluateCatalogReadiness('prod_badspecs', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('specs'));
  });

  it('rejects laptop/phone without an approved active catalog source', async () => {
    const phoneNoSource: ProductForReadiness = {
      id: 'prod_phone_1',
      kind: 'PHONE',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_phone',
      categoryRef: {
        id: 'cat_phone',
        name: 'Phone',
        slug: 'phone',
        kind: 'PHONE',
        isActive: true,
        specSchema: { schemaVersion: 1, definitions: [] },
        specSchemaVersion: 1,
        warrantyConfig: { periodMonths: 12 },
      },
      specs: { schemaVersion: 1, values: {} },
      weight: 200,
      length: 150,
      width: 75,
      height: 8,
      variants: [{ id: 'v1', price: 1000, stock: 1, isActive: true }],
    };

    const db = createMockReadinessDb({
      products: { prod_phone_1: phoneNoSource },
      dataSources: [], // No active data sources!
    });

    const result = await evaluateCatalogReadiness('prod_phone_1', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('active_catalog_source'));
  });

  it('rejects product missing packing dimensions or weight', async () => {
    const unmeasuredProduct: ProductForReadiness = {
      id: 'prod_unmeasured',
      kind: 'PHONE',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_phone',
      categoryRef: {
        id: 'cat_phone',
        name: 'Phone',
        slug: 'phone',
        kind: 'PHONE',
        isActive: true,
        specSchema: { schemaVersion: 1, definitions: [] },
        specSchemaVersion: 1,
        warrantyConfig: { periodMonths: 12 },
      },
      specs: { schemaVersion: 1, values: {} },
      // Missing physical dimensions!
      weight: 0,
      length: 0,
      width: 0,
      height: 0,
      variants: [{ id: 'v1', price: 1000, stock: 1, isActive: true }],
    };

    const db = createMockReadinessDb({
      products: { prod_unmeasured: unmeasuredProduct },
      dataSources: [
        {
          id: 'ds_1',
          sourceType: 'CATALOG',
          status: 'ACTIVE',
          payload: { mapping: { productId: 'prod_unmeasured' } },
        },
      ],
    });

    const result = await evaluateCatalogReadiness('prod_unmeasured', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('packing_dimensions'));
  });

  it('rejects product missing warranty configuration', async () => {
    const productWithoutWarranty: ProductForReadiness = {
      id: 'prod_nowarranty',
      kind: 'PHONE',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_phone',
      categoryRef: {
        id: 'cat_phone',
        name: 'Phone',
        slug: 'phone',
        kind: 'PHONE',
        isActive: true,
        specSchema: { schemaVersion: 1, definitions: [] },
        specSchemaVersion: 1,
        warrantyConfig: null, // No category warranty!
      },
      warrantyConfig: null, // No product warranty!
      specs: { schemaVersion: 1, values: {} },
      weight: 200,
      length: 150,
      width: 75,
      height: 8,
      variants: [
        {
          id: 'v1',
          price: 1000,
          stock: 1,
          isActive: true,
          warrantyConfig: null, // No variant warranty!
        },
      ],
    };

    const db = createMockReadinessDb({
      products: { prod_nowarranty: productWithoutWarranty },
      dataSources: [
        {
          id: 'ds_1',
          sourceType: 'CATALOG',
          status: 'ACTIVE',
          payload: { mapping: { productId: 'prod_nowarranty' } },
        },
      ],
    });

    const result = await evaluateCatalogReadiness('prod_nowarranty', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('warranty_config'));
  });

  it('rejects product with zero active sellable variants', async () => {
    const productNoVariant: ProductForReadiness = {
      id: 'prod_novariants',
      kind: 'ACCESSORY',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_acc',
      categoryRef: {
        id: 'cat_acc',
        name: 'Accessory',
        slug: 'accessory',
        kind: 'ACCESSORY',
        isActive: true,
        specSchema: { schemaVersion: 1, definitions: [] },
        specSchemaVersion: 1,
        warrantyConfig: { periodMonths: 6 },
      },
      specs: { schemaVersion: 1, values: {} },
      weight: 100,
      length: 100,
      width: 50,
      height: 20,
      variants: [
        { id: 'v1', price: 0, stock: 0, isActive: false }, // Inactive variant!
      ],
    };

    const db = createMockReadinessDb({
      products: { prod_novariants: productNoVariant },
    });

    const result = await evaluateCatalogReadiness('prod_novariants', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('sellable_variant'));
  });

  it('allows accessory to publish without active catalog source but emits warning', async () => {
    const accessory: ProductForReadiness = {
      id: 'prod_acc_1',
      kind: 'ACCESSORY',
      isLegacy: false,
      brandId: 'b1',
      brand: { id: 'b1', name: 'B1', slug: 'b1', isActive: true },
      categoryId: 'cat_acc',
      categoryRef: {
        id: 'cat_acc',
        name: 'Accessory',
        slug: 'accessory',
        kind: 'ACCESSORY',
        isActive: true,
        specSchema: { schemaVersion: 1, definitions: [] },
        specSchemaVersion: 1,
        warrantyConfig: { periodMonths: 12 },
      },
      specs: { schemaVersion: 1, values: {} },
      weight: 150,
      length: 100,
      width: 50,
      height: 30,
      variants: [{ id: 'v1', price: 350000, stock: 20, isActive: true }],
    };

    const db = createMockReadinessDb({
      products: { prod_acc_1: accessory },
      dataSources: [], // No active source
    });

    const result = await evaluateCatalogReadiness('prod_acc_1', db);
    assert.equal(result.publishable, true);
    assert.deepEqual(result.missing, []);
    assert.ok(result.warnings.some((w) => w.includes('catalog_source')));
  });

  it('marks legacy product as readable but not publishable without catalog normalization', async () => {
    const legacyProduct: ProductForReadiness = {
      id: 'prod_legacy_shirt',
      name: 'Áo thun Vintage',
      kind: 'LEGACY',
      isLegacy: true,
      categoryId: 'cat_legacy_root',
      price: 250000,
      stock: 50,
      isActive: true,
      variants: [],
    };

    const db = createMockReadinessDb({
      products: { prod_legacy_shirt: legacyProduct },
    });

    const result = await evaluateCatalogReadiness('prod_legacy_shirt', db);
    assert.equal(result.publishable, false);
    assert.ok(result.missing.includes('legacy_normalization_required'));
    assert.ok(result.warnings.includes('legacy_catalog_item'));
    assert.equal(result.details?.isLegacy, true);
  });
});
