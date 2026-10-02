'use client';

import Image from 'next/image';
import { useCartStore } from '@client/stores/cart-store';
import { formatVND } from '@shared/utils';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { CartItem as CartItemType } from '@shared/types';

interface CartItemProps {
  item: CartItemType;
  /** Khi được cung cấp, nút xóa sẽ yêu cầu xác nhận qua component cha thay vì xóa ngay */
  onRequestRemove?: (item: CartItemType) => void;
}

export function CartItem({ item, onRequestRemove }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const handleRemove = () => {
    if (onRequestRemove) {
      onRequestRemove(item);
    } else {
      removeItem(item.productId, item.variantId);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-white p-4 rounded-[20px] shadow-card">
      <div className="w-16 h-16 bg-canvas-mist rounded-[14px] overflow-hidden flex-shrink-0 relative">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cool-stone">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-[100px]">
        <h3 className="font-semibold text-sm text-ink-black tracking-[-0.014em] truncate">{item.name}</h3>
        {item.variantTitle && (
          <div className="mt-1">
            <span className="inline-block bg-canvas-mist text-shop-violet text-[11px] font-medium px-2.5 py-0.5 rounded-full tracking-[-0.014em]">
              Phân loại: {item.variantTitle}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-gray mt-1 tracking-[-0.017em]">{formatVND(item.price)}</p>
      </div>

      {/* Controls: xuống hàng thứ hai trên mobile, nằm ngang từ sm trở lên */}
      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end pl-[76px] sm:pl-0">
        {/* Quantity controls */}
        <div className="flex items-center border border-faint-border rounded-full bg-canvas-mist p-0.5">
          <button
            onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-ink-black hover:bg-white transition"
            aria-label="Giảm số lượng"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-xs font-semibold text-ink-black">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-ink-black hover:bg-white transition"
            aria-label="Tăng số lượng"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subtotal */}
        <div className="text-right min-w-[90px]">
          <p className="font-semibold text-sm text-ink-black tracking-tight-display">
            {formatVND(item.price * item.quantity)}
          </p>
        </div>

        {/* Remove */}
        <button
          onClick={handleRemove}
          className="p-2.5 text-muted-gray hover:text-red-500 rounded-full hover:bg-canvas-mist transition"
          aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
