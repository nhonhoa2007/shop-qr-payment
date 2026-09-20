'use client';

import { useHydrated } from '@/lib/hydration';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckoutForm } from '@client/components/checkout/CheckoutForm';
import { useCartStore } from '@client/stores/cart-store';
import { formatVND } from '@shared/utils';
import { calculateCheckoutTotals } from '@/lib/checkout';
import { ShieldCheck, ShoppingBag, Package } from 'lucide-react';

export function CheckoutView() {
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-[28px] p-16 shadow-card-custom max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h1 className="text-xl font-semibold text-[#000000] tracking-[-0.05em] mb-2">
            Giỏ hàng của bạn đang trống
          </h1>
          <p className="text-sm text-[#787574] tracking-[-0.014em] mb-6">
            Hãy chọn các sản phẩm ưng ý trước khi thanh toán
          </p>
          <Link
            href="/"
            className="inline-block bg-[#000000] text-white font-medium text-sm px-6 py-3 rounded-full hover:bg-[#332f2d] transition tracking-[-0.014em]"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  const total = getTotalAmount();
  const { shippingFee, totalAmount } = calculateCheckoutTotals(total);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#787574] mb-6 tracking-[-0.014em]">
        <Link href="/cart" className="hover:text-[#000000] transition">
          Giỏ hàng
        </Link>
        <span>/</span>
        <span className="text-[#000000] font-medium">Thanh toán</span>
      </div>

      <h1 className="text-2xl font-semibold text-[#000000] tracking-[-0.05em] mb-8">
        Xác nhận thông tin & Thanh toán
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7">
          <CheckoutForm
            initialName={session?.user?.name || ''}
            initialEmail={session?.user?.email || ''}
          />
        </div>

        {/* Order Summary Card */}
        <div className="lg:col-span-5 bg-white rounded-[28px] p-6 shadow-card-custom sticky top-24">
          <h2 className="font-semibold text-base text-[#000000] tracking-[-0.031em] mb-4 pb-3 border-b border-[#ebebeb]">
            Tóm tắt giỏ hàng ({items.length})
          </h2>

          <div className="divide-y divide-[#ebebeb] max-h-80 overflow-y-auto mb-6 pr-2">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId || 'base'}`} className="py-3 flex items-center gap-3">
                <div className="w-14 h-14 bg-[#f2f4f5] rounded-[14px] overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400 stroke-[1.5]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs text-[#000000] tracking-[-0.014em] truncate">{item.name}</p>
                  {item.variantTitle && (
                    <p className="text-[11px] text-[#5433eb] font-medium tracking-[-0.014em]">
                      {item.variantTitle}
                    </p>
                  )}
                  <p className="text-[11px] text-[#787574] mt-0.5 tracking-[-0.017em]">
                    {formatVND(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-xs text-[#000000] tracking-tight-display">
                    {formatVND(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 text-sm pt-4 border-t border-[#ebebeb]">
            <div className="flex justify-between text-[#787574] tracking-[-0.014em]">
              <span>Tạm tính</span>
              <span className="font-medium text-[#000000]">{formatVND(total)}</span>
            </div>
            <div className="flex justify-between text-[#787574] tracking-[-0.014em]">
              <span>Phí giao hàng</span>
              <span className="font-medium text-[#000000]">
                {shippingFee === 0 ? (
                  <span className="text-[#000000] font-semibold">Miễn phí</span>
                ) : (
                  formatVND(shippingFee)
                )}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold text-[#000000] pt-3 border-t border-[#ebebeb] tracking-[-0.05em]">
              <span>Tổng thanh toán</span>
              <span className="text-xl font-semibold text-[#000000]">{formatVND(totalAmount)}</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#f2f4f5] rounded-[20px] text-xs text-[#787574] space-y-1">
            <p className="font-medium text-[#000000] flex items-center gap-1.5 tracking-[-0.014em]">
              <ShieldCheck className="w-4 h-4 text-[#5433eb]" />
              <span>Thanh toán tự động với VietQR</span>
            </p>
            <p className="leading-relaxed tracking-[-0.014em]">
              Mã QR ngân hàng động sẽ được sinh tự động chính xác số tiền và mã giao dịch sau khi nhấn đặt hàng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutView;
