'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookmarkCheck, Ticket, ArrowRight } from 'lucide-react';
import { useCoupons } from '@client/hooks/useCoupons';
import { CouponCard } from '@client/components/coupon/CouponCard';

export function CouponsView() {
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const { publicCoupons, savedCoupons, loading, error, refresh, toggleSave, pendingId, signedIn } = useCoupons(true);
  const coupons = tab === 'saved' ? savedCoupons : publicCoupons;
  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-10 sm:px-6">
      <section className="relative overflow-hidden rounded-[32px] bg-ink-black px-6 py-10 text-white sm:px-10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs"><Ticket className="h-4 w-4" />Ưu đãi từ Shop</div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Mua sắm vui hơn, tiết kiệm nhiều hơn.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">Khám phá mã giảm giá và miễn phí vận chuyển. Lưu vào ví để dễ tìm lại, hoặc nhập mã trực tiếp khi thanh toán.</p>
      </section>
      <div className="flex flex-wrap items-center gap-2" aria-label="Danh sách voucher">
        <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')} className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${tab === 'all' ? 'bg-shop-violet text-white' : 'border border-faint-border bg-white text-muted-gray'}`}><Ticket className="h-4 w-4" />Tất cả ưu đãi</button>
        <button type="button" aria-pressed={tab === 'saved'} onClick={() => setTab('saved')} className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${tab === 'saved' ? 'bg-shop-violet text-white' : 'border border-faint-border bg-white text-muted-gray'}`}><BookmarkCheck className="h-4 w-4" />Voucher của tôi{signedIn && !loading ? ` (${savedCoupons.length})` : ''}</button>
      </div>
      {tab === 'saved' && !signedIn ? (
        <div className="rounded-[28px] border border-faint-border bg-white p-10 text-center">
          <BookmarkCheck className="mx-auto mb-4 h-10 w-10 text-shop-violet" /><h2 className="text-lg font-semibold">Ví voucher luôn bên bạn</h2>
          <p className="mb-5 mt-2 text-sm text-muted-gray">Đăng nhập để lưu mã và xem lại trên mọi thiết bị.</p>
          <Link href="/login?callbackUrl=/coupons" className="inline-flex rounded-full bg-shop-violet px-5 py-3 text-sm font-medium text-white">Đăng nhập để lưu mã</Link>
        </div>
      ) : loading ? <p role="status" className="py-12 text-center text-sm text-muted-gray">Đang tải ưu đãi…</p> : error ? (
        <div role="alert" className="rounded-[24px] border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}<button type="button" onClick={refresh} className="ml-3 font-semibold underline">Thử lại</button></div>
      ) : coupons.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{coupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} onToggleSave={toggleSave} saving={pendingId === coupon.id} saveDisabled={pendingId !== null} />)}</div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-faint-border bg-white p-12 text-center"><Ticket className="mx-auto mb-4 h-10 w-10 text-muted-gray" /><h2 className="text-lg font-semibold">{tab === 'saved' ? 'Bạn chưa lưu voucher nào' : 'Chưa có ưu đãi đang diễn ra'}</h2><p className="mt-2 text-sm text-muted-gray">{tab === 'saved' ? 'Khám phá ưu đãi và bấm “Lưu mã” để thêm vào ví của bạn.' : 'Ghé lại sau để khám phá những mã giảm giá mới từ Shop.'}</p>{tab === 'saved' && <button type="button" onClick={() => setTab('all')} className="mt-5 text-sm font-semibold text-shop-violet">Khám phá ưu đãi</button>}</div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-shop-violet/5 p-5"><p className="text-sm text-muted-gray">Lưu mã không giữ chỗ hay trừ lượt dùng. Ưu đãi được kiểm tra lại khi đặt hàng.</p><Link href="/" className="flex items-center gap-2 text-sm font-semibold text-shop-violet">Tiếp tục mua sắm<ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  );
}
