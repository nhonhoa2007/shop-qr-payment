'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Ticket } from 'lucide-react';
import { useCoupons } from '@client/hooks/useCoupons';
import { getCouponAvailability, getCouponSavings } from '@shared/utils/coupon';
import { CouponCard } from '@client/components/coupon/CouponCard';

export function CheckoutCoupons({ subtotal, shippingFee, onSelect, applying }: { subtotal: number; shippingFee: number; onSelect: (code: string) => void; applying: boolean }) {
  const [open, setOpen] = useState(false);
  const { coupons, loading, error, refresh } = useCoupons(true);
  const eligible = coupons.filter(c => !getCouponAvailability(c, subtotal) && getCouponSavings(c, subtotal, shippingFee) > 0).length;
  const sorted = [...coupons].sort((a, b) => {
    const aValue = getCouponAvailability(a, subtotal) ? -1 : getCouponSavings(a, subtotal, shippingFee);
    const bValue = getCouponAvailability(b, subtotal) ? -1 : getCouponSavings(b, subtotal, shippingFee);
    return bValue - aValue;
  });
  return (
    <div className="mb-4 space-y-3">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="checkout-coupon-list" className="flex w-full items-center justify-between gap-2 rounded-2xl border border-shop-violet/20 bg-shop-violet/5 p-3 text-left text-sm font-medium text-shop-violet"><span className="flex items-center gap-2"><Ticket className="h-4 w-4" />Chọn voucher{!loading && !error ? ` · ${eligible} mã dùng được` : ''}</span><ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} /></button>
      {open && <div id="checkout-coupon-list" className="max-h-[480px] space-y-3 overflow-y-auto overscroll-contain pr-1">
        {loading ? <p role="status" className="py-3 text-xs text-muted-gray">Đang tải voucher…</p> : error ? <p role="alert" className="text-xs text-red-600">{error} <button type="button" onClick={refresh} className="underline">Thử lại</button></p> : sorted.length ? sorted.map(coupon => <CouponCard key={coupon.id} coupon={coupon} subtotal={subtotal} shippingFee={shippingFee} onSelect={onSelect} selecting={applying} />) : <p className="py-3 text-xs text-muted-gray">Chưa có ưu đãi đang diễn ra. Bạn vẫn có thể nhập mã được chia sẻ bên dưới.</p>}
        <Link href="/coupons" className="inline-block text-xs font-medium text-shop-violet underline">Khám phá ưu đãi và voucher đã lưu</Link>
      </div>}
    </div>
  );
}
