'use client';

import { useState } from 'react';
import { useHydrated } from '@client/hooks/useHydrated';
import { useCartStore } from '@client/stores/cart-store';
import { CartItem } from '@client/components/cart/CartItem';
import { CartSummary } from '@client/components/cart/CartSummary';
import { ConfirmDialog } from '@client/components/ui/ConfirmDialog';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import type { CartItem as CartItemType } from '@shared/types';

type CartConfirmState =
  | { type: 'clear' }
  | { type: 'item'; item: CartItemType }
  | null;

export function CartView() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const hydrated = useHydrated();
  const [confirmState, setConfirmState] = useState<CartConfirmState>(null);

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-[28px] p-16 shadow-card max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h1 className="text-xl font-semibold text-ink-black tracking-[-0.05em] mb-2">
            Giỏ hàng đang trống
          </h1>
          <p className="text-sm text-muted-gray tracking-[-0.014em] mb-6">
            Hãy thêm sản phẩm bạn yêu thích vào giỏ
          </p>
          <Link
            href="/"
            className="inline-block bg-ink-black text-white px-6 py-3 rounded-full font-medium tracking-[-0.014em] hover:bg-slate-ink transition text-sm"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  const confirmTitle =
    confirmState?.type === 'clear' ? 'Xóa toàn bộ giỏ hàng?' : 'Xóa sản phẩm khỏi giỏ?';
  const confirmDescription =
    confirmState?.type === 'clear'
      ? `Giỏ hàng đang có ${items.length} sản phẩm. Hành động này không thể hoàn tác.`
      : confirmState?.type === 'item'
        ? `"${confirmState.item.name}" sẽ được bỏ khỏi giỏ hàng.`
        : undefined;

  const handleConfirm = () => {
    if (confirmState?.type === 'clear') {
      clearCart();
      toast.info('Đã xóa toàn bộ giỏ hàng');
    } else if (confirmState?.type === 'item') {
      const { productId, variantId } = confirmState.item;
      removeItem(productId, variantId);
      toast.info('Đã xóa sản phẩm khỏi giỏ');
    }
    setConfirmState(null);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-black tracking-[-0.05em]">
          Giỏ hàng
          <span className="text-base font-medium text-muted-gray tracking-[-0.014em] ml-2">
            ({items.length})
          </span>
        </h1>
        <button
          onClick={() => setConfirmState({ type: 'clear' })}
          className="text-xs text-muted-gray hover:text-red-500 transition px-3 py-1.5 rounded-full hover:bg-canvas-mist tracking-[-0.014em] cursor-pointer"
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
              onRequestRemove={(it) => setConfirmState({ type: 'item', item: it })}
            />
          ))}
        </div>
        <div>
          <CartSummary />
        </div>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Xóa"
        cancelLabel="Giữ lại"
        variant="danger"
      />
    </div>
  );
}

export default CartView;
