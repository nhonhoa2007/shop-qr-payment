import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  importElectronicsCatalog,
  type CatalogManifest,
  type ImportReport,
} from '../../scripts/import-electronics-catalog.ts';

const db = new PrismaClient();
const tag = crypto.randomUUID().slice(0, 8);

test('Catalog Importer Integration: Idempotency, checksum validation, and isolation', async (t) => {
  try {
    await db.$connect();
  } catch {
    t.skip('Skipping database-dependent test: PostgreSQL is not running locally');
    return;
  }

  const manifest: CatalogManifest = {
    version: '1.0.0',
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: `src-integ-${tag}`,
        name: `Integration Test Source ${tag}`,
        sourceType: 'MANUFACTURER',
        status: 'ACTIVE',
        publisher: 'Test Publisher Inc.',
        url: 'https://example.com/test-source',
        license: 'Open Access / CC-BY-4.0',
        version: '1.0',
        checksum: `checksum-v1-${tag}`,
        isSynthetic: true,
      },
      {
        id: `src-revoked-${tag}`,
        name: `Revoked Source ${tag}`,
        sourceType: 'COMMUNITY',
        status: 'REVOKED',
        publisher: 'Disputed Community',
        url: 'https://example.com/revoked-source',
        license: 'Disputed License',
        version: '0.1',
        checksum: `checksum-rev-${tag}`,
        isSynthetic: true,
      },
    ],
    brands: [
      {
        id: `brand-integ-${tag}`,
        name: `Test Brand ${tag}`,
        slug: `test-brand-${tag}`,
        country: 'Vietnam',
        websiteUrl: 'https://example.com/brand',
        isActive: true,
      },
    ],
    categories: [
      {
        id: `cat-integ-${tag}`,
        name: `Test Laptop ${tag}`,
        slug: `test-laptop-${tag}`,
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
        id: `prod-integ-${tag}`,
        name: `Integration Product ${tag}`,
        slug: `integ-product-${tag}`,
        description: 'Test laptop for catalog importer',
        brandId: `brand-integ-${tag}`,
        categoryId: `cat-integ-${tag}`,
        kind: 'LAPTOP',
        segment: 'MID',
        weight: 1.5,
        length: 30,
        width: 20,
        height: 1.5,
        specs: {
          schemaVersion: 1,
          values: {
            cpu: { state: 'KNOWN', value: 'Intel Core Ultra 7' },
          },
        },
        warrantyConfig: { periodMonths: 12 },
        images: [{ url: 'https://example.com/laptop.jpg', alt: 'Laptop', sortOrder: 0 }],
        variants: [
          {
            sku: `SKU-INTEG-${tag}-1`,
            title: '16GB / 512GB Space Gray',
            price: 25000000,
            stock: 15,
            optionValues: { ram: 16, ssd: 512 },
          },
        ],
        sourceIds: [`src-integ-${tag}`],
        origin: 'Integration Test Spec',
      },
      {
        id: `prod-quarantine-${tag}`,
        name: `Quarantined Product ${tag}`,
        slug: `quarantined-product-${tag}`,
        description: 'Uses revoked source',
        brandId: `brand-integ-${tag}`,
        categoryId: `cat-integ-${tag}`,
        kind: 'LAPTOP',
        weight: 1.5,
        length: 30,
        width: 20,
        height: 1.5,
        specs: { schemaVersion: 1, values: {} },
        warrantyConfig: {},
        images: [],
        variants: [
          {
            sku: `SKU-REVOKED-${tag}-1`,
            title: 'Variant With Revoked Source',
            price: 15000000,
            stock: 5,
            optionValues: {},
          },
        ],
        sourceIds: [`src-revoked-${tag}`],
        origin: 'Revoked Community Source',
      },
    ],
  };

  try {
    // 1. Dry Run test
    const dryRunReport = await importElectronicsCatalog(db, manifest, { demoMode: true, dryRun: true });
    assert.equal(dryRunReport.dryRun, true);
    assert.ok(dryRunReport.productsCount >= 1);

    // Verify dry run did NOT write to database
    const dryRunProduct = await db.product.findUnique({ where: { id: `prod-integ-${tag}` } });
    assert.equal(dryRunProduct, null, 'Dry run must not persist records');

    // 2. Real import run
    const report1 = await importElectronicsCatalog(db, manifest, { demoMode: true, dryRun: false });
    assert.equal(report1.dryRun, false);
    assert.equal(report1.changes.productsAdded, 1, 'Only non-quarantined product should be added as active');
    assert.equal(report1.quarantinedCount, 1, 'Product with revoked source must be quarantined');

    // Verify persisted product and variant
    const persisted = await db.product.findUnique({
      where: { id: `prod-integ-${tag}` },
      include: { variants: true },
    });
    assert.ok(persisted, 'Product must be persisted');
    assert.equal(persisted.variants.length, 1);
    assert.equal(persisted.variants[0].sku, `SKU-INTEG-${tag}-1`);

    // Verify revoked source was NOT activated
    const revokedSource = await db.dataSource.findUnique({ where: { id: `src-revoked-${tag}` } });
    if (revokedSource) {
      assert.notEqual(revokedSource.status, 'ACTIVE', 'Revoked source must not be ACTIVE');
    }

    // 3. Second import run for Idempotency
    const report2 = await importElectronicsCatalog(db, manifest, { demoMode: true, dryRun: false });
    assert.equal(report2.changes.productsAdded, 0, 'Second run must not re-add products');
    assert.equal(report2.changes.variantsAdded, 0, 'Second run must not re-add variants');

    // 4. Checksum change on existing source requires review
    const modifiedManifest = JSON.parse(JSON.stringify(manifest)) as CatalogManifest;
    modifiedManifest.sources[0].checksum = `checksum-tampered-${tag}`;
    const report3 = await importElectronicsCatalog(db, modifiedManifest, { demoMode: true, dryRun: false });
    assert.equal(report3.reviewRequired, true, 'Checksum change must trigger reviewRequired');

    // 5. Existing order/stock/serial isolation: manually modify stock and assert import does not overwrite it
    await db.productVariant.update({
      where: { sku: `SKU-INTEG-${tag}-1` },
      data: { stock: 42 },
    });
    // Re-import without dryRun
    await importElectronicsCatalog(db, manifest, { demoMode: true, dryRun: false });
    const stockAfter = await db.productVariant.findUnique({
      where: { sku: `SKU-INTEG-${tag}-1` },
      select: { stock: true },
    });
    assert.equal(stockAfter?.stock, 42, 'Importer must not blindly overwrite modified operational stock');

  } finally {
    // Cleanup created test records
    await db.productVariant.deleteMany({ where: { sku: { contains: tag } } }).catch(() => {});
    await db.product.deleteMany({ where: { id: { contains: tag } } }).catch(() => {});
    await db.category.deleteMany({ where: { id: { contains: tag } } }).catch(() => {});
    await db.brand.deleteMany({ where: { id: { contains: tag } } }).catch(() => {});
    await db.dataSource.deleteMany({ where: { id: { contains: tag } } }).catch(() => {});
  }
});
