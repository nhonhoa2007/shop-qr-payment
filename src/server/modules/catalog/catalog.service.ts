import { prisma } from '@/server/database/prisma';
import type { Product } from '@/types';

export class CatalogService {
  /**
   * Lấy danh sách sản phẩm và danh mục cho trang chủ
   */
  static async getHomeCatalog(params?: {
    category?: string | null;
    search?: string | null;
  }): Promise<{ products: Product[]; allCategories: string[] }> {
    const currentCategory = params?.category?.trim() || null;
    const searchQuery = params?.search?.trim() || null;

    try {
      const rawCategories = await prisma.product.findMany({
        where: { isActive: true },
        select: { category: true },
        distinct: ['category'],
      });
      const allCategories = rawCategories
        .map((c) => c.category)
        .filter((c): c is string => Boolean(c));

      const rawProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          ...(currentCategory ? { category: currentCategory } : {}),
          ...(searchQuery
            ? {
                OR: [
                  { name: { contains: searchQuery, mode: 'insensitive' } },
                  { description: { contains: searchQuery, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          reviews: {
            select: { rating: true },
          },
          variants: {
            where: { isActive: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

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

      return { products, allCategories };
    } catch (error) {
      console.error('CatalogService.getHomeCatalog error:', error);
      return { products: [], allCategories: [] };
    }
  }

  /**
   * Lấy chi tiết sản phẩm kèm biến thể (variants)
   */
  static async getProductDetail(id: string): Promise<Product | null> {
    try {
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

      return {
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
    } catch (error) {
      console.error('CatalogService.getProductDetail error:', error);
      return null;
    }
  }
}
