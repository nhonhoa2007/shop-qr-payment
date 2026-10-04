'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductGrid } from '@client/components/product/ProductGrid';
import { HeroFloatingConstellation } from '@client/components/home/HeroFloatingConstellation';
import type { Product } from '@shared/types';
import { Search, ChevronRight, ArrowRight, ArrowDownWideNarrow } from 'lucide-react';

export type HomeCatalogSort = 'newest' | 'price-asc' | 'price-desc';

export interface HomeViewProps {
  products: Product[];
  allCategories: string[];
  currentCategory: string | null;
  searchQuery: string | null;
  total: number;
  page: number;
  pageSize: number;
  currentSort: HomeCatalogSort;
}

function buildCatalogUrl(params: {
  category: string | null;
  search: string | null;
  sort: HomeCatalogSort;
  page: number;
}): string {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.sort !== 'newest') query.set('sort', params.sort);
  if (params.page > 1) query.set('page', String(params.page));
  const qs = query.toString();
  return qs ? `/?${qs}` : '/';
}

export function HomeView({
  products,
  allCategories,
  currentCategory,
  searchQuery,
  total,
  page,
  pageSize,
  currentSort,
}: HomeViewProps) {
  const router = useRouter();
  const shownCount = Math.min((page - 1) * pageSize + products.length, total);
  const hasMore = shownCount < total;

  const handleSortChange = (sort: HomeCatalogSort) => {
    router.push(
      buildCatalogUrl({ category: currentCategory, search: searchQuery, sort, page: 1 })
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-16">
      {/* Hero Section — Floating constellation on canvas mist */}
      {!currentCategory && !searchQuery && (
        <section className="text-center pt-2 pb-4">
          {/* 3D Interactive Floating Constellation & Dynamic Wordmark */}
          <HeroFloatingConstellation products={products} />

          <p className="text-muted-gray text-base sm:text-lg max-w-md mx-auto mb-8 tracking-[-0.031em] leading-relaxed">
            Khám phá những món đồ tuyển chọn. Tự động sinh mã VietQR thanh toán tức thì.
          </p>

          {/* Hero Search Bar — 9999px radius with violet submit */}
          <form action="/" method="GET" className="max-w-xl mx-auto mb-10">
            <div className="relative flex items-center bg-white rounded-full border border-ink-black/10 shadow-soft-sm pl-5 pr-1.5 py-1.5 transition focus-within:border-shop-violet/50">
              <Search className="w-5 h-5 text-muted-gray mr-3 shrink-0" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery || ''}
                placeholder="Bạn đang tìm sản phẩm nào hôm nay?"
                className="w-full bg-transparent text-sm sm:text-base tracking-[-0.031em] text-ink-black placeholder:text-muted-gray focus:outline-none"
              />
              <button
                type="submit"
                className="w-11 h-11 rounded-full bg-shop-violet text-white flex items-center justify-center hover:bg-shop-violet-deep transition shadow-violet shrink-0 ml-2"
                aria-label="Tìm kiếm"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>

          {/* Category Pills Row */}
          {allCategories.length > 0 && (
            <div className="flex justify-center flex-wrap gap-2 pt-2">
              <Link
                href="/"
                className="px-4 py-2 rounded-full text-xs font-medium tracking-[-0.017em] transition bg-ink-black text-white"
              >
                Tất cả
              </Link>
              {allCategories.map((cat) => (
                <Link
                  key={cat}
                  href={`/?category=${encodeURIComponent(cat)}`}
                  className="px-4 py-2 rounded-full text-xs font-medium tracking-[-0.017em] transition bg-white border border-faint-border text-ink-black hover:border-ink-black/40 shadow-soft-sm"
                >
                  {cat}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* When filtering by category or search */}
      {(currentCategory || searchQuery) && (
        <section className="pt-2">
          {/* Breadcrumb / Active filters */}
          <div className="flex items-center gap-2 text-xs text-muted-gray mb-6">
            <Link href="/" className="hover:text-ink-black transition">
              Khám phá
            </Link>
            <span>/</span>
            <span className="text-ink-black font-medium">
              {currentCategory ? `Danh mục: ${currentCategory}` : `Tìm kiếm: "${searchQuery}"`}
            </span>
          </div>

          {/* Category Chips Bar */}
          {allCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 items-center mb-8">
              <Link
                href="/"
                className={`px-4 py-2 rounded-full text-xs font-medium transition whitespace-nowrap ${
                  !currentCategory
                    ? 'bg-ink-black text-white'
                    : 'bg-white border border-faint-border text-ink-black hover:border-ink-black/40 shadow-soft-sm'
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
                    className={`px-4 py-2 rounded-full text-xs font-medium transition whitespace-nowrap ${
                      isActive
                        ? 'bg-ink-black text-white'
                        : 'bg-white border border-faint-border text-ink-black hover:border-ink-black/40 shadow-soft-sm'
                    }`}
                  >
                    {cat}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Main Catalog Grid */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.05em] text-ink-black">
              {currentCategory || (searchQuery ? 'Kết quả tìm kiếm' : 'Sản phẩm mới nhất')}
            </h2>
            <ChevronRight className="w-5 h-5 text-ink-black" />
          </div>

          <div className="flex items-center gap-3">
            {/* Sort selector */}
            <label className="flex items-center gap-1.5 text-xs text-muted-gray tracking-[-0.017em]">
              <ArrowDownWideNarrow className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only">Sắp xếp sản phẩm</span>
              <select
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value as HomeCatalogSort)}
                className="bg-white border border-faint-border rounded-full px-3 py-1.5 text-xs font-medium text-ink-black cursor-pointer focus:outline-none focus:border-shop-violet/50"
              >
                <option value="newest">Mới nhất</option>
                <option value="price-asc">Giá thấp → cao</option>
                <option value="price-desc">Giá cao → thấp</option>
              </select>
            </label>

            <span className="text-xs text-muted-gray tracking-[-0.017em] whitespace-nowrap">
              {total > 0 ? `Hiển thị ${shownCount}/${total} sản phẩm` : '0 sản phẩm'}
            </span>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-[28px] p-16 text-center shadow-card">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-semibold text-ink-black tracking-[-0.014em] mb-1">
              Không tìm thấy sản phẩm nào
            </h3>
            <p className="text-sm text-muted-gray mb-6 tracking-[-0.014em]">
              Hãy thử tìm kiếm từ khóa khác hoặc bấm xem tất cả sản phẩm.
            </p>
            <Link
              href="/"
              className="inline-block bg-ink-black text-white text-xs font-medium px-5 py-2.5 rounded-full hover:bg-slate-ink transition"
            >
              Xem tất cả
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Link
              href={buildCatalogUrl({
                category: currentCategory,
                search: searchQuery,
                sort: currentSort,
                page: page + 1,
              })}
              className="inline-flex items-center gap-2 bg-white border border-faint-border text-ink-black text-sm font-medium px-6 py-3 rounded-full hover:border-ink-black/40 shadow-soft-sm transition tracking-[-0.014em]"
            >
              <span>Xem thêm {Math.min(pageSize, total - shownCount)} sản phẩm</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export default HomeView;
