import { prisma } from '@server/database/prisma';
import { validateProductSpecs } from '@shared/validations/catalog-json';
import type { CategorySpecSchema, ProductSpecs } from '@shared/types/catalog';

export interface CatalogReadinessDetails {
  hasBrand: boolean;
  hasCategory: boolean;
  hasSpecs: boolean;
  hasActiveSource: boolean;
  hasPacking: boolean;
  hasWarranty: boolean;
  hasSellableVariant: boolean;
  isLegacy: boolean;
}

export interface CatalogReadiness {
  productId: string;
  publishable: boolean;
  missing: string[];
  warnings: string[];
  details?: CatalogReadinessDetails;
}

export interface ProductForReadiness {
  id: string;
  name?: string;
  slug?: string;
  kind?: string;
  isLegacy?: boolean;
  brandId?: string | null;
  categoryId?: string | null;
  catalogVersion?: number;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  specs?: unknown;
  warrantyConfig?: unknown;
  brand?: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  } | null;
  categoryRef?: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    specSchemaVersion: number;
    specSchema: unknown;
    warrantyConfig?: unknown;
    isActive: boolean;
  } | null;
  variants?: Array<{
    id: string;
    productId?: string;
    sku?: string;
    price: number | bigint;
    stock: number;
    isActive: boolean;
    warrantyConfig?: unknown;
    optionValues?: unknown;
  }>;
}

export interface DataSourceForReadiness {
  id: string;
  name?: string;
  sourceType: string;
  status: string;
  payload?: unknown;
}

export interface CatalogReadinessDb {
  product: {
    findUnique(args: {
      where: { id: string };
      include?: { brand?: boolean; categoryRef?: boolean; variants?: boolean };
    }): Promise<ProductForReadiness | null>;
  };
  dataSource: {
    findMany(args?: {
      where?: {
        status?: string;
        sourceType?: { in: string[] } | string;
      };
    }): Promise<DataSourceForReadiness[]>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Đánh giá tính sẵn sàng của sản phẩm trước khi publish lên catalog điện tử
 */
export async function evaluateCatalogReadiness(
  productId: string,
  db: CatalogReadinessDb = prisma as unknown as CatalogReadinessDb
): Promise<CatalogReadiness> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      categoryRef: true,
      variants: true,
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  const weight = product.weight ?? product.weightGrams ?? 0;
  const length = product.length ?? product.lengthCm ?? 0;
  const width = product.width ?? product.widthCm ?? 0;
  const height = product.height ?? product.heightCm ?? 0;

  // 1. Kiểm tra sản phẩm cũ (Legacy)
  const isLegacy = Boolean(product.isLegacy || product.kind === 'LEGACY');
  if (isLegacy) {
    return {
      productId,
      publishable: false,
      missing: ['legacy_normalization_required'],
      warnings: ['legacy_catalog_item'],
      details: {
        hasBrand: Boolean(product.brandId && product.brand?.isActive),
        hasCategory: Boolean(product.categoryId && product.categoryRef?.isActive),
        hasSpecs: false,
        hasActiveSource: false,
        hasPacking: Boolean(weight > 0 && length > 0 && width > 0 && height > 0),
        hasWarranty: Boolean(product.warrantyConfig),
        hasSellableVariant: Boolean(
          product.variants?.some((v) => v.isActive && Number(v.price) > 0 && v.stock >= 0)
        ),
        isLegacy: true,
      },
    };
  }

  // 2. Brand check (bắt buộc active)
  const hasBrand = Boolean(product.brandId && product.brand && product.brand.isActive);
  if (!hasBrand) {
    missing.push('brand');
  }

  // 3. Category check (bắt buộc active và kind khớp với product)
  const hasCategory = Boolean(
    product.categoryId &&
      product.categoryRef &&
      product.categoryRef.isActive &&
      product.categoryRef.kind === product.kind
  );
  if (!hasCategory) {
    missing.push('category');
  }

  // 4. Specs check: phải validate hợp lệ theo specSchema của Category
  let hasSpecs = false;
  if (hasCategory && product.categoryRef && isRecord(product.specs)) {
    try {
      const specs = product.specs as unknown as ProductSpecs;
      if (specs.schemaVersion === product.categoryRef.specSchemaVersion) {
        validateProductSpecs(specs, product.categoryRef.specSchema as CategorySpecSchema);
        hasSpecs = true;
      }
    } catch {
      hasSpecs = false;
    }
  }
  if (!hasSpecs) {
    missing.push('specs');
  }

  // 5. Packing dimensions & weight (bắt buộc cho logistics)
  const hasPacking = Boolean(weight > 0 && length > 0 && width > 0 && height > 0);
  if (!hasPacking) {
    missing.push('packing_dimensions');
  }

  // 6. Warranty resolution (Category, Product hoặc Variant phải có cấu hình bảo hành)
  const hasWarranty = Boolean(
    (product.categoryRef?.warrantyConfig && isRecord(product.categoryRef.warrantyConfig)) ||
      (product.warrantyConfig && isRecord(product.warrantyConfig)) ||
      product.variants?.some((v) => v.isActive && v.warrantyConfig && isRecord(v.warrantyConfig))
  );
  if (!hasWarranty) {
    missing.push('warranty_config');
  }

  // 7. Sellable variant (ít nhất 1 variant active với giá > 0 và tồn kho >= 0)
  const hasSellableVariant = Boolean(
    product.variants &&
      product.variants.some((v) => v.isActive && Number(v.price) > 0 && v.stock >= 0)
  );
  if (!hasSellableVariant) {
    missing.push('sellable_variant');
  }

  // 8. Active catalog DataSource
  const activeSources = await db.dataSource.findMany({
    where: {
      status: 'ACTIVE',
      sourceType: { in: ['CATALOG', 'MANUFACTURER'] },
    },
  });

  const hasActiveSource = activeSources.some((s) => {
    if (!isRecord(s.payload)) return false;
    const mapping = s.payload.mapping;
    if (!isRecord(mapping)) return false;
    return mapping.productId === productId;
  });

  if (product.kind === 'LAPTOP' || product.kind === 'PHONE') {
    if (!hasActiveSource) {
      missing.push('active_catalog_source');
    }
  } else if (product.kind === 'ACCESSORY') {
    if (!hasActiveSource) {
      warnings.push('no_active_catalog_source: recommended to link manufacturer or catalog DataSource');
    }
  }

  return {
    productId,
    publishable: missing.length === 0,
    missing,
    warnings,
    details: {
      hasBrand,
      hasCategory,
      hasSpecs,
      hasActiveSource,
      hasPacking,
      hasWarranty,
      hasSellableVariant,
      isLegacy: false,
    },
  };
}
