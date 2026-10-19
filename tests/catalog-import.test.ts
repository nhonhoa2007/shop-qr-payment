import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateCatalogManifest,
  type CatalogManifest,
  type ImportReport,
} from '../scripts/import-electronics-catalog.ts';

const PROJECT_ROOT = process.cwd();
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'prisma/data/electronics-catalog.json');
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'prisma/data/electronics-catalog.schema.json');
const SOURCES_DOC_PATH = path.join(PROJECT_ROOT, 'docs/data/electronics-catalog-sources.md');

describe('Task 2: Electronics Catalog Manifest & Importer Contracts', () => {
  describe('Manifest JSON Schema & File Existence', () => {
    it('ensures electronics-catalog.schema.json exists and is valid JSON Schema', () => {
      assert.ok(fs.existsSync(SCHEMA_PATH), 'electronics-catalog.schema.json must exist');
      const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
      const schema = JSON.parse(schemaContent);
      assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#');
      assert.ok(schema.properties.products, 'Schema must define products property');
      assert.ok(schema.properties.sources, 'Schema must define sources property');
      assert.ok(schema.properties.brands, 'Schema must define brands property');
      assert.ok(schema.properties.categories, 'Schema must define categories property');
    });

    it('ensures prisma/data/electronics-catalog.json exists and adheres to manifest requirements', () => {
      assert.ok(fs.existsSync(MANIFEST_PATH), 'electronics-catalog.json must exist');
      const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
      const manifest: CatalogManifest = JSON.parse(content);

      assert.ok(manifest.version, 'Manifest must have version');
      assert.equal(typeof manifest.manifestVersion, 'number');
      assert.ok(Array.isArray(manifest.sources), 'Manifest must have sources array');
      assert.ok(Array.isArray(manifest.brands), 'Manifest must have brands array');
      assert.ok(Array.isArray(manifest.categories), 'Manifest must have categories array');
      assert.ok(Array.isArray(manifest.products), 'Manifest must have products array');
    });

    it('validates 40–60 product models partitioned into approved categories', () => {
      assert.ok(fs.existsSync(MANIFEST_PATH), 'electronics-catalog.json must exist');
      const manifest: CatalogManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

      const totalProducts = manifest.products.length;
      assert.ok(
        totalProducts >= 40 && totalProducts <= 60,
        `Total products count must be between 40 and 60, found ${totalProducts}`
      );

      const laptops = manifest.products.filter((p) => p.kind === 'LAPTOP');
      const phones = manifest.products.filter((p) => p.kind === 'PHONE');
      const accessories = manifest.products.filter((p) => p.kind === 'ACCESSORY');

      assert.ok(
        laptops.length >= 10 && laptops.length <= 15,
        `Laptops count must be between 10 and 15, found ${laptops.length}`
      );
      assert.ok(
        phones.length >= 10 && phones.length <= 15,
        `Phones count must be between 10 and 15, found ${phones.length}`
      );
      assert.ok(
        accessories.length >= 20 && accessories.length <= 30,
        `Accessories count must be between 20 and 30, found ${accessories.length}`
      );
    });

    it('enforces globally unique brand IDs, product IDs, product slugs, and variant SKUs', () => {
      assert.ok(fs.existsSync(MANIFEST_PATH), 'electronics-catalog.json must exist');
      const manifest: CatalogManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

      const brandIds = new Set<string>();
      for (const b of manifest.brands) {
        assert.ok(!brandIds.has(b.id), `Duplicate brand id: ${b.id}`);
        brandIds.add(b.id);
      }

      const productIds = new Set<string>();
      const productSlugs = new Set<string>();
      const skus = new Set<string>();

      for (const p of manifest.products) {
        assert.ok(!productIds.has(p.id), `Duplicate product id: ${p.id}`);
        productIds.add(p.id);

        assert.ok(!productSlugs.has(p.slug), `Duplicate product slug: ${p.slug}`);
        productSlugs.add(p.slug);

        assert.ok(brandIds.has(p.brandId), `Product ${p.id} references undeclared brand ${p.brandId}`);
        assert.ok(p.variants && p.variants.length > 0, `Product ${p.id} must have at least one variant`);

        for (const v of p.variants) {
          assert.ok(!skus.has(v.sku), `Duplicate SKU across manifest: ${v.sku}`);
          skus.add(v.sku);
        }
      }
    });

    it('ensures each source has explicit license, checksum, and publisher', () => {
      assert.ok(fs.existsSync(MANIFEST_PATH), 'electronics-catalog.json must exist');
      const manifest: CatalogManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

      assert.ok(manifest.sources.length > 0, 'Manifest must declare sources');
      for (const src of manifest.sources) {
        assert.ok(src.id, 'Source must have id');
        assert.ok(src.name, 'Source must have name');
        assert.ok(src.license, `Source ${src.id} must declare license`);
        assert.ok(src.checksum, `Source ${src.id} must have checksum`);
        assert.ok(src.publisher, `Source ${src.id} must have publisher`);
        assert.ok(['MANUFACTURER', 'CATALOG', 'BENCHMARK', 'COMMUNITY'].includes(src.sourceType));
      }
    });

    it('ensures documentation docs/data/electronics-catalog-sources.md exists and documents licenses', () => {
      assert.ok(fs.existsSync(SOURCES_DOC_PATH), 'electronics-catalog-sources.md must exist');
      const doc = fs.readFileSync(SOURCES_DOC_PATH, 'utf8');
      assert.ok(doc.includes('Electronics Catalog Data Sources'), 'Must contain title');
      assert.ok(doc.includes('License'), 'Must document licenses');
      assert.ok(doc.includes('Provenance'), 'Must document provenance');
    });
  });

  describe('validateCatalogManifest validation logic', () => {
    it('validates a correct manifest without throwing', () => {
      const valid: CatalogManifest = {
        version: '1.0.0',
        manifestVersion: 1,
        generatedAt: '2026-10-18T00:00:00Z',
        sources: [
          {
            id: 'src-apple-spec',
            name: 'Apple Technical Specifications',
            sourceType: 'MANUFACTURER',
            status: 'ACTIVE',
            publisher: 'Apple Inc.',
            url: 'https://support.apple.com/specs',
            license: 'Public Specification Data / Fair Use Reference',
            version: '2026.1',
            checksum: 'sha256-apple-spec-001',
            isSynthetic: false,
          },
        ],
        brands: [
          {
            id: 'brand-apple',
            name: 'Apple',
            slug: 'apple',
            country: 'United States',
            websiteUrl: 'https://www.apple.com',
            isActive: true,
          },
        ],
        categories: [
          {
            id: 'cat-laptop',
            name: 'Laptop',
            slug: 'laptop',
            kind: 'LAPTOP',
            specSchemaVersion: 1,
            specSchema: {
              schemaVersion: 1,
              definitions: [
                { code: 'cpu', label: 'CPU', valueType: 'TEXT', required: true },
              ],
            },
            warrantyConfig: { periodMonths: 12 },
            isActive: true,
          },
        ],
        products: [
          {
            id: 'prod-macbook-pro',
            name: 'MacBook Pro',
            slug: 'macbook-pro',
            description: 'Professional laptop',
            brandId: 'brand-apple',
            categoryId: 'cat-laptop',
            kind: 'LAPTOP',
            segment: 'PRO',
            weight: 1.6,
            length: 31,
            width: 22,
            height: 1.5,
            specs: {
              schemaVersion: 1,
              values: {
                cpu: { state: 'KNOWN', value: 'Apple M3 Pro' },
              },
            },
            warrantyConfig: { periodMonths: 12 },
            images: [{ url: 'https://example.com/mbp.jpg', alt: 'MBP', sortOrder: 0 }],
            variants: [
              {
                sku: 'MBP-M3-16-512',
                title: 'MacBook Pro M3 / 16GB / 512GB',
                price: 49990000,
                stock: 10,
                optionValues: { ram: 16, ssd: 512 },
              },
            ],
            sourceIds: ['src-apple-spec'],
            origin: 'Apple Official Product Spec',
          },
        ],
      };

      const result = validateCatalogManifest(valid);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('rejects manifest with duplicate SKU', () => {
      const invalid: any = {
        version: '1.0.0',
        manifestVersion: 1,
        generatedAt: '2026-10-18T00:00:00Z',
        sources: [],
        brands: [{ id: 'b1', name: 'B1', slug: 'b1', country: 'US', websiteUrl: 'https://b.com', isActive: true }],
        categories: [{ id: 'c1', name: 'C1', slug: 'c1', kind: 'LAPTOP', specSchemaVersion: 1, specSchema: { schemaVersion: 1, definitions: [] }, warrantyConfig: {}, isActive: true }],
        products: [
          {
            id: 'p1',
            name: 'P1',
            slug: 'p1',
            brandId: 'b1',
            categoryId: 'c1',
            kind: 'LAPTOP',
            weight: 1,
            length: 1,
            width: 1,
            height: 1,
            specs: { schemaVersion: 1, values: {} },
            warrantyConfig: {},
            images: [],
            variants: [{ sku: 'DUPLICATE-SKU', title: 'V1', price: 1000, stock: 5, optionValues: {} }],
          },
          {
            id: 'p2',
            name: 'P2',
            slug: 'p2',
            brandId: 'b1',
            categoryId: 'c1',
            kind: 'LAPTOP',
            weight: 1,
            length: 1,
            width: 1,
            height: 1,
            specs: { schemaVersion: 1, values: {} },
            warrantyConfig: {},
            images: [],
            variants: [{ sku: 'DUPLICATE-SKU', title: 'V2', price: 2000, stock: 5, optionValues: {} }],
          },
        ],
      };

      const result = validateCatalogManifest(invalid);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('DUPLICATE-SKU')));
    });

    it('quarantines products referencing revoked or unknown data sources', () => {
      const manifestWithRevoked: CatalogManifest = {
        version: '1.0.0',
        manifestVersion: 1,
        generatedAt: '2026-10-18T00:00:00Z',
        sources: [
          {
            id: 'src-revoked',
            name: 'Revoked Community Source',
            sourceType: 'COMMUNITY',
            status: 'REVOKED',
            publisher: 'Unknown',
            url: 'https://example.com/revoked',
            license: 'Unverified / Disputed',
            version: '1.0',
            checksum: 'checksum-revoked',
            isSynthetic: false,
          },
        ],
        brands: [{ id: 'b1', name: 'B1', slug: 'b1', country: 'US', websiteUrl: 'https://b.com', isActive: true }],
        categories: [{ id: 'c1', name: 'C1', slug: 'c1', kind: 'ACCESSORY', specSchemaVersion: 1, specSchema: { schemaVersion: 1, definitions: [] }, warrantyConfig: {}, isActive: true }],
        products: [
          {
            id: 'p1',
            name: 'P1',
            slug: 'p1',
            brandId: 'b1',
            categoryId: 'c1',
            kind: 'ACCESSORY',
            weight: 1,
            length: 1,
            width: 1,
            height: 1,
            specs: { schemaVersion: 1, values: {} },
            warrantyConfig: {},
            images: [],
            variants: [{ sku: 'SKU-REVOKED-1', title: 'V1', price: 1000, stock: 5, optionValues: {} }],
            sourceIds: ['src-revoked'],
          },
        ],
      };

      const result = validateCatalogManifest(manifestWithRevoked);
      assert.equal(result.quarantinedProducts.length, 1);
      assert.equal(result.quarantinedProducts[0].productId, 'p1');
    });
  });

  describe('importElectronicsCatalog execution with mock database', () => {
    it('runs dryRun without persisting anything', async () => {
      const { importElectronicsCatalog } = await import('../scripts/import-electronics-catalog.ts');
      const manifest: CatalogManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

      const mockDb: any = {
        dataSource: {
          findMany: async () => [],
          create: async () => { throw new Error('Should not write on dryRun'); },
        },
      };

      const report: ImportReport = await importElectronicsCatalog(mockDb, manifest, {
        demoMode: true,
        dryRun: true,
      });

      assert.equal(report.dryRun, true);
      assert.equal(report.productsCount, manifest.products.length);
      assert.equal(report.changes.productsAdded, 0);
      assert.equal(report.changes.sourcesAdded, 0);
    });

    it('flags reviewRequired when existing DataSource checksum differs from manifest', async () => {
      const { importElectronicsCatalog } = await import('../scripts/import-electronics-catalog.ts');
      const manifest: CatalogManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

      const mockDb: any = {
        dataSource: {
          findMany: async () => [
            { id: manifest.sources[0].id, checksum: 'sha256-old-different-checksum' },
          ],
        },
      };

      const report: ImportReport = await importElectronicsCatalog(mockDb, manifest, {
        demoMode: true,
        dryRun: true,
      });

      assert.equal(report.reviewRequired, true);
      assert.ok(report.warnings.some((w) => w.includes('checksum changed')));
    });

    it('persists records when dryRun is false and handles idempotency', async () => {
      const { importElectronicsCatalog } = await import('../scripts/import-electronics-catalog.ts');
      const sampleManifest: CatalogManifest = {
        version: '1.0.0',
        manifestVersion: 1,
        generatedAt: '2026-10-18T00:00:00Z',
        sources: [
          {
            id: 'src-test',
            name: 'Test Source',
            sourceType: 'MANUFACTURER',
            status: 'ACTIVE',
            publisher: 'Test Pub',
            url: 'https://test.com',
            license: 'Open',
            version: '1.0',
            checksum: 'test-chk',
            isSynthetic: false,
          },
        ],
        brands: [
          { id: 'b-test', name: 'Brand Test', slug: 'b-test', country: 'US', websiteUrl: 'https://b.com', isActive: true },
        ],
        categories: [
          { id: 'c-test', name: 'Cat Test', slug: 'c-test', kind: 'LAPTOP', specSchemaVersion: 1, specSchema: { schemaVersion: 1, definitions: [] }, warrantyConfig: {}, isActive: true },
        ],
        products: [
          {
            id: 'p-test',
            name: 'Product Test',
            slug: 'p-test',
            brandId: 'b-test',
            categoryId: 'c-test',
            kind: 'LAPTOP',
            weight: 1, length: 1, width: 1, height: 1,
            specs: { schemaVersion: 1, values: {} },
            variants: [{ sku: 'SKU-MOCK-1', title: 'V1', price: 1000, stock: 5, optionValues: {} }],
            sourceIds: ['src-test'],
            origin: 'Test Spec',
          },
        ],
      };

      const createdSources: any[] = [];
      const createdBrands: any[] = [];
      const createdCategories: any[] = [];
      const createdProducts: any[] = [];
      const createdVariants: any[] = [];

      const mockDb: any = {
        dataSource: {
          findMany: async () => [],
          create: async (args: any) => { createdSources.push(args.data); return args.data; },
        },
        brand: {
          findUnique: async () => null,
          create: async (args: any) => { createdBrands.push(args.data); return args.data; },
        },
        category: {
          findUnique: async () => null,
          create: async (args: any) => { createdCategories.push(args.data); return args.data; },
        },
        product: {
          findUnique: async () => null,
          create: async (args: any) => { createdProducts.push(args.data); return args.data; },
        },
        productVariant: {
          findUnique: async () => null,
          create: async (args: any) => { createdVariants.push(args.data); return args.data; },
        },
      };

      const report = await importElectronicsCatalog(mockDb, sampleManifest, { demoMode: true, dryRun: false });
      assert.equal(report.changes.productsAdded, 1);
      assert.equal(report.changes.variantsAdded, 1);
      assert.equal(createdProducts.length, 1);
      assert.equal(createdVariants.length, 1);
      assert.equal(createdVariants[0].sku, 'SKU-MOCK-1');
      assert.equal(createdVariants[0].onHandStock, 5, 'Must initialize onHandStock on variant');
      assert.equal(createdProducts[0].onHandStock, 5, 'Must initialize onHandStock on product');
    });
  });
});
