import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELECTRONICS_BRANDS,
  ELECTRONICS_CATEGORIES,
  ELECTRONICS_PRODUCTS,
  ELECTRONICS_DATA_SOURCES,
} from '../prisma/seed-electronics-catalog.ts';
import {
  validateCategorySpecSchema,
  validateProductSpecs,
  validateCatalogImages,
  computeVariantOptionHash,
} from '@shared/validations/catalog-json';
import type { CategorySpecSchema, ProductKind } from '@shared/types/catalog';

describe('Electronics Vertical Slice Seed Fixtures & Readiness', () => {
  test('contains exactly 10 products: 2 laptops, 2 smartphones, 6 accessories', () => {
    assert.equal(ELECTRONICS_PRODUCTS.length, 10, 'Expected exactly 10 products in the vertical slice');

    const laptops = ELECTRONICS_PRODUCTS.filter((p) => p.kind === ('LAPTOP' as ProductKind));
    const phones = ELECTRONICS_PRODUCTS.filter((p) => p.kind === ('PHONE' as ProductKind));
    const accessories = ELECTRONICS_PRODUCTS.filter((p) => p.kind === ('ACCESSORY' as ProductKind));

    assert.equal(laptops.length, 2, 'Must have exactly 2 laptops');
    assert.equal(phones.length, 2, 'Must have exactly 2 smartphones');
    assert.equal(accessories.length, 6, 'Must have exactly 6 accessories');
  });

  test('all categories have valid spec schemas conforming to strict DSL', () => {
    assert.ok(ELECTRONICS_CATEGORIES.length >= 3, 'Must have at least 3 categories');

    for (const cat of ELECTRONICS_CATEGORIES) {
      assert.doesNotThrow(() => {
        validateCategorySpecSchema(cat.specSchema);
      }, `Category ${cat.slug} schema must be valid`);
    }
  });

  test('all products conform to their category spec schema and preserve 3-state fidelity', () => {
    const categoryMap = new Map<string, CategorySpecSchema>();
    for (const cat of ELECTRONICS_CATEGORIES) {
      categoryMap.set(cat.id, cat.specSchema as CategorySpecSchema);
    }

    for (const product of ELECTRONICS_PRODUCTS) {
      const catSchema = categoryMap.get(product.categoryId);
      assert.ok(catSchema, `Category schema must exist for product ${product.slug}`);

      assert.doesNotThrow(() => {
        validateProductSpecs(product.specs, catSchema);
      }, `Product ${product.slug} specs must pass schema validation`);

      // Verify 3-state knowledge state fidelity:
      // Laptops must explicitly mark NFC as UNSUPPORTED
      if (product.kind === 'LAPTOP') {
        const specs = product.specs as { values: Record<string, { state: string }> };
        assert.equal(
          specs.values.nfc?.state,
          'UNSUPPORTED',
          `Laptop ${product.slug} must have nfc explicitly marked as UNSUPPORTED`
        );
      }

      // Smartphones must have NFC as KNOWN with true
      if (product.kind === 'PHONE') {
        const specs = product.specs as { values: Record<string, { state: string; value?: unknown }> };
        assert.equal(
          specs.values.nfc?.state,
          'KNOWN',
          `Smartphone ${product.slug} must have nfc explicitly marked as KNOWN`
        );
        assert.equal(specs.values.nfc?.value, true);
      }
    }
  });

  test('all variants have globally unique SKUs, positive prices, and unique option hashes', () => {
    const allSkus = new Set<string>();

    for (const product of ELECTRONICS_PRODUCTS) {
      assert.ok(product.variants.length > 0, `Product ${product.slug} must have at least one variant`);

      const productOptionHashes = new Set<string>();

      for (const variant of product.variants) {
        // Unique SKU check across whole catalog
        const lowerSku = variant.sku.toLowerCase();
        assert.ok(!allSkus.has(lowerSku), `Duplicate SKU across catalog: ${variant.sku}`);
        allSkus.add(lowerSku);

        // Price check
        assert.ok(Number(variant.price) > 0, `Variant ${variant.sku} must have price > 0`);
        assert.ok(variant.stock >= 0, `Variant ${variant.sku} must have non-negative stock`);

        // Option hash check per product
        const optValues = variant.optionValues as Record<string, string | number | boolean> || {};
        const optItems = Object.entries(optValues).map(([code, value]) => ({ code, value }));
        const hash = computeVariantOptionHash(optItems);
        assert.ok(
          !productOptionHashes.has(hash),
          `Product ${product.slug} has duplicate variant optionHash: ${hash}`
        );
        productOptionHashes.add(hash);
      }
    }
  });

  test('all products have valid catalog images with at least 1 image and valid roles', () => {
    for (const product of ELECTRONICS_PRODUCTS) {
      assert.doesNotThrow(() => {
        validateCatalogImages(product.images);
      }, `Images for ${product.slug} must be valid`);

      assert.ok(
        Array.isArray(product.images) && product.images.length >= 1,
        `Product ${product.slug} must have at least one image`
      );
    }
  });

  test('all products have valid logistics packing dimensions and warranty configs', () => {
    for (const product of ELECTRONICS_PRODUCTS) {
      assert.ok(product.weight > 0, `Product ${product.slug} weight must be > 0`);
      assert.ok(product.length > 0, `Product ${product.slug} length must be > 0`);
      assert.ok(product.width > 0, `Product ${product.slug} width must be > 0`);
      assert.ok(product.height > 0, `Product ${product.slug} height must be > 0`);
      assert.ok(product.warrantyConfig, `Product ${product.slug} must have warrantyConfig`);
    }
  });

  test('all data sources have transparent provenance, valid licenses, and active status', () => {
    assert.ok(
      ELECTRONICS_DATA_SOURCES.length >= 10,
      'Must have at least 10 data sources corresponding to the vertical slice'
    );

    const productIdsWithActiveSource = new Set<string>();

    for (const src of ELECTRONICS_DATA_SOURCES) {
      assert.equal(src.status, 'ACTIVE', `Data source ${src.name} must be in ACTIVE status`);
      assert.ok(src.publisher && src.publisher.trim().length > 0, `Source ${src.name} must have publisher`);
      assert.ok(src.url && src.url.startsWith('http'), `Source ${src.name} must have a valid URL`);
      assert.ok(src.license && src.license.trim().length > 0, `Source ${src.name} must declare a license`);
      assert.ok(src.checksum && src.checksum.trim().length > 0, `Source ${src.name} must have a checksum`);
      assert.ok(src.version && src.version.trim().length > 0, `Source ${src.name} must have a version`);

      // Payload mapping to product
      const mapping = (src.payload as { mapping?: { productId: string } })?.mapping;
      if (mapping?.productId) {
        productIdsWithActiveSource.add(mapping.productId);
      }
    }

    // Every laptop and phone must have an active data source
    for (const p of ELECTRONICS_PRODUCTS) {
      if (p.kind === 'LAPTOP' || p.kind === 'PHONE') {
        assert.ok(
          productIdsWithActiveSource.has(p.id) || productIdsWithActiveSource.has(p.slug),
          `Primary device ${p.slug} must be mapped to an active data source`
        );
      }
    }
  });

  test('all brands are active and have valid slugs', () => {
    assert.ok(ELECTRONICS_BRANDS.length >= 5, 'Must have at least 5 recognized electronics brands');
    for (const b of ELECTRONICS_BRANDS) {
      assert.ok(b.name && b.name.trim().length > 0);
      assert.ok(b.slug && b.slug.trim().length > 0);
      assert.equal(b.isActive, true);
    }
  });
});
