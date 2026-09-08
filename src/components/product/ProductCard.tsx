'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { Star, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/types';

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image || undefined,
    });
    toast.success(`Đã thêm "${product.name}" vào giỏ hàng`);
  };

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border border-gray-100 flex flex-col h-full">
        <div className="aspect-square relative bg-gray-50 overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-white font-bold text-sm tracking-wide bg-red-600/90 px-3 py-1.5 rounded-xl">Hết hàng</span>
            </div>
          )}
          {product.category && (
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm">
              {product.category}
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1 justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 text-sm leading-snug">
              {product.name}
            </h3>

            {/* Đánh giá sao */}
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span className="text-xs font-bold text-gray-800 ml-1">
                  {product.avgRating && product.avgRating > 0 ? product.avgRating : '5.0'}
                </span>
              </div>
              <span className="text-[11px] text-gray-400">
                ({product.reviewCount || 0} đánh giá)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div>
              <p className="text-base sm:text-lg font-extrabold text-blue-600">{formatVND(product.price)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className="bg-blue-50 text-blue-600 p-2.5 rounded-xl hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              title="Thêm vào giỏ"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
