'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { calculateCheckoutTotalsWithCoupon } from '@/lib/checkout';
import { getErrorMessage } from '@/lib/errors';
import { Tag, Check, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutFormProps {
  initialName?: string;
  initialEmail?: string;
}

interface CreateOrderResponse {
  orderId?: string;
  error?: string;
}

interface AppliedCoupon {
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
}

export function CheckoutForm({ initialName = '', initialEmail = '' }: CheckoutFormProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);
  const clearCart = useCartStore((s) => s.clearCart);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const [form, setForm] = useState({
    customerName: initialName,
    customerPhone: '',
    customerEmail: initialEmail,
    customerAddress: '',
    note: '',
  });

  const subtotal = getTotalAmount();
  const totals = calculateCheckoutTotalsWithCoupon(subtotal, appliedCoupon);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    setApplyingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCodeInput.trim().toUpperCase(),
          subtotal,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.coupon) {
        throw new Error(data.error || 'Mã giảm giá không hợp lệ');
      }

      setAppliedCoupon(data.coupon);
      toast.success(`Đã áp dụng mã "${data.coupon.code}" thành công!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Mã giảm giá không hợp lệ');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    toast.info('Đã hủy áp dụng mã giảm giá');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.customerPhone.trim() || form.customerPhone.length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });

      const data = (await res.json()) as CreateOrderResponse;
      if (!res.ok || !data.orderId) {
        throw new Error(data.error || 'Lỗi tạo đơn hàng');
      }

      toast.success('Đặt hàng thành công! Đang chuyển đến cổng thanh toán QR...');
      clearCart();
      router.push(`/payment/${data.orderId}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Lỗi kết nối máy chủ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-full text-xs animate-shake tracking-[-0.014em]">
          {error}
        </div>
      )}

      {/* Thông tin giao hàng — 28px card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card-custom">
        <h2 className="font-semibold text-base text-[#000000] tracking-[-0.031em] mb-6">
          Thông tin giao nhận hàng
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
              Họ và tên người nhận *
            </label>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Số điện thoại *
              </label>
              <input
                type="tel"
                required
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
                placeholder="0912345678"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Email nhận hóa đơn
              </label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
              Địa chỉ chi tiết nhận hàng *
            </label>
            <textarea
              required
              rows={3}
              value={form.customerAddress}
              onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
              className="w-full px-4 py-3 rounded-[20px] border border-[#000000]/10 bg-white text-sm text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
              Ghi chú cho người bán / shipper
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
              placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
            />
          </div>
        </div>
      </div>

      {/* Áp dụng Mã giảm giá — 28px card */}
      <div className="bg-white rounded-[28px] p-6 shadow-card-custom">
        <h2 className="font-semibold text-sm text-[#000000] tracking-[-0.031em] mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#787574]" />
          <span>Mã giảm giá / Voucher</span>
        </h2>

        {appliedCoupon ? (
          <div className="flex items-center justify-between p-3 bg-[#f2f4f5] rounded-full">
            <div className="flex items-center gap-2 pl-2">
              <Check className="w-4 h-4 text-[#000000]" />
              <div>
                <span className="font-semibold text-xs tracking-[-0.014em] text-[#000000]">{appliedCoupon.code}</span>
                <span className="text-xs text-[#787574] ml-2 tracking-[-0.017em]">
                  (Giảm {formatVND(totals.discountAmount)})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="p-1.5 text-[#787574] hover:text-red-500 rounded-full hover:bg-white transition"
              title="Hủy mã"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập mã ưu đãi..."
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-2 rounded-full border border-[#000000]/10 bg-white uppercase text-xs font-medium text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 tracking-wider"
            />
            <button
              type="button"
              disabled={applyingCoupon || !couponCodeInput.trim()}
              onClick={handleApplyCoupon}
              className="bg-[#000000] text-white px-5 py-2 rounded-full text-xs font-medium hover:bg-[#332f2d] disabled:opacity-40 transition tracking-[-0.014em]"
            >
              {applyingCoupon ? 'Đang kiểm tra...' : 'Áp dụng'}
            </button>
          </div>
        )}
      </div>

      {/* Chi tiết thanh toán */}
      <div className="bg-white rounded-[28px] p-6 space-y-2.5 shadow-card-custom">
        <div className="flex justify-between text-xs text-[#787574] tracking-[-0.014em]">
          <span>Tiền hàng:</span>
          <span className="font-medium text-[#000000]">{formatVND(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-[#787574] tracking-[-0.014em]">
          <span>Phí vận chuyển:</span>
          <span className="font-medium text-[#000000]">{totals.shippingFee === 0 ? 'Miễn phí' : formatVND(totals.shippingFee)}</span>
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex justify-between text-xs text-[#000000] font-medium tracking-[-0.014em]">
            <span>Giảm giá:</span>
            <span>-{formatVND(totals.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-[#000000] pt-2.5 border-t border-[#ebebeb] tracking-[-0.05em]">
          <span>Tổng thanh toán:</span>
          <span className="text-lg">{formatVND(totals.totalAmount)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#5433eb] hover:bg-[#4428d4] text-white font-medium py-3.5 px-6 rounded-full transition shadow-violet-custom disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-[-0.014em]"
      >
        <span>{loading ? 'Đang khởi tạo mã thanh toán...' : `Tạo mã QR & Thanh toán ${formatVND(totals.totalAmount)}`}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
