import { prisma } from '@server/database/prisma.ts';
import { redis } from '@server/infrastructure/redis.ts';
import { serializeMoneyVnd } from '@shared/utils/money.ts';
import { formatVND } from '@shared/utils/index.ts';
import { resolveProductPricing } from './catalog-query.service.ts';
import type {
  ProductDetailDto,
  ProductSpecsDto,
  SpecItemDto,
  ProductVariantDto,
  EvidenceRef,
  MoneySnapshot,
  ProductComparisonMatrixDto,
  ComparisonSpecRow,
} from '@shared/types/product-detail.ts';
import type {
  CategorySpecSchema,
  ProductKind,
  ProductSegment,
  CatalogImage,
  ProductSpecs,
  SpecValue,
  VariantOptionItem,
} from '@shared/types/catalog.ts';
import type { InventoryMode } from '@shared/types/inventory.ts';

export function createMoneySnapshot(raw: number | bigint | string): MoneySnapshot {
  const bi = typeof raw === 'bigint' ? raw : BigInt(raw || 0);
  const amount = serializeMoneyVnd(bi);
  const formatted = formatVND(amount);
  return { amount, formatted };
}

export function buildProductDetailCacheKey(
  productId: string,
  revisions: {
    catalogVersion?: number;
    categorySchemaVersion?: number;
    sourceRevision?: string | number;
  }
): string {
  const cv = revisions.catalogVersion ?? 0;
  const csv = revisions.categorySchemaVersion ?? 0;
  const sr = revisions.sourceRevision ?? 'none';
  return `cache:product-detail:${productId}:cv${cv}:csv${csv}:sr${sr}`;
}

export interface MapProductDetailOptions {
  categorySchema?: CategorySpecSchema | null;
}

export function mapToProductDetailDto(
  rawProduct: Record<string, unknown>,
  options?: MapProductDetailOptions
): ProductDetailDto {
  const p = rawProduct as {
    id: string;
    name: string;
    slug?: string;
    description: string | null;
    image: string | null;
    price: number | bigint;
    stock: number;
    isActive: boolean;
    inventoryMode?: InventoryMode;
    kind?: ProductKind;
    segment?: ProductSegment | null;
    isLegacy?: boolean;
    catalogVersion?: number;
    specs?: ProductSpecs | null;
    images?: CatalogImage[] | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    brand?: { id: string; name: string; slug: string } | null;
    category?: string | null;
    categoryRef?: {
      id: string;
      name: string;
      slug: string;
      kind: ProductKind;
      specSchemaVersion?: number;
      specSchema?: CategorySpecSchema | null;
    } | null;
    variants?: Array<{
      id: string;
      productId: string;
      sku: string;
      title: string;
      price: number | bigint;
      stock?: number;
      isActive?: boolean;
      color?: string | null;
      size?: string | null;
      optionValues?: unknown;
      optionHash?: string | null;
      specOverrides?: unknown;
      images?: unknown;
      warrantyConfig?: unknown;
      serializationRequired?: boolean;
    }>;
    dataSources?: Array<{
      id: string;
      sourceType: string;
      status: string;
      publisher: string;
      url: string;
      licenseDecision?: string;
      version?: string;
      isSynthetic?: boolean;
      checksum?: string;
    }>;
    reviews?: Array<{ rating: number }>;
  };

  const isLegacy = Boolean(p.isLegacy || !p.categoryRef || p.kind === 'LEGACY');
  const inventoryMode: InventoryMode = p.inventoryMode || 'BASE';
  const kind: ProductKind = p.kind || (p.categoryRef?.kind as ProductKind) || 'LEGACY';
  const segment: ProductSegment | null = p.segment || null;
  const catalogVersion = p.catalogVersion ?? (isLegacy ? 0 : 1);

  // Pricing calculations
  const pricing = resolveProductPricing({
    price: p.price,
    stock: p.stock,
    inventoryMode,
    variants: p.variants,
  });

  const basePriceSnapshot = createMoneySnapshot(pricing.price);
  const effectivePriceSnapshot = createMoneySnapshot(pricing.effectivePrice);

  // Brand DTO
  const brand = p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug } : null;

  // Category DTO
  const category = p.categoryRef
    ? {
        id: p.categoryRef.id,
        name: p.categoryRef.name,
        slug: p.categoryRef.slug,
        kind: p.categoryRef.kind,
        specSchemaVersion: p.categoryRef.specSchemaVersion,
      }
    : {
        id: 'legacy',
        name: p.category || 'Legacy',
        slug: 'legacy',
        kind: 'LEGACY' as const,
      };

  // Specs DTO mapping
  let specsDto: ProductSpecsDto | null = null;
  if (p.specs && typeof p.specs === 'object' && p.specs.values) {
    const schema = options?.categorySchema || p.categoryRef?.specSchema;
    const defMap = new Map((schema?.definitions || []).map((d) => [d.code, d]));

    const items: SpecItemDto[] = [];
    const byCode: Record<string, SpecItemDto> = {};

    for (const [code, val] of Object.entries(p.specs.values)) {
      const def = defMap.get(code);
      const state = val.state;
      let formatted = 'Chưa xác định';

      if (state === 'UNSUPPORTED') {
        formatted = 'Không hỗ trợ';
      } else if (state === 'KNOWN' && val.value !== undefined) {
        if (typeof val.value === 'boolean') {
          formatted = val.value ? 'Có' : 'Không';
        } else if (val.unit) {
          formatted = `${val.value} ${val.unit}`;
        } else {
          formatted = String(val.value);
        }
      }

      const item: SpecItemDto = {
        code,
        label: def?.label || code,
        state,
        value: state === 'KNOWN' ? val.value : undefined,
        unit: state === 'KNOWN' ? (val.unit || def?.unit || null) : null,
        formatted,
        comparable: def?.comparable ?? false,
        filterable: def?.filterable ?? false,
        isOption: def?.isOption ?? false,
      };

      items.push(item);
      byCode[code] = item;
    }

    specsDto = {
      schemaVersion: p.specs.schemaVersion || 1,
      items,
      byCode,
    };
  }

  // Active variants DTO mapping
  const activeVariants = (p.variants || []).filter((v) => v.isActive !== false);
  const variants: ProductVariantDto[] = activeVariants.map((v) => {
    let optionValues: Record<string, string | number | boolean> = {};
    const optionItems: VariantOptionItem[] = [];

    if (v.optionValues && typeof v.optionValues === 'object') {
      if (Array.isArray(v.optionValues)) {
        for (const item of v.optionValues as VariantOptionItem[]) {
          if (item && item.code) {
            optionValues[item.code] = item.value;
            optionItems.push(item);
          }
        }
      } else {
        optionValues = v.optionValues as Record<string, string | number | boolean>;
        for (const [optCode, optVal] of Object.entries(optionValues)) {
          optionItems.push({ code: optCode, value: optVal });
        }
      }
    }

    const vStock = typeof v.stock === 'number' ? v.stock : 0;
    const vImages = Array.isArray(v.images) ? (v.images as CatalogImage[]) : [];

    return {
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      title: v.title,
      price: createMoneySnapshot(v.price),
      stock: vStock,
      inStock: vStock > 0,
      isActive: true,
      color: v.color || null,
      size: v.size || null,
      optionValues,
      optionItems,
      optionHash: v.optionHash || null,
      specOverrides: (v.specOverrides as Record<string, SpecValue>) || null,
      images: vImages,
      warrantyConfig: v.warrantyConfig,
      serializationRequired: Boolean(v.serializationRequired),
    };
  });

  // Active sources only (exclude pending, discovery, revoked)
  const sources: EvidenceRef[] = (p.dataSources || [])
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      publisher: s.publisher,
      url: s.url,
      licenseDecision: s.licenseDecision,
      version: s.version,
      isSynthetic: s.isSynthetic,
      checksum: s.checksum,
    }));

  const ratingCount = p.reviews ? p.reviews.length : 0;
  const avgRating =
    ratingCount > 0 && p.reviews
      ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
      : undefined;

  const images: CatalogImage[] = Array.isArray(p.images) ? (p.images as CatalogImage[]) : [];

  return {
    id: p.id,
    name: p.name,
    slug: p.slug || p.id,
    description: p.description,
    image: p.image,
    brand,
    category,
    kind,
    segment,
    specs: specsDto,
    variants,
    images,
    sources,
    price: basePriceSnapshot,
    effectivePrice: effectivePriceSnapshot,
    priceRange: pricing.priceRange,
    totalStock: pricing.totalStock,
    inStock: pricing.inStock,
    inventoryMode,
    legacy: isLegacy,
    catalogVersion,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    avgRating,
    reviewCount: ratingCount,
  };
}

export function buildProductComparisonMatrix(
  products: ProductDetailDto[],
  categorySchema?: CategorySpecSchema | null
): ProductComparisonMatrixDto {
  if (products.length === 0) {
    return {
      products: [],
      specRows: [],
      compatibleCategory: true,
    };
  }

  const firstCatId = products[0].category.id;
  const compatibleCategory = products.every((p) => p.category.id === firstCatId);

  // Determine list of spec codes to compare
  const specCodesSet = new Set<string>();
  const specDefMap = new Map((categorySchema?.definitions || []).map((d) => [d.code, d]));

  if (categorySchema?.definitions) {
    for (const d of categorySchema.definitions) {
      specCodesSet.add(d.code);
    }
  }

  for (const prod of products) {
    if (prod.specs?.items) {
      for (const item of prod.specs.items) {
        specCodesSet.add(item.code);
      }
    }
  }

  const specRows: ComparisonSpecRow[] = [];

  for (const code of specCodesSet) {
    const def = specDefMap.get(code);
    const label = def?.label || code;
    const unit = def?.unit || null;
    const comparable = def?.comparable ?? true;

    const values = products.map((prod) => {
      const specItem = prod.specs?.byCode[code];
      return {
        productId: prod.id,
        productName: prod.name,
        state: specItem?.state || ('UNKNOWN' as const),
        value: specItem?.value,
        formatted: specItem?.formatted || 'Chưa xác định',
      };
    });

    const firstVal = values[0];
    const hasDifference = values.some(
      (v) => v.state !== firstVal.state || v.value !== firstVal.value
    );

    specRows.push({
      code,
      label,
      unit,
      comparable,
      values,
      hasDifference,
    });
  }

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      brandName: p.brand?.name,
      effectivePrice: p.effectivePrice,
      inStock: p.inStock,
    })),
    specRows,
    compatibleCategory,
  };
}

export async function getProductDetailDto(
  id: string,
  db = prisma
): Promise<ProductDetailDto | null> {
  try {
    const raw = await db.product.findUnique({
      where: { id },
      include: {
        brand: {
          select: { id: true, name: true, slug: true },
        },
        categoryRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            kind: true,
            specSchema: true,
            specSchemaVersion: true,
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
      },
    });

    if (!raw || !raw.isActive) {
      return null;
    }

    const activeSources = await db.dataSource.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        sourceType: true,
        status: true,
        publisher: true,
        url: true,
        license: true,
        version: true,
        isSynthetic: true,
        checksum: true,
        payload: true,
      },
    });

    const productSources = activeSources
      .filter((s) => {
        if (!s.payload || typeof s.payload !== 'object') return false;
        const mapping = (s.payload as Record<string, unknown>).mapping;
        if (!mapping || typeof mapping !== 'object') return false;
        return (mapping as Record<string, unknown>).productId === raw.id;
      })
      .map((s) => ({
        id: s.id,
        sourceType: s.sourceType,
        status: s.status,
        publisher: s.publisher,
        url: s.url || '',
        licenseDecision: s.license || undefined,
        version: s.version || undefined,
        isSynthetic: s.isSynthetic,
        checksum: s.checksum || undefined,
      }));

    const cacheKey = buildProductDetailCacheKey(raw.id, {
      catalogVersion: raw.catalogVersion,
      categorySchemaVersion: raw.categoryRef?.specSchemaVersion,
      sourceRevision: productSources[0]?.version || 'v1',
    });

    const cached = await redis.get<ProductDetailDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const dto = mapToProductDetailDto(
      { ...raw, dataSources: productSources } as unknown as Record<string, unknown>,
      {
        categorySchema: raw.categoryRef?.specSchema as CategorySpecSchema | null,
      }
    );

    await redis.set(cacheKey, dto, { ex: 120 });
    return dto;
  } catch (error) {
    console.error('getProductDetailDto error:', error);
    return null;
  }
}
