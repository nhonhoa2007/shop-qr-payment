'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ProductGrid } from '@client/components/product/ProductGrid';
import type { Product } from '@shared/types';
import { Search, ChevronRight, ArrowRight } from 'lucide-react';

export interface HomeViewProps {
  products: Product[];
  allCategories: string[];
  currentCategory: string | null;
  searchQuery: string | null;
}

export function HomeView({
  products,
  allCategories,
  currentCategory,
  searchQuery,
}: HomeViewProps) {
  // Pick top 3 products for the hero floating constellation
  const heroProducts = products.slice(0, 3);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-16">
      {/* Hero Section — Floating constellation on canvas mist */}
      {!currentCategory && !searchQuery && (
        <section className="text-center pt-6 pb-4">
          {/* Floating constellation preview cards */}
          {heroProducts.length > 0 && (
            <div className="flex justify-center items-center gap-4 sm:gap-6 mb-8 overflow-hidden px-4">
              {heroProducts.map((hp, idx) => (
                <div
                  key={hp.id}
                  className={`bg-white rounded-[28px] p-2 shadow-card-custom transition duration-300 hover:shadow-card-hover-custom flex-shrink-0 ${
                    idx === 1 ? 'w-36 sm:w-44 -translate-y-2' : 'w-28 sm:w-36 hidden sm:block opacity-90'
                  }`}
                >
                  <div className="aspect-square relative bg-[#f2f4f5] rounded-[20px] overflow-hidden">
                    {hp.image && (
                      <Image
                        src={hp.image}
                        alt={hp.name}
                        fill
                        sizes="180px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#000000] truncate tracking-[-0.014em] text-left px-1">
                    {hp.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Wordmark shop. */}
          <div className="inline-flex items-center justify-center gap-1 mb-4">
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-[-0.05em] text-[#000000]">
              shop
            </h1>
            <span className="w-3 h-3 rounded-full bg-[#5433eb] mt-5 sm:mt-6" />
          </div>

          <p className="text-[#787574] text-base sm:text-lg max-w-md mx-auto mb-8 tracking-[-0.031em] leading-relaxed">
            Khám phá những món đồ tuyển chọn. Tự động sinh mã VietQR thanh toán tức thì.
          </p>

          {/* Hero Search Bar — 9999px radius with violet submit */}
          <form action="/" method="GET" className="max-w-xl mx-auto mb-10">
            <div className="relative flex items-center bg-white rounded-full border border-[#000000]/10 shadow-soft-sm-custom pl-5 pr-1.5 py-1.5 transition focus-within:border-[#5433eb]/50">
              <Search className="w-5 h-5 text-[#787574] mr-3 shrink-0" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery || ''}
                placeholder="Bạn đang tìm sản phẩm nào hôm nay?"
                className="w-full bg-transparent text-sm sm:text-base tracking-[-0.031em] text-[#000000] placeholder:text-[#787574] focus:outline-none"
              />
              <button
                type="submit"
                className="w-11 h-11 rounded-full bg-[#5433eb] text-white flex items-center justify-center hover:bg-[#4428d4] transition shadow-violet-custom shrink-0 ml-2"
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
                className="px-4 py-2 rounded-full text-xs font-medium tracking-[-0.017em] transition bg-[#000000] text-white"
              >
                Tất cả
              </Link>
              {allCategories.map((cat) => (
                <Link
                  key={cat}
                  href={`/?category=${encodeURIComponent(cat)}`}
                  className="px-4 py-2 rounded-full text-xs font-medium tracking-[-0.017em] transition bg-white border border-[#ebebeb] text-[#000000] hover:border-[#000000]/40 shadow-soft-sm-custom"
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
          <div className="flex items-center gap-2 text-xs text-[#787574] mb-6">
            <Link href="/" className="hover:text-[#000000] transition">
              Khám phá
            </Link>
            <span>/</span>
            <span className="text-[#000000] font-medium">
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
                    ? 'bg-[#000000] text-white'
                    : 'bg-white border border-[#ebebeb] text-[#000000] hover:border-[#000000]/40 shadow-soft-sm-custom'
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
                        ? 'bg-[#000000] text-white'
                        : 'bg-white border border-[#ebebeb] text-[#000000] hover:border-[#000000]/40 shadow-soft-sm-custom'
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.05em] text-[#000000]">
              {currentCategory || (searchQuery ? 'Kết quả tìm kiếm' : 'Sản phẩm mới nhất')}
            </h2>
            <ChevronRight className="w-5 h-5 text-[#000000]" />
          </div>
          <span className="text-xs text-[#787574] tracking-[-0.017em]">
            {products.length} sản phẩm
          </span>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-[28px] p-16 text-center shadow-card-custom">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-semibold text-[#000000] tracking-[-0.014em] mb-1">
              Không tìm thấy sản phẩm nào
            </h3>
            <p className="text-sm text-[#787574] mb-6 tracking-[-0.014em]">
              Hãy thử tìm kiếm từ khóa khác hoặc bấm xem tất cả sản phẩm.
            </p>
            <Link
              href="/"
              className="inline-block bg-[#000000] text-white text-xs font-medium px-5 py-2.5 rounded-full hover:bg-[#332f2d] transition"
            >
              Xem tất cả
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </section>
    </div>
  );
}

export default HomeView;
