import { cache } from 'react';
import { prisma } from '@server/database/prisma';
import { redis } from '@server/infrastructure/redis';
import { serializeMoneyVnd } from '@shared/utils/money';
import type { Product } from '@/types';
import {
  queryCatalog,
  resolveProductPricing,
  normalizeCatalogQuery,
} from './catalog-query.service.ts';
import {
  getProductDetailDto,
  mapToProductDetailDto,
  buildProductComparisonMatrix,
  buildProductDetailCacheKey,
} from './product-detail-dto.service.ts';
import type { CategorySpecSchema } from '@shared/types/catalog.ts';

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc';

export {
  queryCatalog,
  resolveProductPricing,
  normalizeCatalogQuery,
  getProductDetailDto,
  mapToProductDetailDto,
  buildProductComparisonMatrix,
  buildProductDetailCacheKey,
};

export class CatalogService {
  /**
   * Lấy danh sách sản phẩm và danh mục cho trang chủ (có Redis Caching cho categories)
   * Hỗ trợ phân trang + sắp xếp server-side để tránh render toàn bộ catalog
   */
  static async getHomeCatalog(
    params?: {
      category?: string | null;
      search?: string | null;
      page?: number;
      limit?: number;
      sort?: CatalogSort;
    },
    db: typeof prisma = prisma
  ): Promise<{
    products: Product[];
    allCategories: string[];
    total: number;
    page: number;
    limit: number;
  }> {
    const currentCategory = params?.category?.trim() || null;
    const searchQuery = params?.search?.trim() || null;
    const limit = Math.min(Math.max(params?.limit ?? 12, 1), 48);
    const page = Math.max(params?.page ?? 1, 1);
    const sort: CatalogSort = params?.sort ?? 'newest';

    const orderBy: Record<string, 'asc' | 'desc'> =
      sort === 'price-asc'
        ? { price: 'asc' }
        : sort === 'price-desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const where = {
      isActive: true,
      ...(currentCategory ? { category: currentCategory } : {}),
      ...(searchQuery
        ? {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' as const } },
              { description: { contains: searchQuery, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    try {
      // 1. Tối ưu hóa Categories bằng Redis Cache (TTL 10 phút)
      let allCategories: string[] | null = await redis.get<string[]>('cache:categories');
      if (!allCategories || !Array.isArray(allCategories)) {
        const rawCategories = await db.product.findMany({
          where: { isActive: true },
          select: { category: true },
          distinct: ['category'],
        });
        allCategories = rawCategories
          .map((c) => c.category)
          .filter((c): c is string => Boolean(c));
        await redis.set('cache:categories', allCategories, { ex: 600 });
      }

      const [rawProducts, total] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            reviews: {
              where: { isApproved: true },
              select: { rating: true },
            },
            variants: {
              where: { isActive: true },
            },
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.product.count({ where }),
      ]);

      let products: Product[] = rawProducts.map((p) => {
        const ratingCount = p.reviews.length;
        const avgRating =
          ratingCount > 0
            ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
            : undefined;

        const pricing = resolveProductPricing({
          price: p.price,
          stock: p.stock,
          inventoryMode: p.inventoryMode,
          variants: p.variants,
        });

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: pricing.price,
          effectivePrice: pricing.effectivePrice,
          priceRange: pricing.priceRange,
          image: p.image,
          category: p.category,
          stock: pricing.totalStock,
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          avgRating,
          reviewCount: ratingCount,
          variants: p.variants.map((v) => ({
            id: v.id,
            productId: v.productId,
            sku: v.sku,
            title: v.title,
            color: v.color,
            size: v.size,
            price: serializeMoneyVnd(BigInt(v.price)),
            stock: v.stock,
            image: v.image,
            isActive: v.isActive,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        };
      });

      if (sort === 'price-asc') {
        products = products.sort((a, b) => {
          const pa = BigInt(a.effectivePrice || a.price);
          const pb = BigInt(b.effectivePrice || b.price);
          return pa < pb ? -1 : pa > pb ? 1 : 0;
        });
      } else if (sort === 'price-desc') {
        products = products.sort((a, b) => {
          const pa = BigInt(a.effectivePrice || a.price);
          const pb = BigInt(b.effectivePrice || b.price);
          return pa > pb ? -1 : pa < pb ? 1 : 0;
        });
      }

      return { products, allCategories, total, page, limit };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[CatalogService] Không thể kết nối cơ sở dữ liệu (PostgreSQL). Vui lòng đảm bảo dịch vụ PostgreSQL đang chạy:',
          error instanceof Error ? error.message : error
        );
      } else {
        console.error('CatalogService.getHomeCatalog error:', error);
      }
      return { products: [], allCategories: [], total: 0, page: 1, limit };
    }
  }

  /**
   * Lấy chi tiết sản phẩm kèm biến thể (variants)
   * Tối ưu hóa: React.cache() chống duplicate query trong Server Components
   * kết hợp Redis Cache (TTL 120s)
   */
  static getProductDetail = cache(async (id: string): Promise<Product | null> => {
    try {
      const fallbackCacheKey = `cache:product:${id}`;
      const cachedFallback = await redis.get<Product>(fallbackCacheKey);
      if (cachedFallback) {
        return cachedFallback;
      }

      const [product, activeSources] = await Promise.all([
        prisma.product.findUnique({
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
        }),
        prisma.dataSource.findMany({
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
        }),
      ]);

      if (!product || !product.isActive) {
        return null;
      }

      const productSources = activeSources
        .filter((s) => {
          if (!s.payload || typeof s.payload !== 'object') return false;
          const mapping = (s.payload as Record<string, unknown>).mapping;
          if (!mapping || typeof mapping !== 'object') return false;
          return (mapping as Record<string, unknown>).productId === product.id;
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

      const cacheKey = buildProductDetailCacheKey(product.id, {
        catalogVersion: product.catalogVersion,
        categorySchemaVersion: product.categoryRef?.specSchemaVersion,
        sourceRevision: productSources[0]?.version || 'v1',
      });

      const cachedRevision = await redis.get<Product>(cacheKey);
      if (cachedRevision) {
        return cachedRevision;
      }

      const detailDto = mapToProductDetailDto(
        { ...product, dataSources: productSources } as unknown as Record<string, unknown>,
        {
          categorySchema: product.categoryRef?.specSchema as CategorySpecSchema | null,
        }
      );

      const result: Product = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: detailDto.price.amount,
        effectivePrice: detailDto.effectivePrice.amount,
        priceRange: detailDto.priceRange,
        image: product.image,
        category: product.category,
        stock: detailDto.totalStock,
        isActive: product.isActive,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        brand: detailDto.brand,
        categoryRef: detailDto.category,
        sources: detailDto.sources,
        detail: detailDto,
        specs: detailDto.specs,
        variants: detailDto.variants.map((v) => ({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          title: v.title,
          color: v.color,
          size: v.size,
          price: v.price.amount,
          stock: v.stock,
          image: v.images[0]?.url || product.image,
          isActive: v.isActive,
          optionValues: v.optionValues,
          optionHash: v.optionHash,
          specOverrides: v.specOverrides,
          images: v.images,
          warrantyConfig: v.warrantyConfig,
          serializationRequired: v.serializationRequired,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
        })),
      };

      await redis.set(cacheKey, result, { ex: 120 });
      await redis.set(fallbackCacheKey, result, { ex: 120 });
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[CatalogService] getProductDetail: Không thể kết nối cơ sở dữ liệu:',
          error instanceof Error ? error.message : error
        );
      } else {
        console.error('CatalogService.getProductDetail error:', error);
      }
      return null;
    }
  });
}
