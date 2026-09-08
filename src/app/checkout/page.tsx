'use client';

import { useHydrated } from '@/lib/hydration';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { calculateCheckoutTotals } from '@/lib/checkout';

export default function CheckoutPage() {
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <span className="text-6xl block mb-4">🛒</span>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Giỏ hàng của bạn đang trống</h1>
        <p className="text-gray-500 mb-6 text-sm">Hãy chọn các sản phẩm ưng ý trước khi thanh toán</p>
        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
        >
          Khám phá sản phẩm
        </Link>
      </div>
    );
  }

  const total = getTotalAmount();
  const { shippingFee, totalAmount } = calculateCheckoutTotals(total);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/cart" className="hover:text-blue-600 transition">
          Giỏ hàng
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Thanh toán</span>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">Xác nhận thông tin & Thanh toán</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7">
          <CheckoutForm
            initialName={session?.user?.name || ''}
            initialEmail={session?.user?.email || ''}
          />
        </div>

        <div className="lg:col-span-5 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 sticky top-24">
          <h2 className="font-bold text-lg text-gray-900 mb-4 pb-3 border-b border-gray-100">
            Tóm tắt giỏ hàng ({items.length})
          </h2>

          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto mb-6 pr-2">
            {items.map((item) => (
              <div key={item.productId} className="py-3 flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="text-xl">📦</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatVND(item.price)} × {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-gray-900">{formatVND(item.price * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 text-sm pt-4 border-t border-gray-100">
            <div className="flex justify-between text-gray-600">
              <span>Tạm tính</span>
              <span className="font-semibold text-gray-900">{formatVND(total)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Phí giao hàng</span>
              <span className="font-semibold text-gray-900">
                {shippingFee === 0 ? (
                  <span className="text-green-600 font-bold">Miễn phí</span>
                ) : (
                  formatVND(shippingFee)
                )}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-gray-900 pt-3 border-t border-gray-100">
              <span>Tổng thanh toán</span>
              <span className="text-2xl font-black text-blue-600">{formatVND(totalAmount)}</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50/60 rounded-2xl border border-blue-100/60 text-xs text-blue-800 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Thanh toán tự động với VietQR</span>
            </p>
            <p className="text-blue-700/80 leading-relaxed">
              Mã QR ngân hàng động sẽ được sinh tự động chính xác số tiền và mã giao dịch sau khi nhấn đặt hàng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
