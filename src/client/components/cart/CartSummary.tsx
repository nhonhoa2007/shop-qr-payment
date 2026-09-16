'use client';

import { useCartStore } from '@/client/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { calculateCheckoutTotals, FREE_SHIPPING_THRESHOLD } from '@/lib/checkout';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CartSummary() {
  const items = useCartStore((s) => s.items);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);

  const total = getTotalAmount();
  const { shippingFee, totalAmount } = calculateCheckoutTotals(total);

  return (
    <div className="bg-white rounded-[28px] p-6 shadow-card-custom sticky top-24">
      <h3 className="text-base font-semibold text-[#000000] tracking-[-0.031em] mb-4">Tóm tắt đơn hàng</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[#787574] tracking-[-0.014em]">Tạm tính ({items.length} sản phẩm)</span>
          <span className="font-medium text-[#000000] tracking-[-0.014em]">{formatVND(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#787574] tracking-[-0.014em]">Phí vận chuyển</span>
          <span className="font-medium text-[#000000] tracking-[-0.014em]">
            {shippingFee === 0 ? 'Miễn phí' : formatVND(shippingFee)}
          </span>
        </div>
        {shippingFee > 0 && (
          <p className="text-[11px] text-[#787574] tracking-[-0.017em]">
            Miễn phí vận chuyển cho đơn từ {formatVND(FREE_SHIPPING_THRESHOLD)}
          </p>
        )}
        <div className="border-t border-[#ebebeb] pt-3">
          <div className="flex justify-between">
            <span className="font-semibold text-[#000000] tracking-[-0.031em]">Tổng cộng</span>
            <span className="text-lg font-semibold text-[#000000] tracking-[-0.05em]">
              {formatVND(totalAmount)}
            </span>
          </div>
        </div>
      </div>
      <Link
        href="/checkout"
        className="flex items-center justify-center gap-2 w-full bg-[#5433eb] text-white text-center py-3.5 rounded-full font-medium tracking-[-0.014em] hover:bg-[#4428d4] transition mt-6 shadow-violet-custom text-sm"
      >
        <span>Thanh toán</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
