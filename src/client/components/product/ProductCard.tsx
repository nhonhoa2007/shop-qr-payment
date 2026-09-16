'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/client/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { Star, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/types';

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const activeVariants = product.variants?.filter((v) => v.isActive) || [];
  const hasVariants = activeVariants.length > 0;

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
      <div className="bg-white rounded-[28px] shadow-card-custom hover:shadow-card-hover-custom transition-all duration-300 overflow-hidden flex flex-col h-full p-2.5">
        {/* 1:1 Product Image with 20px inner radius creating white frame */}
        <div className="aspect-square relative bg-[#f2f4f5] rounded-[20px] overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#cccccc]">
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
            <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-[#000000] text-[11px] font-medium px-2.5 py-1 rounded-full shadow-soft-sm-custom">
              {product.category}
            </span>
          )}

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
            <h3 className="font-semibold text-sm leading-snug tracking-[-0.014em] text-[#000000] group-hover:text-[#5433eb] transition-colors line-clamp-2">
              {product.name}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-1 mt-1">
              <div className="flex items-center text-[#000000]">
                <Star className="w-3 h-3 fill-[#000000] text-[#000000]" />
                <span className="text-[11px] font-medium text-[#000000] ml-1 tracking-[-0.017em]">
                  {product.avgRating && product.avgRating > 0 ? product.avgRating : '5.0'}
                </span>
              </div>
              <span className="text-[11px] text-[#787574] tracking-[-0.017em]">
                ({product.reviewCount || 0})
              </span>
            </div>
          </div>

          {/* Price and Add Action */}
          <div className="flex items-center justify-between pt-2 border-t border-[#ebebeb]/60">
            <div>
              <p className="text-base font-semibold text-[#000000] tracking-tight-display">
                {formatVND(product.price)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className="w-8 h-8 rounded-full bg-[#f2f4f5] text-[#000000] hover:bg-[#000000] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
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
