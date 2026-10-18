import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertElectronicsProduct,
  adaptLegacyColorSizeToOptionValues,
  type UpsertElectronicsProductInput,
  type CatalogWriteDb,
} from '../src/server/modules/catalog/catalog-write.service.ts';
import type { CategorySpecSchema } from '../src/shared/types/catalog.ts';
import type { GuardUser } from '../src/server/modules/admin/guards.ts';

const LAPTOP_SCHEMA: CategorySpecSchema = {
  schemaVersion: 1,
  definitions: [
    { code: 'cpu', label: 'CPU', valueType: 'TEXT', required: true },
    { code: 'ram', label: 'RAM', valueType: 'INTEGER', unit: 'GB', required: true, isOption: true },
    { code: 'storage', label: 'Storage', valueType: 'INTEGER', unit: 'GB', required: true, isOption: true },
    { code: 'color', label: 'Màu sắc', valueType: 'TEXT', isOption: true },
  ],
  variantOptions: [],
};

interface MockProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image: string | null;
  brandId: string | null;
  categoryId: string;
  kind: string;
  segment: string | null;
  isLegacy: boolean;
  specs: unknown;
  images: unknown;
  warrantyConfig: unknown;
  weight: number;
  length: number;
  width: number;
  height: number;
  stock: number;
  isActive: boolean;
  inventoryMode: string;
  catalogVersion: number;
}

interface MockVariant {
  id: string;
  productId: string;
  sku: string;
  title: string;
  price: number;
  stock: number;
  isActive: boolean;
  color: string | null;
  size: string | null;
  optionValues: unknown;
  optionHash: string | null;
  specOverrides: unknown;
  images: unknown;
  warrantyConfig: unknown;
  serializationRequired: boolean;
}

interface MockDataSource {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  publisher: string;
  url: string | null;
  license: string | null;
  market: string | null;
  version: string | null;
  checksum: string | null;
  isSynthetic: boolean;
  reviewerId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  payload: unknown;
}

function createMockWriteDb(initialData?: {
  brands?: Array<{ id: string; name: string; slug: string; isActive: boolean }>;
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
    kind: string;
    isActive: boolean;
    specSchema: CategorySpecSchema;
    specSchemaVersion: number;
    warrantyConfig?: unknown;
  }>;
  products?: MockProduct[];
  variants?: MockVariant[];
  dataSources?: MockDataSource[];
}): CatalogWriteDb {
  const brands = new Map(initialData?.brands?.map((b) => [b.id, { ...b }]));
  const categories = new Map(initialData?.categories?.map((c) => [c.id, { ...c }]));
  const products = new Map(initialData?.products?.map((p) => [p.id, { ...p }]));
  const variants = new Map(initialData?.variants?.map((v) => [v.id, { ...v }]));
  const sources = new Map(initialData?.dataSources?.map((s) => [s.id, { ...s }]));

  const db: CatalogWriteDb = {
    async $transaction<T>(fn: (tx: CatalogWriteDb) => Promise<T>): Promise<T> {
      // Snapshot for atomic rollback
      const snapshotProducts = new Map(Array.from(products.entries()).map(([k, v]) => [k, { ...v }]));
      const snapshotVariants = new Map(Array.from(variants.entries()).map(([k, v]) => [k, { ...v }]));
      const snapshotSources = new Map(Array.from(sources.entries()).map(([k, v]) => [k, { ...v }]));
      try {
        return await fn(db);
      } catch (error) {
        products.clear();
        for (const [k, v] of snapshotProducts) products.set(k, v);
        variants.clear();
        for (const [k, v] of snapshotVariants) variants.set(k, v);
        sources.clear();
        for (const [k, v] of snapshotSources) sources.set(k, v);
        throw error;
      }
    },
    product: {
      async findUnique(args: { where: { id?: string; slug?: string } }) {
        let p: MockProduct | null = null;
        if (args.where.id) p = products.get(args.where.id) ?? null;
        if (args.where.slug) {
          p = Array.from(products.values()).find((item) => item.slug === args.where.slug) ?? null;
        }
        if (!p) return null;

        const b = p.brandId ? brands.get(p.brandId) ?? null : null;
        const cat = p.categoryId ? categories.get(p.categoryId) ?? null : null;
        const vList = Array.from(variants.values()).filter((v) => v.productId === p!.id);

        return {
          ...p,
          brand: b,
          categoryRef: cat,
          variants: vList,
        };
      },
      async findFirst(args?: { where: Record<string, unknown> }) {
        if (!args?.where) return Array.from(products.values())[0] ?? null;
        return (
          Array.from(products.values()).find((p) => {
            if (args.where.slug && p.slug !== args.where.slug) return false;
            return true;
          }) ?? null
        );
      },
      async create(args: { data: Record<string, unknown> }) {
        const id = (args.data.id as string) || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record: MockProduct = {
          id,
          name: args.data.name as string,
          slug: (args.data.slug as string) || `slug-${id}`,
          description: (args.data.description as string) ?? null,
          price: Number(args.data.price) || 0,
          image: (args.data.image as string) ?? null,
          brandId: (args.data.brandId as string) ?? null,
          categoryId: args.data.categoryId as string,
          kind: (args.data.kind as string) || 'LAPTOP',
          segment: (args.data.segment as string) ?? null,
          isLegacy: Boolean(args.data.isLegacy),
          specs: args.data.specs ?? null,
          images: args.data.images ?? null,
          warrantyConfig: args.data.warrantyConfig ?? null,
          weight: Number(args.data.weight) || 0,
          length: Number(args.data.length) || 0,
          width: Number(args.data.width) || 0,
          height: Number(args.data.height) || 0,
          stock: Number(args.data.stock) || 0,
          isActive: Boolean(args.data.isActive),
          inventoryMode: (args.data.inventoryMode as string) || 'BASE',
          catalogVersion: Number(args.data.catalogVersion) || 1,
        };
        products.set(id, record);
        return record;
      },
      async update(args: { where: { id: string }; data: Record<string, unknown> }) {
        const existing = products.get(args.where.id);
        if (!existing) throw new Error(`Product not found: ${args.where.id}`);
        const updated: MockProduct = {
          ...existing,
          ...args.data,
          catalogVersion:
            typeof args.data.catalogVersion === 'object' && args.data.catalogVersion !== null && 'increment' in args.data.catalogVersion
              ? existing.catalogVersion + 1
              : typeof args.data.catalogVersion === 'number'
                ? args.data.catalogVersion
                : existing.catalogVersion + 1,
        } as MockProduct;
        products.set(args.where.id, updated);
        return updated;
      },
    },
    productVariant: {
      async findUnique(args: { where: { id?: string; productId_optionHash?: { productId: string; optionHash: string } } }) {
        if (args.where.id) return variants.get(args.where.id) ?? null;
        if (args.where.productId_optionHash) {
          const { productId, optionHash } = args.where.productId_optionHash;
          return (
            Array.from(variants.values()).find(
              (v) => v.productId === productId && v.optionHash === optionHash
            ) ?? null
          );
        }
        return null;
      },
      async findFirst(args?: { where: Record<string, unknown> }) {
        if (!args?.where) return Array.from(variants.values())[0] ?? null;
        return (
          Array.from(variants.values()).find((v) => {
            if (args.where.sku && v.sku.toLowerCase() === String(args.where.sku).toLowerCase()) {
              if (args.where.id && typeof args.where.id === 'object' && args.where.id !== null && 'not' in args.where.id) {
                const notObj = args.where.id as { not: string };
                if (v.id === notObj.not) return false;
              }
              return true;
            }
            return false;
          }) ?? null
        );
      },
      async findMany(args?: { where: Record<string, unknown> }) {
        let list = Array.from(variants.values());
        if (args?.where?.productId) {
          list = list.filter((v) => v.productId === args.where.productId);
        }
        return list;
      },
      async create(args: { data: Record<string, unknown> }) {
        const id = (args.data.id as string) || `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record: MockVariant = {
          id,
          productId: args.data.productId as string,
          sku: args.data.sku as string,
          title: args.data.title as string,
          price: Number(args.data.price) || 0,
          stock: Number(args.data.stock) || 0,
          isActive: args.data.isActive !== false,
          color: (args.data.color as string) ?? null,
          size: (args.data.size as string) ?? null,
          optionValues: args.data.optionValues ?? null,
          optionHash: (args.data.optionHash as string) ?? null,
          specOverrides: args.data.specOverrides ?? null,
          images: args.data.images ?? null,
          warrantyConfig: args.data.warrantyConfig ?? null,
          serializationRequired: Boolean(args.data.serializationRequired),
        };
        variants.set(id, record);
        return record;
      },
      async update(args: { where: { id: string }; data: Record<string, unknown> }) {
        const existing = variants.get(args.where.id);
        if (!existing) throw new Error(`Variant not found: ${args.where.id}`);
        const updated: MockVariant = { ...existing, ...args.data } as MockVariant;
        variants.set(args.where.id, updated);
        return updated;
      },
      async delete(args: { where: { id: string } }) {
        const existing = variants.get(args.where.id);
        variants.delete(args.where.id);
        return existing;
      },
    },
    brand: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return brands.get(id) ?? null;
      },
    },
    category: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return categories.get(id) ?? null;
      },
    },
    dataSource: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return sources.get(id) ?? null;
      },
      async findMany(args?: { where?: Record<string, unknown> }) {
        let list = Array.from(sources.values());
        if (args?.where?.status) {
          list = list.filter((s) => s.status === args.where!.status);
        }
        return list;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const id = (data.id as string) || `ds_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record: MockDataSource = {
          id,
          name: (data.name as string) || '',
          sourceType: (data.sourceType as string) || 'CATALOG',
          status: (data.status as string) || 'DISCOVERED',
          publisher: (data.publisher as string) || '',
          url: (data.url as string) ?? null,
          license: (data.license as string) ?? null,
          market: (data.market as string) ?? null,
          version: (data.version as string) ?? null,
          checksum: (data.checksum as string) ?? null,
          isSynthetic: Boolean(data.isSynthetic),
          reviewerId: (data.reviewerId as string) ?? null,
          reviewedAt: (data.reviewedAt as Date) ?? null,
          rejectionReason: (data.rejectionReason as string) ?? null,
          payload: data.payload ?? null,
        };
        sources.set(id, record);
        return record;
      },
      async update({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const existing = sources.get(id);
        if (!existing) throw new Error(`DataSource not found: ${id}`);
        const updated: MockDataSource = { ...existing, ...data } as MockDataSource;
        sources.set(id, updated);
        return updated;
      },
    },
  };

  return db;
}

const ADMIN_ACTOR: GuardUser = {
  id: 'admin_1',
  role: 'ADMIN',
  name: 'Admin Boss',
  permissions: ['orders', 'products', 'shipments', 'chat', 'reviews', 'knowledge'],
};

const STAFF_ACTOR: GuardUser = {
  id: 'staff_1',
  role: 'STAFF',
  name: 'Staff Member',
  permissions: ['products', 'knowledge'],
};

const UNAUTHORIZED_ACTOR: GuardUser = {
  id: 'cust_1',
  role: 'CUSTOMER',
  name: 'Customer',
  permissions: [],
};

describe('Transactional Electronics Catalog Writes (M1 Task 5)', () => {
  const defaultCategory = {
    id: 'cat_laptop_1',
    name: 'Laptop Gaming',
    slug: 'laptop-gaming',
    kind: 'LAPTOP',
    isActive: true,
    specSchema: LAPTOP_SCHEMA,
    specSchemaVersion: 1,
    warrantyConfig: { periodMonths: 12 },
  };

  const defaultBrand = {
    id: 'brand_asus',
    name: 'ASUS',
    slug: 'asus',
    isActive: true,
  };

  const activeSource: MockDataSource = {
    id: 'ds_asus_active',
    name: 'ASUS Official Specs',
    sourceType: 'MANUFACTURER',
    status: 'ACTIVE',
    publisher: 'ASUS Inc.',
    license: 'Commercial specsheet license',
    checksum: 'sha256-asus-valid',
    url: 'https://asus.com/specs',
    market: 'VN',
    version: '2026.1',
    isSynthetic: false,
    reviewerId: 'admin_1',
    reviewedAt: new Date(),
    rejectionReason: null,
    payload: { mapping: { productId: 'prod_rog_g16' } },
  };

  it('rejects unauthorized actor without products permission', async () => {
    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
    });

    const input: UpsertElectronicsProductInput = {
      product: {
        name: 'ASUS ROG G16',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 350,
        width: 250,
        height: 25,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel i9-14900HX' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/img1.png', alt: 'Laptop', sortOrder: 1 }],
      variants: [
        {
          sku: 'ROG-G16-01',
          title: 'ROG G16 32GB 1TB',
          price: 45000000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
      ],
      sources: [],
    };

    await assert.rejects(
      async () => {
        await upsertElectronicsProduct(input, UNAUTHORIZED_ACTOR, db);
      },
      (err: Error) => {
        assert.match(err.message, /unauthorized|permission/i);
        return true;
      }
    );
  });

  it('rolls back completely when specs JSON violates category schema', async () => {
    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
    });

    const invalidInput: UpsertElectronicsProductInput = {
      product: {
        name: 'ASUS ROG G16',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 350,
        width: 250,
        height: 25,
      },
      specs: {
        schemaVersion: 1,
        values: {
          // Missing required 'cpu'!
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/img1.png', alt: 'Laptop', sortOrder: 1 }],
      variants: [
        {
          sku: 'ROG-G16-01',
          title: 'ROG G16 32GB 1TB',
          price: 45000000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
      ],
      sources: [],
    };

    await assert.rejects(
      async () => {
        await upsertElectronicsProduct(invalidInput, ADMIN_ACTOR, db);
      },
      (err: Error) => {
        assert.match(err.message, /missing required specification: "cpu"/i);
        return true;
      }
    );

    // Verify atomic rollback: no product or variants were written
    const products = await db.product.findMany?.() ?? [];
    assert.equal(products.length, 0, 'No products should exist after rollback');
  });

  it('rolls back completely when variants contain duplicate optionHash', async () => {
    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
    });

    const duplicateOptionsInput: UpsertElectronicsProductInput = {
      product: {
        name: 'ASUS ROG G16',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 350,
        width: 250,
        height: 25,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel i9' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/img1.png', alt: 'Laptop', sortOrder: 1 }],
      variants: [
        {
          sku: 'ROG-G16-01',
          title: 'ROG G16 32GB 1TB Black',
          price: 45000000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
        {
          sku: 'ROG-G16-02',
          title: 'ROG G16 32GB 1TB Black Duplicate',
          price: 46000000,
          stock: 5,
          // Exact same option combination!
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
      ],
      sources: [],
    };

    await assert.rejects(
      async () => {
        await upsertElectronicsProduct(duplicateOptionsInput, ADMIN_ACTOR, db);
      },
      (err: Error) => {
        assert.match(err.message, /duplicate optionHash/i);
        return true;
      }
    );

    const variants = await db.productVariant.findMany();
    assert.equal(variants.length, 0, 'Variants must be empty after rollback');
  });

  it('rolls back completely when variants contain duplicate SKU', async () => {
    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
    });

    const duplicateSkuInput: UpsertElectronicsProductInput = {
      product: {
        name: 'ASUS ROG G16',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 350,
        width: 250,
        height: 25,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel i9' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/img1.png', alt: 'Laptop', sortOrder: 1 }],
      variants: [
        {
          sku: 'ROG-G16-SAME-SKU',
          title: 'ROG G16 32GB 1TB',
          price: 45000000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
        {
          sku: 'rog-g16-same-sku', // Case-insensitive duplicate SKU!
          title: 'ROG G16 64GB 2TB',
          price: 55000000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 64, unit: 'GB' },
            { code: 'storage', value: 2048, unit: 'GB' },
          ],
        },
      ],
      sources: [],
    };

    await assert.rejects(
      async () => {
        await upsertElectronicsProduct(duplicateSkuInput, ADMIN_ACTOR, db);
      },
      (err: Error) => {
        assert.match(err.message, /duplicate SKU/i);
        return true;
      }
    );
  });

  it('rolls back on optimistic locking conflict when expectedVersion is stale', async () => {
    const existingProduct: MockProduct = {
      id: 'prod_existing',
      name: 'ASUS ROG G16',
      slug: 'asus-rog-g16',
      description: null,
      price: 45000000,
      image: null,
      brandId: 'brand_asus',
      categoryId: 'cat_laptop_1',
      kind: 'LAPTOP',
      segment: 'FLAGSHIP',
      isLegacy: false,
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel i9' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [],
      warrantyConfig: null,
      weight: 2500,
      length: 350,
      width: 250,
      height: 25,
      stock: 5,
      isActive: true,
      inventoryMode: 'VARIANT',
      catalogVersion: 3, // Current version is 3
    };

    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
      products: [existingProduct],
    });

    const staleInput: UpsertElectronicsProductInput = {
      product: {
        id: 'prod_existing',
        name: 'ASUS ROG G16 Updated',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 350,
        width: 250,
        height: 25,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel i9-14900HX' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/g16.png', alt: 'G16', sortOrder: 0 }],
      variants: [
        {
          sku: 'ROG-G16-01',
          title: 'ROG G16 32GB 1TB',
          price: 46000000,
          stock: 10,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
      ],
      sources: [],
      expectedVersion: 2, // Stale! Expected 3
    };

    await assert.rejects(
      async () => {
        await upsertElectronicsProduct(staleInput, ADMIN_ACTOR, db);
      },
      (err: Error) => {
        assert.match(err.message, /catalog version conflict|expected 2, but found 3/i);
        return true;
      }
    );

    // Verify existing product was NOT modified
    const current = await db.product.findUnique({ where: { id: 'prod_existing' } });
    assert.equal(current?.catalogVersion, 3);
    assert.equal(current?.name, 'ASUS ROG G16');
  });

  it('rejects source activation when actor is STAFF (requires ADMIN)', async () => {
    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
    });

    const staffInput: UpsertElectronicsProductInput = {
      product: {
        name: 'ASUS ROG G16',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 350,
        width: 250,
        height: 25,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel i9' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/img1.png', alt: 'Laptop', sortOrder: 1 }],
      variants: [
        {
          sku: 'ROG-G16-01',
          title: 'ROG G16',
          price: 45000000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
      ],
      sources: [
        {
          name: 'ASUS Specs',
          sourceType: 'MANUFACTURER',
          publisher: 'ASUS Inc.',
          license: 'Specs license',
          checksum: 'sha256-abc',
          status: 'ACTIVE', // Staff attempting direct ACTIVE activation!
        },
      ],
    };

    await assert.rejects(
      async () => {
        await upsertElectronicsProduct(staffInput, STAFF_ACTOR, db);
      },
      (err: Error) => {
        assert.match(err.message, /only admin can activate data source/i);
        return true;
      }
    );
  });

  it('creates product, variants, and source atomically for valid input', async () => {
    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
      dataSources: [activeSource],
    });

    const validInput: UpsertElectronicsProductInput = {
      product: {
        id: 'prod_rog_g16',
        name: 'ASUS ROG Strix G16 (2026)',
        slug: 'asus-rog-strix-g16-2026',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        kind: 'LAPTOP',
        segment: 'FLAGSHIP',
        isActive: true,
        weight: 2500,
        length: 354,
        width: 264,
        height: 30,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel Core i9-14900HX' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [
        { url: 'https://example.com/g16-front.jpg', alt: 'Front view', sortOrder: 0 },
        { url: 'https://example.com/g16-back.jpg', alt: 'Back view', sortOrder: 1 },
      ],
      warrantyConfig: { periodMonths: 24, type: 'OFFICIAL_MANUFACTURER' },
      variants: [
        {
          sku: 'G16-I9-32-1TB',
          title: 'G16 i9 / 32GB / 1TB',
          price: 49990000,
          stock: 10,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
        {
          sku: 'G16-I9-64-2TB',
          title: 'G16 i9 / 64GB / 2TB',
          price: 59990000,
          stock: 5,
          optionValues: [
            { code: 'ram', value: 64, unit: 'GB' },
            { code: 'storage', value: 2048, unit: 'GB' },
          ],
        },
      ],
      sources: [
        {
          name: 'ASUS Strix G16 Official Documentation',
          sourceType: 'MANUFACTURER',
          publisher: 'ASUS Inc.',
          url: 'https://rog.asus.com',
          license: 'Commercial OEM documentation',
          checksum: 'sha256-g16-docs',
          status: 'ACTIVE',
        },
      ],
    };

    const result = await upsertElectronicsProduct(validInput, ADMIN_ACTOR, db);

    assert.equal(result.id, 'prod_rog_g16');
    assert.equal(result.name, 'ASUS ROG Strix G16 (2026)');
    assert.equal(result.catalogVersion, 1);
    assert.equal(result.variants.length, 2);
    // Effective price should be the minimum sellable variant price: 49,990,000 VND
    assert.equal(result.effectivePrice, 49990000);

    // Verify stored product
    const storedProd = await db.product.findUnique({ where: { id: 'prod_rog_g16' } });
    assert.ok(storedProd);
    assert.equal(storedProd.stock, 15); // Sum of 10 + 5 variant stocks!
    assert.equal(storedProd.inventoryMode, 'VARIANT');
  });

  it('updates product and bumps catalogVersion with valid CAS', async () => {
    const existingProduct: MockProduct = {
      id: 'prod_rog_g16',
      name: 'ASUS ROG Strix G16',
      slug: 'asus-rog-strix-g16',
      description: null,
      price: 49990000,
      image: null,
      brandId: 'brand_asus',
      categoryId: 'cat_laptop_1',
      kind: 'LAPTOP',
      segment: 'FLAGSHIP',
      isLegacy: false,
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel Core i9-14900HX' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [],
      warrantyConfig: null,
      weight: 2500,
      length: 354,
      width: 264,
      height: 30,
      stock: 10,
      isActive: true,
      inventoryMode: 'VARIANT',
      catalogVersion: 1,
    };

    const db = createMockWriteDb({
      brands: [defaultBrand],
      categories: [defaultCategory],
      products: [existingProduct],
      dataSources: [activeSource],
    });

    const updateInput: UpsertElectronicsProductInput = {
      product: {
        id: 'prod_rog_g16',
        name: 'ASUS ROG Strix G16 Refresh',
        categoryId: 'cat_laptop_1',
        brandId: 'brand_asus',
        weight: 2500,
        length: 354,
        width: 264,
        height: 30,
        isActive: true,
      },
      specs: {
        schemaVersion: 1,
        values: {
          cpu: { state: 'KNOWN', value: 'Intel Core i9-14900HX' },
          ram: { state: 'KNOWN', value: 32, unit: 'GB' },
          storage: { state: 'KNOWN', value: 1024, unit: 'GB' },
        },
      },
      images: [{ url: 'https://example.com/front.jpg', alt: 'Front', sortOrder: 0 }],
      variants: [
        {
          sku: 'G16-I9-32-1TB',
          title: 'G16 i9 / 32GB / 1TB',
          price: 48990000,
          stock: 12,
          optionValues: [
            { code: 'ram', value: 32, unit: 'GB' },
            { code: 'storage', value: 1024, unit: 'GB' },
          ],
        },
      ],
      sources: [],
      expectedVersion: 1,
    };

    const result = await upsertElectronicsProduct(updateInput, ADMIN_ACTOR, db);

    assert.equal(result.name, 'ASUS ROG Strix G16 Refresh');
    assert.equal(result.catalogVersion, 2);
    assert.equal(result.effectivePrice, 48990000);
  });

  it('adapts legacy color and size inputs to canonical option values', () => {
    const legacyVariant = {
      sku: 'LEGACY-01',
      title: 'T-Shirt Red M',
      price: 250000,
      color: 'Đỏ',
      size: 'M',
    };

    const adapted = adaptLegacyColorSizeToOptionValues(legacyVariant);
    assert.ok(adapted);
    assert.equal(adapted.color, 'Đỏ');
    assert.equal(adapted.size, 'M');
    assert.ok(Array.isArray(adapted.optionValues));
    assert.ok(adapted.optionValues.some((o: { code: string; value: string }) => o.code === 'color' && o.value === 'Đỏ'));
    assert.ok(adapted.optionValues.some((o: { code: string; value: string }) => o.code === 'size' && o.value === 'M'));
    assert.ok(adapted.optionHash);
  });
});
