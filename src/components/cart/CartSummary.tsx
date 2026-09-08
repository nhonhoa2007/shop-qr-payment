'use client';

import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { calculateCheckoutTotals, FREE_SHIPPING_THRESHOLD } from '@/lib/checkout';
import Link from 'next/link';

export function CartSummary() {
  const items = useCartStore((s) => s.items);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);

  const total = getTotalAmount();
  const { shippingFee, totalAmount } = calculateCheckoutTotals(total);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-24">
      <h3 className="text-lg font-bold mb-4">Tóm tắt đơn hàng</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Tạm tính ({items.length} sản phẩm)</span>
          <span className="font-medium">{formatVND(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Phí vận chuyển</span>
          <span className="font-medium">{shippingFee === 0 ? 'Miễn phí' : formatVND(shippingFee)}</span>
        </div>
        {shippingFee > 0 && (
          <p className="text-xs text-green-600">Miễn phí vận chuyển cho đơn từ {formatVND(FREE_SHIPPING_THRESHOLD)}</p>
        )}
        <hr />
        <div className="flex justify-between text-lg font-bold">
          <span>Tổng cộng</span>
          <span className="text-blue-600">{formatVND(totalAmount)}</span>
        </div>
      </div>
      <Link
        href="/checkout"
        className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-blue-700 transition mt-6"
      >
        Tiến hành thanh toán
      </Link>
    </div>
  );
}
