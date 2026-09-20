'use client';

import Image from 'next/image';
import { useCartStore } from '@client/stores/cart-store';
import { formatVND } from '@shared/utils';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { CartItem as CartItemType } from '@shared/types';

export function CartItem({ item }: { item: CartItemType }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-[20px] shadow-card-custom">
      <div className="w-16 h-16 bg-[#f2f4f5] rounded-[14px] overflow-hidden flex-shrink-0 relative">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#cccccc]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-[#000000] tracking-[-0.014em] truncate">{item.name}</h3>
        {item.variantTitle && (
          <div className="mt-1">
            <span className="inline-block bg-[#f2f4f5] text-[#5433eb] text-[11px] font-medium px-2.5 py-0.5 rounded-full tracking-[-0.014em]">
              Phân loại: {item.variantTitle}
            </span>
          </div>
        )}
        <p className="text-xs text-[#787574] mt-1 tracking-[-0.017em]">{formatVND(item.price)}</p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center border border-[#ebebeb] rounded-full bg-[#f2f4f5] p-0.5">
        <button
          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-[#000000] hover:bg-white transition"
          aria-label="Giảm số lượng"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-xs font-semibold text-[#000000]">{item.quantity}</span>
        <button
          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-[#000000] hover:bg-white transition"
          aria-label="Tăng số lượng"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Subtotal */}
      <div className="text-right min-w-[90px]">
        <p className="font-semibold text-sm text-[#000000] tracking-tight-display">
          {formatVND(item.price * item.quantity)}
        </p>
      </div>

      {/* Remove */}
      <button
        onClick={() => removeItem(item.productId, item.variantId)}
        className="p-2 text-[#787574] hover:text-red-500 rounded-full hover:bg-[#f2f4f5] transition"
        title="Xóa sản phẩm"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
