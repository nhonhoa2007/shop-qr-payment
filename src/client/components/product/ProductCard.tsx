'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@client/stores/cart-store';
import { useWishlistStore } from '@client/stores/wishlist-store';
import { useHydrated } from '@/lib/hydration';
import { formatVND } from '@shared/utils';
import { Star, Plus, SlidersHorizontal, Heart } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@shared/types';

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const hydrated = useHydrated();
  const isWishlistedRaw = useWishlistStore((s) => s.wishlistIds.includes(product.id));
  const isWishlisted = hydrated && isWishlistedRaw;
  const isPending = useWishlistStore((s) => s.pendingId === product.id);
  const toggleWishlist = useWishlistStore((s) => s.toggleWishlist);
  const fetchWishlist = useWishlistStore((s) => s.fetchWishlist);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const activeVariants = product.variants?.filter((v) => v.isActive) || [];
  const hasVariants = activeVariants.length > 0;

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await toggleWishlist({
      id: product.id,
      name: product.name,
    });
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }

    if (hasVariants) {
      toast.info('Vui lòng chọn phân loại hàng cho sản phẩm');
      router.push(`/products/${product.id}`);
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image || undefined,
    });
    toast.success(`Đã thêm "${product.name}" vào giỏ`);
  };

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="bg-white rounded-[28px] shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden flex flex-col h-full p-2.5">
        {/* 1:1 Product Image with 20px inner radius creating white frame */}
        <div className="aspect-square relative bg-canvas-mist rounded-[20px] overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-cool-stone">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* Out of stock badge */}
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-white font-medium text-xs tracking-[-0.014em] bg-black/80 px-3 py-1.5 rounded-full">
                Hết hàng
              </span>
            </div>
          )}

          {/* Category Chip */}
          {product.category && (
            <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-ink-black text-[11px] font-medium px-2.5 py-1 rounded-full shadow-soft-sm">
              {product.category}
            </span>
          )}

          {/* Quick Wishlist Button */}
          <button
            type="button"
            onClick={handleToggleWishlist}
            disabled={isPending}
            className={`absolute top-2.5 right-2.5 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-soft-sm ${
              isWishlisted
                ? 'bg-white text-rose-500 hover:bg-rose-50 hover:scale-110 active:scale-90 shadow-sm'
                : 'bg-white/90 hover:bg-white text-muted-gray hover:text-rose-500 hover:scale-110 active:scale-90 backdrop-blur-sm'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isWishlisted ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
            aria-label={isWishlisted ? `Xóa ${product.name} khỏi yêu thích` : `Thêm ${product.name} vào yêu thích`}
          >
            <Heart
              className={`w-4 h-4 transition-all duration-200 ${
                isWishlisted
                  ? 'fill-rose-500 text-rose-500 scale-105'
                  : 'text-muted-gray hover:text-rose-500'
              } ${isPending ? 'animate-pulse' : ''}`}
            />
          </button>

          {/* Has variants chip */}
          {hasVariants && (
            <span className="absolute bottom-2.5 left-2.5 bg-black/75 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
              {activeVariants.length} phân loại
            </span>
          )}
        </div>

        {/* Info Stack */}
        <div className="pt-3 pb-1 px-1.5 flex flex-col flex-1 justify-between gap-2.5">
          <div>
            <h3 className="font-semibold text-sm leading-snug tracking-[-0.014em] text-ink-black group-hover:text-shop-violet transition-colors line-clamp-2">
              {product.name}
            </h3>

            {/* Rating — hiển thị "Chưa có đánh giá" thay vì điểm 5.0 mặc định gây hiểu lầm */}
            <div className="flex items-center gap-1 mt-1 h-4">
              {product.avgRating && product.avgRating > 0 ? (
                <>
                  <div className="flex items-center text-ink-black">
                    <Star className="w-3 h-3 fill-[#000000] text-ink-black" />
                    <span className="text-[11px] font-medium text-ink-black ml-1 tracking-[-0.017em]">
                      {product.avgRating}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-gray tracking-[-0.017em]">
                    ({product.reviewCount})
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-muted-gray tracking-[-0.017em]">
                  Chưa có đánh giá
                </span>
              )}
            </div>
          </div>

          {/* Price and Add Action */}
          <div className="flex items-center justify-between pt-2 border-t border-faint-border/60">
            <div>
              <p className="text-base font-semibold text-ink-black tracking-tight-display">
                {formatVND(product.price)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className="w-10 h-10 rounded-full bg-canvas-mist text-ink-black hover:bg-ink-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
              title={hasVariants ? 'Chọn phân loại' : 'Thêm vào giỏ'}
              aria-label={hasVariants ? 'Chọn phân loại' : 'Thêm vào giỏ'}
            >
              {hasVariants ? (
                <SlidersHorizontal className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
