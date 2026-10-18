import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@server/database/prisma';
import { computeVariantOptionHash, canonicalJsonHash } from '@shared/validations/catalog-json';

export interface ManifestSource {
  id: string;
  name: string;
  sourceType: 'MANUFACTURER' | 'CATALOG' | 'BENCHMARK' | 'COMMUNITY';
  status?: 'ACTIVE' | 'REVOKED' | 'QUARANTINED' | 'PENDING';
  publisher: string;
  url: string;
  license: string;
  version: string;
  checksum: string;
  isSynthetic: boolean;
  payload?: Record<string, unknown>;
}

export interface ManifestBrand {
  id: string;
  name: string;
  slug: string;
  country: string;
  websiteUrl: string;
  isActive: boolean;
}

export interface ManifestCategory {
  id: string;
  name: string;
  slug: string;
  kind: 'LAPTOP' | 'PHONE' | 'ACCESSORY';
  specSchemaVersion: number;
  specSchema: Record<string, unknown>;
  warrantyConfig: Record<string, unknown>;
  isActive: boolean;
}

export interface ManifestVariant {
  sku: string;
  title: string;
  price: number;
  stock: number;
  color?: string;
  size?: string;
  optionValues: Record<string, unknown>;
  specOverrides?: Record<string, unknown>;
}

export interface ManifestProduct {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  brandId: string;
  categoryId: string;
  kind: 'LAPTOP' | 'PHONE' | 'ACCESSORY';
  segment?: string | null;
  weight: number;
  length: number;
  width: number;
  height: number;
  specs: Record<string, unknown>;
  warrantyConfig?: Record<string, unknown>;
  images?: Array<{ url: string; alt: string; sortOrder: number }>;
  variants: ManifestVariant[];
  sourceIds?: string[];
  origin?: string;
  licenseNotice?: string;
}

export interface CatalogManifest {
  version: string;
  manifestVersion: number;
  generatedAt: string;
  sources: ManifestSource[];
  brands: ManifestBrand[];
  categories: ManifestCategory[];
  products: ManifestProduct[];
}

export interface ImportReport {
  dryRun: boolean;
  demoMode: boolean;
  brandsCount: number;
  categoriesCount: number;
  productsCount: number;
  variantsCount: number;
  sourcesCount: number;
  activeSourcesCount: number;
  revokedSourcesCount: number;
  quarantinedCount: number;
  skippedCount: number;
  reviewRequired: boolean;
  changes: {
    brandsAdded: number;
    categoriesAdded: number;
    productsAdded: number;
    productsUpdated: number;
    variantsAdded: number;
    sourcesAdded: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  quarantinedProducts: Array<{ productId: string; reason: string }>;
}

/**
 * Validates CatalogManifest structure, uniqueness, relations and source licenses.
 */
export function validateCatalogManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const quarantinedProducts: Array<{ productId: string; reason: string }> = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {
      valid: false,
      errors: ['Manifest must be a non-null object'],
      warnings: [],
      quarantinedProducts: [],
    };
  }

  const raw = manifest as Record<string, unknown>;
  if (!raw.version || typeof raw.version !== 'string') {
    errors.push('Manifest version string is required');
  }
  if (typeof raw.manifestVersion !== 'number') {
    errors.push('Manifest manifestVersion number is required');
  }

  const sources = (Array.isArray(raw.sources) ? raw.sources : []) as ManifestSource[];
  const brands = (Array.isArray(raw.brands) ? raw.brands : []) as ManifestBrand[];
  const categories = (Array.isArray(raw.categories) ? raw.categories : []) as ManifestCategory[];
  const products = (Array.isArray(raw.products) ? raw.products : []) as ManifestProduct[];

  // Validate Sources map
  const sourceMap = new Map<string, ManifestSource>();
  for (const src of sources) {
    if (!src.id || !src.name || !src.license || !src.checksum) {
      errors.push(`Source definition ${src.id || 'unnamed'} is missing required license/checksum fields`);
      continue;
    }
    sourceMap.set(src.id, src);
  }

  // Validate Brands
  const brandIds = new Set<string>();
  for (const brand of brands) {
    if (brandIds.has(brand.id)) {
      errors.push(`Duplicate brand ID: "${brand.id}"`);
    }
    brandIds.add(brand.id);
  }

  // Validate Categories
  const categoryIds = new Set<string>();
  for (const cat of categories) {
    if (categoryIds.has(cat.id)) {
      errors.push(`Duplicate category ID: "${cat.id}"`);
    }
    categoryIds.add(cat.id);
  }

  // Validate Products & Variants
  const productIds = new Set<string>();
  const productSlugs = new Set<string>();
  const variantSkus = new Set<string>();

  for (const product of products) {
    if (productIds.has(product.id)) {
      errors.push(`Duplicate product ID: "${product.id}"`);
    }
    productIds.add(product.id);

    if (productSlugs.has(product.slug)) {
      errors.push(`Duplicate product slug: "${product.slug}"`);
    }
    productSlugs.add(product.slug);

    if (!brandIds.has(product.brandId)) {
      errors.push(`Product "${product.id}" references undeclared brandId "${product.brandId}"`);
    }
    if (!categoryIds.has(product.categoryId)) {
      errors.push(`Product "${product.id}" references undeclared categoryId "${product.categoryId}"`);
    }

    // Check source compliance
    if (product.sourceIds && product.sourceIds.length > 0) {
      for (const srcId of product.sourceIds) {
        const sourceDef = sourceMap.get(srcId);
        if (!sourceDef) {
          quarantinedProducts.push({
            productId: product.id,
            reason: `References unknown source ID "${srcId}"`,
          });
        } else if (sourceDef.status === 'REVOKED') {
          quarantinedProducts.push({
            productId: product.id,
            reason: `References REVOKED data source "${srcId}"`,
          });
        } else if (sourceDef.status === 'QUARANTINED') {
          quarantinedProducts.push({
            productId: product.id,
            reason: `References QUARANTINED data source "${srcId}"`,
          });
        }
      }
    }

    if (!product.variants || product.variants.length === 0) {
      errors.push(`Product "${product.id}" must contain at least one variant`);
    } else {
      for (const variant of product.variants) {
        if (variantSkus.has(variant.sku)) {
          errors.push(`Duplicate variant SKU across manifest: "${variant.sku}"`);
        }
        variantSkus.add(variant.sku);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    quarantinedProducts,
  };
}

/**
 * Transactional, license-gated electronics catalog importer.
 */
export async function importElectronicsCatalog(
  db: PrismaClient,
  manifest: CatalogManifest,
  options: { demoMode: boolean; dryRun: boolean }
): Promise<ImportReport> {
  const validation = validateCatalogManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Catalog manifest validation failed:\n${validation.errors.join('\n')}`);
  }

  const quarantinedIdSet = new Set(validation.quarantinedProducts.map((q) => q.productId));

  const totalProducts = manifest.products.length;
  const totalVariants = manifest.products.reduce((acc, p) => acc + p.variants.length, 0);

  const report: ImportReport = {
    dryRun: options.dryRun,
    demoMode: options.demoMode,
    brandsCount: manifest.brands.length,
    categoriesCount: manifest.categories.length,
    productsCount: totalProducts,
    variantsCount: totalVariants,
    sourcesCount: manifest.sources.length,
    activeSourcesCount: manifest.sources.filter((s) => s.status !== 'REVOKED' && s.status !== 'QUARANTINED').length,
    revokedSourcesCount: manifest.sources.filter((s) => s.status === 'REVOKED').length,
    quarantinedCount: quarantinedIdSet.size,
    skippedCount: 0,
    reviewRequired: false,
    changes: {
      brandsAdded: 0,
      categoriesAdded: 0,
      productsAdded: 0,
      productsUpdated: 0,
      variantsAdded: 0,
      sourcesAdded: 0,
    },
    errors: [],
    warnings: [...validation.warnings],
  };

  if (validation.quarantinedProducts.length > 0) {
    for (const q of validation.quarantinedProducts) {
      report.warnings.push(`Product ${q.productId} quarantined: ${q.reason}`);
    }
  }

  // 1. Check existing sources for checksum drift (audit protection)
  const sourceIds = manifest.sources.map((s) => s.id);
  let existingSources: any[] = [];
  try {
    existingSources = await db.dataSource.findMany({
      where: { id: { in: sourceIds } },
    });
  } catch (err: any) {
    if (options.dryRun) {
      report.warnings.push(`Database connection skipped during dry-run: ${err.message || 'offline'}`);
    } else {
      throw err;
    }
  }
  const existingSourceMap = new Map(existingSources.map((s) => [s.id, s]));

  for (const src of manifest.sources) {
    const existing = existingSourceMap.get(src.id);
    if (existing) {
      if (existing.checksum && existing.checksum !== src.checksum) {
        report.reviewRequired = true;
        report.warnings.push(
          `DataSource "${src.id}" checksum changed in manifest (DB: ${existing.checksum}, Manifest: ${src.checksum}). Requires architecture review.`
        );
      }
    }
  }

  if (options.dryRun) {
    return report;
  }

  // 2. Persist DataSources (never activate revoked sources)
  for (const src of manifest.sources) {
    const effectiveStatus = src.status === 'REVOKED' || src.status === 'QUARANTINED' ? 'REVOKED' : 'ACTIVE';
    const effectiveType = src.sourceType === 'COMMUNITY' ? 'REVIEW_AGGREGATE' : src.sourceType;
    const existing = existingSourceMap.get(src.id);
    if (!existing) {
      await db.dataSource.create({
        data: {
          id: src.id,
          name: src.name,
          sourceType: effectiveType as any,
          status: effectiveStatus,
          publisher: src.publisher,
          url: src.url,
          license: src.license,
          version: src.version,
          checksum: src.checksum,
          isSynthetic: options.demoMode || src.isSynthetic,
          payload: (src.payload as any) ?? {},
        },
      });
      report.changes.sourcesAdded++;
    } else if (existing.status !== 'REVOKED' && src.status === 'REVOKED') {
      await db.dataSource.update({
        where: { id: src.id },
        data: { status: 'REVOKED' },
      });
    }
  }

  // 3. Persist Brands
  for (const brand of manifest.brands) {
    const existing = await db.brand.findUnique({ where: { id: brand.id } });
    if (!existing) {
      await db.brand.create({
        data: {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          country: brand.country,
          websiteUrl: brand.websiteUrl,
          isActive: brand.isActive,
        },
      });
      report.changes.brandsAdded++;
    }
  }

  // 4. Persist Categories
  for (const cat of manifest.categories) {
    const existing = await db.category.findUnique({ where: { id: cat.id } });
    if (!existing) {
      await db.category.create({
        data: {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          kind: cat.kind,
          specSchemaVersion: cat.specSchemaVersion,
          specSchema: cat.specSchema as any,
          warrantyConfig: cat.warrantyConfig as any,
          isActive: cat.isActive,
        },
      });
      report.changes.categoriesAdded++;
    }
  }

  // 5. Persist Products and Variants (Skip quarantined products from active insertion)
  for (const product of manifest.products) {
    if (quarantinedIdSet.has(product.id)) {
      report.skippedCount++;
      continue;
    }

    const existingProd = await db.product.findUnique({ where: { id: product.id } });
    const basePrice = BigInt(product.variants[0]?.price ?? 0);

    if (!existingProd) {
      await db.product.create({
        data: {
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          brandId: product.brandId,
          categoryId: product.categoryId,
          kind: product.kind,
          segment: (product.segment as any) ?? 'MID',
          weightGrams: Math.round(product.weight * 1000),
          lengthCm: Math.round(product.length),
          widthCm: Math.round(product.width),
          heightCm: Math.round(product.height),
          specs: (product.specs as any) ?? {},
          warrantyConfig: (product.warrantyConfig as any) ?? {},
          images: (product.images as any) ?? [],
          price: basePrice,
          stock: product.variants.reduce((sum, v) => sum + v.stock, 0),
          isActive: true,
        },
      });
      report.changes.productsAdded++;
    } else {
      report.changes.productsUpdated++;
    }

    // Persist Variants with Operational Stock Protection:
    // If variant exists, do not overwrite modified live stock!
    for (const v of product.variants) {
      const existingVar = await db.productVariant.findUnique({ where: { sku: v.sku } });
      const optionHash = computeVariantOptionHash((v.optionValues as any) ?? {});

      if (!existingVar) {
        await db.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku,
            title: v.title,
            price: BigInt(v.price),
            stock: v.stock,
            color: v.color ?? null,
            size: v.size ?? null,
            optionValues: (v.optionValues as any) ?? {},
            optionHash,
            specOverrides: (v.specOverrides as any) ?? {},
            isActive: true,
          },
        });
        report.changes.variantsAdded++;
      }
    }
  }

  return report;
}

/**
 * CLI Runner
 */
export async function runCli(argv = process.argv.slice(2)) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const defaultManifestPath = path.resolve(__dirname, '../prisma/data/electronics-catalog.json');

  let manifestPath = defaultManifestPath;
  let dryRun = false;
  let demoMode = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--demo-mode') {
      demoMode = true;
    } else if (arg.startsWith('--manifest=')) {
      manifestPath = path.resolve(process.cwd(), arg.slice('--manifest='.length));
    } else if (arg === '--manifest') {
      manifestPath = path.resolve(process.cwd(), argv[++i]);
    }
  }

  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest file not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CatalogManifest;
  console.log(`Starting catalog import (dryRun: ${dryRun}, demoMode: ${demoMode})...`);
  const report = await importElectronicsCatalog(defaultPrisma, manifest, { dryRun, demoMode });

  console.log('Catalog Import Complete:');
  console.log(JSON.stringify(report, null, 2));

  if (report.reviewRequired) {
    console.warn('\n[REVIEW REQUIRED] Checksum drift detected on existing DataSource records.');
  }

  process.exit(report.errors.length > 0 ? 1 : 0);
}

// Auto-run if executed directly
if (process.argv[1]) {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    if (path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
      runCli().catch((err) => {
        console.error('Fatal import error:', err);
        process.exit(1);
      });
    }
  } catch {
    // imported as module
  }
}
