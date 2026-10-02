import { cache } from 'react';
import { prisma } from '@server/database/prisma';
import { redis } from '@server/infrastructure/redis';
import type { Product } from '@/types';

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc';

export class CatalogService {
  /**
   * Lấy danh sách sản phẩm và danh mục cho trang chủ (có Redis Caching cho categories)
   * Hỗ trợ phân trang + sắp xếp server-side để tránh render toàn bộ catalog
   */
  static async getHomeCatalog(params?: {
    category?: string | null;
    search?: string | null;
    page?: number;
    limit?: number;
    sort?: CatalogSort;
  }): Promise<{
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
        const rawCategories = await prisma.product.findMany({
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
        prisma.product.findMany({
          where,
          include: {
            reviews: {
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
        prisma.product.count({ where }),
      ]);

      const products: Product[] = rawProducts.map((p) => {
        const ratingCount = p.reviews.length;
        const avgRating =
          ratingCount > 0
            ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
            : undefined;

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image,
          category: p.category,
          stock: p.stock,
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
            price: v.price,
            stock: v.stock,
            image: v.image,
            isActive: v.isActive,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        };
      });

      return { products, allCategories, total, page, limit };
    } catch (error) {
      console.error('CatalogService.getHomeCatalog error:', error);
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
      const cacheKey = `cache:product:${id}`;
      const cached = await redis.get<Product>(cacheKey);
      if (cached) {
        return cached;
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!product || !product.isActive) {
        return null;
      }

      const result: Product = {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.image,
        category: product.category,
        stock: product.stock,
        isActive: product.isActive,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        variants: product.variants.map((v) => ({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          title: v.title,
          color: v.color,
          size: v.size,
          price: v.price,
          stock: v.stock,
          image: v.image,
          isActive: v.isActive,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        })),
      };

      await redis.set(cacheKey, result, { ex: 120 });
      return result;
    } catch (error) {
      console.error('CatalogService.getProductDetail error:', error);
      return null;
    }
  });
}
