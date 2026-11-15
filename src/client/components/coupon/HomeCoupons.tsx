'use client';

import Link from 'next/link';
import { ArrowRight, Ticket } from 'lucide-react';
import { useCoupons } from '@client/hooks/useCoupons';
import { CouponCard } from '@client/components/coupon/CouponCard';

export function HomeCoupons() {
  const { publicCoupons, loading, error, refresh, toggleSave, pendingId } = useCoupons();
  return (
    <section className="space-y-5" aria-labelledby="home-coupons-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="home-coupons-title" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink-black"><Ticket className="h-5 w-5 text-shop-violet" />Ưu đãi dành cho bạn</h2>
          <p className="mt-1 text-sm text-muted-gray">Lưu mã yêu thích, chọn ưu đãi khi thanh toán.</p>
        </div>
        <Link href="/coupons" className="flex items-center gap-1 text-sm font-medium text-shop-violet">Xem tất cả<ArrowRight className="h-4 w-4" /></Link>
      </div>
      {loading ? <p className="text-sm text-muted-gray" role="status">Đang tìm ưu đãi…</p> : error ? (
        <p className="text-sm text-muted-gray">Chưa tải được ưu đãi. <button type="button" onClick={refresh} className="text-shop-violet underline">Thử lại</button></p>
      ) : publicCoupons.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{publicCoupons.slice(0, 3).map(coupon => <CouponCard key={coupon.id} coupon={coupon} onToggleSave={toggleSave} saving={pendingId === coupon.id} saveDisabled={pendingId !== null} />)}</div>
      ) : <div className="rounded-[24px] border border-dashed border-faint-border px-6 py-7 text-sm text-muted-gray">Ưu đãi mới đang được chuẩn bị. Ghé lại để khám phá các mã giảm giá tiếp theo.</div>}
    </section>
  );
}
