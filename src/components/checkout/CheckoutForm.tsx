'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/cart-store';
import { formatVND } from '@/lib/utils';
import { calculateCheckoutTotalsWithCoupon } from '@/lib/checkout';
import { getErrorMessage } from '@/lib/errors';
import { Tag, Check, X } from 'lucide-react';
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-shake">
          {error}
        </div>
      )}

      {/* Thông tin giao hàng */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h2 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
          <span>📍</span>
          <span>Thông tin giao nhận hàng</span>
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên người nhận *</label>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại liên hệ *</label>
              <input
                type="tel"
                required
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                placeholder="0912345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email nhận hóa đơn</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ chi tiết nhận hàng *</label>
            <textarea
              required
              rows={3}
              value={form.customerAddress}
              onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
              placeholder="Số nhà, ngõ/ngách, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú cho người bán / shipper</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
              placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
            />
          </div>
        </div>
      </div>

      {/* Áp dụng Mã giảm giá (Coupon / Voucher) */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-base text-gray-900 mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-600" />
          <span>Mã giảm giá / Voucher</span>
        </h2>

        {appliedCoupon ? (
          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="font-bold text-emerald-800 text-sm tracking-wide">{appliedCoupon.code}</span>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Đã giảm {formatVND(totals.discountAmount)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition"
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
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl uppercase text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="button"
              disabled={applyingCoupon || !couponCodeInput.trim()}
              onClick={handleApplyCoupon}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {applyingCoupon ? 'Đang kiểm tra...' : 'Áp dụng'}
            </button>
          </div>
        )}
      </div>

      {/* Chi tiết thanh toán */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-2.5 border border-gray-100">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Tiền hàng:</span>
          <span>{formatVND(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Phí vận chuyển:</span>
          <span>{totals.shippingFee === 0 ? <strong className="text-green-600">Miễn phí</strong> : formatVND(totals.shippingFee)}</span>
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-emerald-600 font-medium">
            <span>Giảm giá khuyến mại:</span>
            <span>-{formatVND(totals.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-gray-900 pt-2.5 border-t border-gray-200">
          <span>Tổng thanh toán:</span>
          <span className="text-xl text-blue-600">{formatVND(totals.totalAmount)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
      >
        <span>📱</span>
        <span>{loading ? 'Đang khởi tạo mã thanh toán...' : `Tạo mã QR & Thanh toán ${formatVND(totals.totalAmount)}`}</span>
      </button>
    </form>
  );
}
