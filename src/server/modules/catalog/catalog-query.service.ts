import { prisma } from '@server/database/prisma.ts';
import { redis } from '@server/infrastructure/redis.ts';
import { serializeMoneyVnd, parseMoneyVnd } from '@shared/utils/money.ts';
import type {
  CatalogQuery,
  NormalizedCatalogQuery,
  CatalogItemDto,
  PaginatedCatalogResponse,
  CatalogSort,
  PriceRangeDto,
} from '@shared/types/catalog-query.ts';
import { ALLOWLISTED_SPEC_CODES } from '@shared/types/catalog-query.ts';
import type { ProductKind, ProductSegment, ProductSpecs } from '@shared/types/catalog.ts';
import type { InventoryMode } from '@shared/types/inventory.ts';
import type { MoneyVnd } from '@shared/types/money.ts';

export interface CatalogQueryDb {
  findManyProducts: (params: {
    category?: string;
    brand?: string[];
    segment?: ProductSegment[];
    search?: string;
    minPrice?: bigint;
    maxPrice?: bigint;
    inStock?: boolean;
    specs?: Record<string, string[]>;
    page: number;
    limit: number;
    sort: CatalogSort;
  }) => Promise<{
    items: unknown[];
    total: number;
  }>;
}

export interface ResolvedPricing {
  price: MoneyVnd;
  effectivePrice: MoneyVnd;
  priceRange: PriceRangeDto;
  totalStock: number;
  inStock: boolean;
}

/**
 * Calculates effective SKU display price, price range, and available stock.
 * For VARIANT products, effective price is the minimum price among active variants.
 * For BASE/LEGACY products, effective price is the product's base price.
 * All computations use BigInt arithmetic to avoid floating-point inaccuracies.
 */
export function resolveProductPricing(product: {
  price: bigint | number;
  stock?: number;
  inventoryMode?: string | null;
  variants?: Array<{
    price: bigint | number;
    stock?: number;
    isActive?: boolean;
  }>;
}): ResolvedPricing {
  const basePriceBi = typeof product.price === 'bigint' ? product.price : BigInt(product.price || 0);
  const isVariantMode = product.inventoryMode === 'VARIANT';
  const activeVariants = (product.variants || []).filter((v) => v.isActive !== false);

  if (!isVariantMode || activeVariants.length === 0) {
    const totalStock = typeof product.stock === 'number' ? product.stock : 0;
    const serializedBase = serializeMoneyVnd(basePriceBi);
    return {
      price: serializedBase,
      effectivePrice: serializedBase,
      priceRange: { min: serializedBase, max: serializedBase },
      totalStock,
      inStock: totalStock > 0,
    };
  }

  let minPrice =
    typeof activeVariants[0].price === 'bigint'
      ? activeVariants[0].price
      : BigInt(activeVariants[0].price);
  let maxPrice = minPrice;
  let totalVariantStock = 0;

  for (const v of activeVariants) {
    const vPrice = typeof v.price === 'bigint' ? v.price : BigInt(v.price);
    if (vPrice < minPrice) minPrice = vPrice;
    if (vPrice > maxPrice) maxPrice = vPrice;
    totalVariantStock += (v.stock || 0);
  }

  return {
    price: serializeMoneyVnd(basePriceBi),
    effectivePrice: serializeMoneyVnd(minPrice),
    priceRange: {
      min: serializeMoneyVnd(minPrice),
      max: serializeMoneyVnd(maxPrice),
    },
    totalStock: totalVariantStock,
    inStock: totalVariantStock > 0,
  };
}

/**
 * Normalizes and sanitizes user catalog query inputs.
 * Enforces boundaries on pagination, allowlisted spec codes, and BigInt prices.
 */
export function normalizeCatalogQuery(
  raw: CatalogQuery,
  customAllowedSpecCodes?: Set<string>
): NormalizedCatalogQuery {
  // Page clamping: min 1
  const rawPage = raw.page;
  let page = 1;
  if (typeof rawPage === 'number' && Number.isFinite(rawPage)) {
    page = Math.max(1, Math.floor(rawPage));
  }

  // Limit clamping: default 12, max 48, min 1
  const rawLimit = raw.limit;
  let limit = 12;
  if (typeof rawLimit === 'number' && Number.isFinite(rawLimit)) {
    limit = Math.min(48, Math.max(1, Math.floor(rawLimit)));
  }

  // Sort whitelist
  let sort: CatalogSort = 'newest';
  if (raw.sort === 'price-asc' || raw.sort === 'price-desc' || raw.sort === 'newest') {
    sort = raw.sort;
  }

  // Search query
  const search =
    typeof raw.search === 'string' && raw.search.trim().length > 0
      ? raw.search.trim()
      : undefined;

  // Category
  const category =
    typeof raw.category === 'string' && raw.category.trim().length > 0
      ? raw.category.trim()
      : undefined;

  // Brand array
  let brand: string[] | undefined;
  if (Array.isArray(raw.brand)) {
    const cleaned = raw.brand
      .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
      .map((b) => b.trim());
    if (cleaned.length > 0) brand = cleaned;
  }

  // Segment array
  let segment: ProductSegment[] | undefined;
  if (Array.isArray(raw.segment)) {
    const VALID_SEGMENTS = new Set(['BUDGET', 'MID_RANGE', 'PREMIUM', 'FLAGSHIP']);
    const cleaned = raw.segment.filter((s): s is ProductSegment => VALID_SEGMENTS.has(s));
    if (cleaned.length > 0) segment = cleaned;
  }

  // Prices: minPrice & maxPrice
  let minPrice: bigint | undefined;
  if (raw.minPrice !== undefined && raw.minPrice !== null && raw.minPrice !== '') {
    minPrice = parseMoneyVnd(raw.minPrice, 'minPrice');
  }

  let maxPrice: bigint | undefined;
  if (raw.maxPrice !== undefined && raw.maxPrice !== null && raw.maxPrice !== '') {
    maxPrice = parseMoneyVnd(raw.maxPrice, 'maxPrice');
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new Error('minPrice cannot be greater than maxPrice');
  }

  // inStock filter
  const inStock = typeof raw.inStock === 'boolean' ? raw.inStock : undefined;

  // Allowlisted JSON Specs filter
  let specs: Record<string, string[]> | undefined;
  if (raw.specs && typeof raw.specs === 'object' && !Array.isArray(raw.specs)) {
    specs = {};
    const allowedCodes = customAllowedSpecCodes || ALLOWLISTED_SPEC_CODES;
    for (const [code, values] of Object.entries(raw.specs)) {
      if (!/^[a-z0-9_]{2,64}$/.test(code) || !allowedCodes.has(code)) {
        throw new Error(`Invalid or unallowlisted spec code: "${code}"`);
      }
      if (!Array.isArray(values)) {
        throw new Error(`Filter values for spec "${code}" must be an array`);
      }
      const cleanedValues = values
        .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
        .filter((v) => v.length > 0);

      if (cleanedValues.length === 0) {
        throw new Error(`Filter for spec "${code}" must contain at least one valid value`);
      }

      specs[code] = cleanedValues;
    }
    if (Object.keys(specs).length === 0) specs = undefined;
  }

  return {
    search,
    category,
    brand,
    segment,
    minPrice,
    maxPrice,
    inStock,
    specs,
    page,
    limit,
    sort,
  };
}

/**
 * Builds a deterministic Redis cache key for catalog queries.
 */
export function buildCatalogQueryCacheKey(query: NormalizedCatalogQuery): string {
  const parts: string[] = ['cache:catalog-query'];
  if (query.category) parts.push(`cat:${query.category}`);
  if (query.search) parts.push(`q:${encodeURIComponent(query.search)}`);
  if (query.brand && query.brand.length > 0) parts.push(`br:${[...query.brand].sort().join(',')}`);
  if (query.segment && query.segment.length > 0) parts.push(`seg:${[...query.segment].sort().join(',')}`);
  if (query.minPrice !== undefined) parts.push(`min:${query.minPrice.toString()}`);
  if (query.maxPrice !== undefined) parts.push(`max:${query.maxPrice.toString()}`);
  if (query.inStock !== undefined) parts.push(`stock:${query.inStock}`);
  if (query.specs && Object.keys(query.specs).length > 0) {
    const sortedSpecs = Object.keys(query.specs)
      .sort()
      .map((k) => `${k}=${[...query.specs![k]].sort().join('|')}`)
      .join('&');
    parts.push(`specs:${sortedSpecs}`);
  }
  parts.push(`p:${query.page}:l:${query.limit}:s:${query.sort}`);
  return parts.join(':');
}

/**
 * Transforms raw database product record to CatalogItemDto.
 */
export function mapToCatalogItemDto(rawProduct: Record<string, unknown>): CatalogItemDto {
  const p = rawProduct as {
    id: string;
    name: string;
    slug?: string;
    description: string | null;
    image: string | null;
    price: bigint | number;
    stock: number;
    isActive: boolean;
    inventoryMode: InventoryMode;
    kind: ProductKind;
    segment: ProductSegment | null;
    specs: ProductSpecs | null;
    createdAt: Date | string;
    brand?: { id: string; name: string; slug: string } | null;
    categoryRef?: { id: string; name: string; slug: string; kind: ProductKind } | null;
    variants?: Array<{ price: bigint | number; stock?: number; isActive?: boolean }>;
    reviews?: Array<{ rating: number }>;
  };

  const pricing = resolveProductPricing({
    price: p.price,
    stock: p.stock,
    inventoryMode: p.inventoryMode,
    variants: p.variants,
  });

  const ratingCount = p.reviews ? p.reviews.length : 0;
  const avgRating =
    ratingCount > 0 && p.reviews
      ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
      : undefined;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug || p.id,
    description: p.description,
    image: p.image,
    brand: p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug } : null,
    category: p.categoryRef
      ? {
          id: p.categoryRef.id,
          name: p.categoryRef.name,
          slug: p.categoryRef.slug,
          kind: p.categoryRef.kind,
        }
      : null,
    kind: p.kind,
    segment: p.segment,
    price: pricing.price,
    effectivePrice: pricing.effectivePrice,
    priceRange: pricing.priceRange,
    totalStock: pricing.totalStock,
    inStock: pricing.inStock,
    inventoryMode: p.inventoryMode,
    specs: p.specs,
    variantCount: p.variants ? p.variants.length : 0,
    isActive: p.isActive,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    avgRating,
    reviewCount: ratingCount,
  };
}

/**
 * Main catalog querying service with allowlisted JSON spec filtering,
 * effective SKU pricing, and Redis caching.
 */
export async function queryCatalog(
  rawQuery: CatalogQuery,
  db?: CatalogQueryDb
): Promise<PaginatedCatalogResponse<CatalogItemDto>> {
  const query = normalizeCatalogQuery(rawQuery);

  // Check Redis Cache if default prisma db is used
  const cacheKey = !db ? buildCatalogQueryCacheKey(query) : null;
  if (cacheKey) {
    const cached = await redis.get<PaginatedCatalogResponse<CatalogItemDto>>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // If a mock DB client is passed (e.g. in unit tests)
  if (db) {
    const result = await db.findManyProducts(query);
    const items = result.items.map((item) => mapToCatalogItemDto(item as Record<string, unknown>));
    const totalPages = Math.ceil(result.total / query.limit) || 1;
    return {
      items,
      total: result.total,
      page: query.page,
      limit: query.limit,
      totalPages,
    };
  }

  // Construct Prisma WHERE clause with allowlisted JSON filtering
  const where: Record<string, unknown> = {
    isActive: true,
  };

  if (query.category) {
    where.OR = [
      { category: query.category },
      { categoryRef: { slug: query.category } },
      { categoryId: query.category },
    ];
  }

  if (query.brand && query.brand.length > 0) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { brandId: { in: query.brand } },
          { brand: { slug: { in: query.brand } } },
        ],
      },
    ];
  }

  if (query.segment && query.segment.length > 0) {
    where.segment = { in: query.segment };
  }

  if (query.search) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  if (query.inStock) {
    where.stock = { gt: 0 };
  }

  // Min / Max price boundary filter
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          {
            inventoryMode: 'BASE',
            ...(query.minPrice !== undefined ? { price: { gte: query.minPrice } } : {}),
            ...(query.maxPrice !== undefined ? { price: { lte: query.maxPrice } } : {}),
          },
          {
            inventoryMode: 'VARIANT',
            variants: {
              some: {
                isActive: true,
                ...(query.minPrice !== undefined ? { price: { gte: query.minPrice } } : {}),
                ...(query.maxPrice !== undefined ? { price: { lte: query.maxPrice } } : {}),
              },
            },
          },
        ],
      },
    ];
  }

  // Allowlisted JSONB specs filter
  if (query.specs && Object.keys(query.specs).length > 0) {
    const specConditions = Object.entries(query.specs).map(([code, values]) => {
      const orClauses = values.flatMap((val) => [
        {
          specs: {
            path: ['attributes', code, 'value'],
            equals: val,
          },
        },
        ...(!isNaN(Number(val))
          ? [
              {
                specs: {
                  path: ['attributes', code, 'value'],
                  equals: Number(val),
                },
              },
            ]
          : []),
      ]);

      return {
        AND: [
          {
            specs: {
              path: ['attributes', code, 'state'],
              equals: 'KNOWN',
            },
          },
          { OR: orClauses },
        ],
      };
    });

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      ...specConditions,
    ];
  }

  // Sorting
  const orderBy: Record<string, 'asc' | 'desc'> =
    query.sort === 'price-asc'
      ? { price: 'asc' }
      : query.sort === 'price-desc'
        ? { price: 'desc' }
        : { createdAt: 'desc' };

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        brand: {
          select: { id: true, name: true, slug: true },
        },
        categoryRef: {
          select: { id: true, name: true, slug: true, kind: true },
        },
        variants: {
          where: { isActive: true },
          select: { id: true, price: true, stock: true, isActive: true },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
      },
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.product.count({ where }),
  ]);

  let items = rawProducts.map((p) => mapToCatalogItemDto(p as unknown as Record<string, unknown>));

  // If sorting by price, refine order by effective display price
  if (query.sort === 'price-asc') {
    items = items.sort((a, b) => {
      const pa = BigInt(a.effectivePrice);
      const pb = BigInt(b.effectivePrice);
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
  } else if (query.sort === 'price-desc') {
    items = items.sort((a, b) => {
      const pa = BigInt(a.effectivePrice);
      const pb = BigInt(b.effectivePrice);
      return pa > pb ? -1 : pa < pb ? 1 : 0;
    });
  }

  const totalPages = Math.ceil(total / query.limit) || 1;
  const response: PaginatedCatalogResponse<CatalogItemDto> = {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages,
  };

  if (cacheKey) {
    await redis.set(cacheKey, response, { ex: 120 });
  }

  return response;
}
