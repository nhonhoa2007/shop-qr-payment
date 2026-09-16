'use client';

import { useHydrated } from '@/lib/hydration';
import { useCartStore } from '@/client/stores/cart-store';
import { CartItem } from '@/client/components/cart/CartItem';
import { CartSummary } from '@/client/components/cart/CartSummary';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

export function CartView() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const hydrated = useHydrated();

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-[28px] p-16 shadow-card-custom max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h1 className="text-xl font-semibold text-[#000000] tracking-[-0.05em] mb-2">
            Giỏ hàng đang trống
          </h1>
          <p className="text-sm text-[#787574] tracking-[-0.014em] mb-6">
            Hãy thêm sản phẩm bạn yêu thích vào giỏ
          </p>
          <Link
            href="/"
            className="inline-block bg-[#000000] text-white px-6 py-3 rounded-full font-medium tracking-[-0.014em] hover:bg-[#332f2d] transition text-sm"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#000000] tracking-[-0.05em]">
          Giỏ hàng
          <span className="text-base font-medium text-[#787574] tracking-[-0.014em] ml-2">
            ({items.length})
          </span>
        </h1>
        <button
          onClick={clearCart}
          className="text-xs text-[#787574] hover:text-red-500 transition px-3 py-1.5 rounded-full hover:bg-[#f2f4f5] tracking-[-0.014em]"
        >
          Xóa tất cả
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.variantId || 'base'}`}
              item={item}
            />
          ))}
        </div>
        <div>
          <CartSummary />
        </div>
      </div>
    </div>
  );
}

export default CartView;
