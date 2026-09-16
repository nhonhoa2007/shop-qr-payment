'use client';

import { useState } from 'react';
import { useCartStore } from '@/client/stores/cart-store';
import { toast } from 'sonner';
import { ShoppingCart } from 'lucide-react';
import type { Product } from '@/types';

export function AddToCartButton({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;

    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image || undefined,
      },
      quantity
    );

    toast.success(`Đã thêm ${quantity} sản phẩm vào giỏ hàng`);
  };

  return (
    <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden self-start">
        <button
          type="button"
          disabled={isOutOfStock || quantity <= 1}
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-4 py-3 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition text-gray-700"
        >
          -
        </button>
        <span className="px-4 py-3 text-center min-w-[3rem] font-semibold text-sm">
          {quantity}
        </span>
        <button
          type="button"
          disabled={isOutOfStock || quantity >= product.stock}
          onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
          className="px-4 py-3 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition text-gray-700"
        >
          +
        </button>
      </div>

      <button
        type="button"
        disabled={isOutOfStock}
        onClick={handleAddToCart}
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl transition shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>{isOutOfStock ? 'Tạm hết hàng' : 'Thêm vào giỏ hàng'}</span>
      </button>
    </div>
  );
}
