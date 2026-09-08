import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ProductGrid } from '@/components/product/ProductGrid';
import type { Product } from '@/types';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams?: Promise<{ category?: string; search?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const currentCategory = resolvedSearchParams?.category?.trim() || null;
  const searchQuery = resolvedSearchParams?.search?.trim() || null;

  let products: Product[] = [];
  let allCategories: string[] = [];

  try {
    const rawCategories = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });
    allCategories = rawCategories
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
      },
      orderBy: { createdAt: 'desc' },
    });

    products = rawProducts.map((p) => {
      const reviewCount = p.reviews?.length || 0;
      const avgRating =
        reviewCount > 0
          ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1))
          : 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { reviews: _revs, ...rest } = p;
      return {
        ...rest,
        avgRating,
        reviewCount,
      };
    });
  } catch (err) {
    console.warn('Database not reachable at render time, displaying empty product list:', err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 md:p-12 mb-8 text-white shadow-sm">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Chào mừng đến ShopQR 🛒</h1>
        <p className="text-blue-100 text-lg md:text-xl mb-6">
          Mua sắm tiện lợi, tự động tạo mã VietQR thanh toán tức thì
        </p>
        <div className="flex gap-2.5 flex-wrap text-xs md:text-sm font-medium">
          <span className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
            ✨ Tự sinh mã VietQR theo từng đơn
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
            💬 Chat trực tiếp người mua & người bán
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
            🔐 Xác thực OTP Email an toàn
          </span>
        </div>
      </div>

      {allCategories.length > 0 && (
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 items-center">
          <Link
            href="/"
            className={`px-5 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
              !currentCategory
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Tất cả
          </Link>
          {allCategories.map((cat) => {
            const isActive = currentCategory === cat;
            return (
              <Link
                key={cat}
                href={`/?category=${encodeURIComponent(cat)}`}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {cat}
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {currentCategory ? `Danh mục: ${currentCategory}` : 'Sản phẩm nổi bật'}
          </h2>
          {searchQuery && (
            <p className="text-sm text-gray-500 mt-1">Kết quả tìm kiếm cho: &quot;{searchQuery}&quot;</p>
          )}
        </div>
        <span className="text-sm text-gray-500">{products.length} sản phẩm</span>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Không tìm thấy sản phẩm nào</h3>
          <p className="text-gray-500 mb-6">Hãy thử tìm kiếm với từ khóa khác hoặc quay lại danh mục đầy đủ.</p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Xem tất cả sản phẩm
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
