'use client';

import { Bookmark, BookmarkCheck, Copy, Ticket, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomerCoupon } from '@shared/types/coupon';
import { getCouponAvailability, getCouponSavings, getCouponTitle } from '@shared/utils/coupon';

interface CouponCardProps {
  coupon: CustomerCoupon;
  onToggleSave?: (coupon: CustomerCoupon) => void;
  saving?: boolean;
  saveDisabled?: boolean;
  onSelect?: (code: string) => void;
  selecting?: boolean;
  subtotal?: number;
  shippingFee?: number;
}

export function CouponCard({ coupon, onToggleSave, saving, saveDisabled, onSelect, selecting, subtotal, shippingFee = 0 }: CouponCardProps) {
  const reason = getCouponAvailability(coupon, subtotal);
  const savings = subtotal === undefined ? null : getCouponSavings(coupon, subtotal, shippingFee);
  const money = (value: string | number) => `${BigInt(value).toLocaleString('vi-VN')}đ`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(coupon.code); toast.success('Đã sao chép mã'); }
    catch { toast.error('Không thể sao chép. Bạn có thể nhập mã hiển thị trên thẻ.'); }
  };

  return (
    <article className={`flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border bg-white ${reason ? 'border-faint-border' : 'border-shop-violet/20'} shadow-soft-sm`}>
      <div className="flex flex-1 gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-shop-violet/10 text-shop-violet">
          {coupon.discountType === 'FREE_SHIPPING' ? <Truck className="h-6 w-6" /> : <Ticket className="h-6 w-6" />}
        </div>
        <div className="min-w-0 space-y-1.5">
          {coupon.saved && <span className="text-[11px] font-semibold text-shop-violet">Đã lưu vào ví</span>}
          <h3 className="text-lg font-semibold tracking-tight text-ink-black">{getCouponTitle(coupon)}</h3>
          {coupon.maxDiscount && BigInt(coupon.maxDiscount) > 0 && coupon.discountType === 'PERCENTAGE' && <p className="text-xs text-muted-gray">Giảm tối đa {money(coupon.maxDiscount)}</p>}
          <p className="text-xs text-muted-gray">{BigInt(coupon.minOrderAmount) > 0 ? `Đơn từ ${money(coupon.minOrderAmount)}` : 'Không yêu cầu giá trị đơn tối thiểu'}</p>
          {coupon.description && <p className="text-sm leading-relaxed text-muted-gray">{coupon.description}</p>}
          <p className="text-xs text-muted-gray">HSD: {new Date(coupon.endDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {coupon.perUserLimit} lượt/tài khoản</p>
          {reason ? <p className="text-xs font-medium text-amber-700">{reason}</p> : savings !== null && (
            <p className="text-xs font-semibold text-shop-violet">{savings > 0 ? `Tiết kiệm ${money(savings)}` : 'Đơn hiện tại chưa phát sinh phí vận chuyển'}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-faint-border bg-canvas-mist/40 px-5 py-3">
        <button type="button" onClick={copy} aria-label={`Sao chép mã ${coupon.code}`} className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink-black hover:text-shop-violet">
          <span className="break-all font-mono tracking-wide">{coupon.code}</span><Copy className="h-3.5 w-3.5 shrink-0" />
        </button>
        <div className="flex items-center gap-2">
          {onToggleSave && <button type="button" onClick={() => onToggleSave(coupon)} disabled={saveDisabled || saving || (!coupon.saved && Boolean(getCouponAvailability(coupon)))} aria-label={`${coupon.saved ? 'Bỏ lưu' : 'Lưu mã'} ${coupon.code}`} className="inline-flex items-center gap-1.5 rounded-full border border-shop-violet/20 px-3 py-2 text-xs font-semibold text-shop-violet transition hover:bg-shop-violet/10 disabled:opacity-50">
            {coupon.saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {saving ? 'Đang lưu…' : coupon.saved ? 'Bỏ lưu' : 'Lưu mã'}
          </button>}
          {onSelect && <button type="button" onClick={() => onSelect(coupon.code)} disabled={selecting || Boolean(reason) || savings === 0} className="rounded-full bg-shop-violet px-4 py-2 text-xs font-semibold text-white transition hover:bg-shop-violet-deep disabled:opacity-40">{selecting ? 'Đang kiểm tra…' : 'Áp dụng'}</button>}
        </div>
      </div>
    </article>
  );
}
