'use client';

import { useHydrated } from '@/lib/hydration';
import { useCartStore } from '@/stores/cart-store';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';
import Link from 'next/link';

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const hydrated = useHydrated();

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <span className="text-6xl block mb-4">🛒</span>
        <h1 className="text-2xl font-bold mb-2">Giỏ hàng trống</h1>
        <p className="text-gray-500 mb-6">Hãy thêm sản phẩm vào giỏ hàng</p>
        <Link href="/" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">Mua sắm ngay</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Giỏ hàng ({items.length})</h1>
        <button onClick={clearCart} className="text-sm text-red-500 hover:underline">Xóa tất cả</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => <CartItem key={item.productId} item={item} />)}
        </div>
        <div>
          <CartSummary />
        </div>
      </div>
    </div>
  );
}
