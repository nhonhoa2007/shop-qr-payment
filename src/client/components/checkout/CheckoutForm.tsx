'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@client/stores/cart-store';
import { formatVND } from '@shared/utils';
import { getErrorMessage } from '@/lib/errors';
import {
  Tag,
  Check,
  X,
  ArrowRight,
  Truck,
  MapPin,
  Loader2,
  QrCode,
  CreditCard,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { VIETNAM_LOCATIONS } from '@/lib/vietnam-locations';

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

type PaymentMethodType = 'VIETQR' | 'PAYOS' | 'WALLET';

export function CheckoutForm({ initialName = '', initialEmail = '' }: CheckoutFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const items = useCartStore((s) => s.items);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);
  const clearCart = useCartStore((s) => s.clearCart);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('VIETQR');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Address location state
  const [selectedProvinceId, setSelectedProvinceId] = useState('hcm');
  const [selectedDistrictId, setSelectedDistrictId] = useState(1442);
  const [selectedWardCode, setSelectedWardCode] = useState('20101');
  const [specificAddress, setSpecificAddress] = useState('');

  // Shipping fee calculation state
  const [shippingFee, setShippingFee] = useState(30_000);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [calculatingShipping, setCalculatingShipping] = useState(false);

  const [form, setForm] = useState({
    customerName: initialName,
    customerPhone: '',
    customerEmail: initialEmail,
    note: '',
  });

  const subtotal = getTotalAmount();

  // Fetch ví nội bộ nếu người dùng đã đăng nhập
  useEffect(() => {
    if (session?.user?.id) {
      let ignore = false;
      fetch('/api/wallet')
        .then((res) => res.json())
        .then((data) => {
          if (!ignore && data.success && data.data) {
            setWalletBalance(data.data.balance);
          }
        })
        .catch(() => {});

      return () => {
        ignore = true;
      };
    }
  }, [session?.user?.id]);

  // Location helpers
  const currentProvince = useMemo(
    () => VIETNAM_LOCATIONS.find((p) => p.id === selectedProvinceId) || VIETNAM_LOCATIONS[0],
    [selectedProvinceId]
  );
  const districts = currentProvince.districts;
  const currentDistrict = useMemo(
    () => districts.find((d) => d.id === selectedDistrictId) || districts[0],
    [districts, selectedDistrictId]
  );
  const wards = currentDistrict.wards;
  const currentWard = useMemo(
    () => wards.find((w) => w.code === selectedWardCode) || wards[0],
    [wards, selectedWardCode]
  );

  // Estimate total package weight
  const estimatedWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + 300 * item.quantity, 0) || 500;
  }, [items]);

  // Auto-calculate dynamic GHN shipping fee
  useEffect(() => {
    let ignore = false;

    fetch('/api/shipping/fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toDistrictId: selectedDistrictId,
        toWardCode: selectedWardCode,
        subtotal,
        weight: estimatedWeight,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success && data.data) {
          setShippingFee(data.data.totalFee);
          setIsFreeShipping(data.data.isFreeShipping);
          setCalculatingShipping(false);
        }
      })
      .catch((err) => {
        console.warn('Lỗi tính phí GHN:', err);
        if (!ignore) setCalculatingShipping(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedDistrictId, selectedWardCode, subtotal, estimatedWeight]);

  // Handle province change
  const handleProvinceChange = (provinceId: string) => {
    setCalculatingShipping(true);
    setSelectedProvinceId(provinceId);
    const prov = VIETNAM_LOCATIONS.find((p) => p.id === provinceId) || VIETNAM_LOCATIONS[0];
    const firstDist = prov.districts[0];
    if (firstDist) {
      setSelectedDistrictId(firstDist.id);
      if (firstDist.wards[0]) {
        setSelectedWardCode(firstDist.wards[0].code);
      }
    }
  };

  // Handle district change
  const handleDistrictChange = (districtId: number) => {
    setCalculatingShipping(true);
    setSelectedDistrictId(districtId);
    const dist = districts.find((d) => d.id === districtId);
    if (dist && dist.wards[0]) {
      setSelectedWardCode(dist.wards[0].code);
    }
  };

  // Handle ward change
  const handleWardChange = (wardCode: string) => {
    setCalculatingShipping(true);
    setSelectedWardCode(wardCode);
  };

  // Calculate discount & totals
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === 'FIXED') {
      return Math.min(appliedCoupon.discountValue, subtotal);
    }
    if (appliedCoupon.discountType === 'PERCENTAGE') {
      const raw = Math.round((subtotal * appliedCoupon.discountValue) / 100);
      return appliedCoupon.maxDiscount ? Math.min(raw, appliedCoupon.maxDiscount) : raw;
    }
    return 0;
  }, [appliedCoupon, subtotal]);

  const effectiveShippingFee = isFreeShipping || subtotal >= 500_000 ? 0 : shippingFee;
  const finalTotalAmount = Math.max(0, subtotal + effectiveShippingFee - discountAmount);

  // Kiểm tra số dư ví có đủ thanh toán đơn hàng không
  const isWalletEligible = session?.user?.id && walletBalance !== null && walletBalance >= finalTotalAmount;

  // Full formatted customer address
  const fullAddress = useMemo(() => {
    const parts = [
      specificAddress.trim(),
      currentWard?.name,
      currentDistrict?.name,
      currentProvince?.name,
    ].filter(Boolean);
    return parts.join(', ');
  }, [specificAddress, currentWard, currentDistrict, currentProvince]);

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

    if (!specificAddress.trim()) {
      setError('Vui lòng nhập địa chỉ cụ thể (Số nhà, tên đường)');
      return;
    }

    if (paymentMethod === 'WALLET' && !isWalletEligible) {
      setError('Số dư ví không đủ để thanh toán đơn hàng');
      return;
    }

    setLoading(true);
    try {
      // 1. Tạo đơn hàng cơ sở
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail || undefined,
          customerAddress: fullAddress,
          note: form.note || undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId || undefined,
            quantity: i.quantity,
          })),
        }),
      });

      const data = (await res.json()) as CreateOrderResponse;
      if (!res.ok || !data.orderId) {
        throw new Error(data.error || 'Lỗi tạo đơn hàng');
      }

      // 2. Phân nhánh xử lý theo phương thức thanh toán đã chọn
      if (paymentMethod === 'WALLET') {
        const payRes = await fetch('/api/wallet/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        const payData = await payRes.json();
        if (!payRes.ok || !payData.success) {
          throw new Error(payData.error || 'Thanh toán bằng ví thất bại');
        }

        toast.success('Thanh toán bằng Ví Shop thành công! Đơn hàng đã được xác nhận.');
        clearCart();
        router.push(`/payment/${data.orderId}`);
        return;
      }

      if (paymentMethod === 'PAYOS') {
        const linkRes = await fetch('/api/payment/payos/create-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        const linkData = await linkRes.json();
        if (linkRes.ok && linkData.data?.checkoutUrl) {
          toast.success('Đang chuyển hướng sang cổng thanh toán PayOS...');
          clearCart();
          router.push(linkData.data.checkoutUrl);
          return;
        }
      }

      // Mặc định: Chuyển sang trang hiển thị VietQR (Casso)
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

      {/* Thông tin người nhận — 28px card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card-custom">
        <h2 className="font-semibold text-base text-[#000000] tracking-[-0.031em] mb-6">
          Thông tin người nhận
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
                Email nhận hóa đơn & mã vận đơn
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
        </div>
      </div>

      {/* Địa chỉ giao hàng & Cước phí GHN — 28px card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card-custom">
        <h2 className="font-semibold text-base text-[#000000] tracking-[-0.031em] mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#5433eb]" />
          <span>Địa chỉ giao hàng & Cước phí GHN</span>
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tỉnh / Thành */}
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Tỉnh / Thành phố *
              </label>
              <select
                value={selectedProvinceId}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs font-medium text-[#000000] focus:outline-none focus:border-[#5433eb]/40 transition"
              >
                {VIETNAM_LOCATIONS.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quận / Huyện */}
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Quận / Huyện *
              </label>
              <select
                value={selectedDistrictId}
                onChange={(e) => handleDistrictChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs font-medium text-[#000000] focus:outline-none focus:border-[#5433eb]/40 transition"
              >
                {districts.map((dist) => (
                  <option key={dist.id} value={dist.id}>
                    {dist.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Phường / Xã */}
            <div>
              <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
                Phường / Xã *
              </label>
              <select
                value={selectedWardCode}
                onChange={(e) => handleWardChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-full border border-[#000000]/10 bg-white text-xs font-medium text-[#000000] focus:outline-none focus:border-[#5433eb]/40 transition"
              >
                {wards.map((ward) => (
                  <option key={ward.code} value={ward.code}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
              Số nhà, tên đường cụ thể *
            </label>
            <input
              type="text"
              required
              value={specificAddress}
              onChange={(e) => setSpecificAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full border border-[#000000]/10 bg-white text-sm text-[#000000] placeholder:text-[#787574] focus:outline-none focus:border-[#5433eb]/40 transition tracking-[-0.014em]"
              placeholder="Ví dụ: 123 Lê Lợi, Tòa nhà Bitexco..."
            />
          </div>

          {/* GHN Shipping Live Status Box */}
          <div className="bg-[#f8f9fa] border border-[#ebebeb] rounded-[20px] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ff6b00]/10 text-[#ff6b00] flex items-center justify-center font-bold text-xs">
                GHN
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[#000000]">Giao Hàng Nhanh (GHN Express)</span>
                  <span className="bg-[#5433eb]/10 text-[#5433eb] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Tự động tạo vận đơn
                  </span>
                </div>
                <p className="text-[11px] text-[#787574] mt-0.5">Dự kiến giao: 1 - 3 ngày làm việc</p>
              </div>
            </div>

            <div className="text-right">
              {calculatingShipping ? (
                <div className="flex items-center gap-1.5 text-xs text-[#787574]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5433eb]" />
                  <span>Đang tính cước...</span>
                </div>
              ) : effectiveShippingFee === 0 ? (
                <div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    Miễn phí vận chuyển
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-semibold text-[#000000]">{formatVND(effectiveShippingFee)}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#787574] mb-1 tracking-[-0.014em]">
              Ghi chú cho Shipper
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

      {/* Phương thức thanh toán — 28px card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card-custom space-y-4">
        <h2 className="font-semibold text-base text-[#000000] tracking-[-0.031em] flex items-center justify-between">
          <span>Phương thức thanh toán</span>
          <span className="text-xs font-normal text-[#787574]">Chọn 1 trong 3 kênh</span>
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {/* Option 1: VietQR Casso */}
          <label
            onClick={() => setPaymentMethod('VIETQR')}
            className={`flex items-start gap-4 p-4 rounded-[20px] border-2 cursor-pointer transition ${
              paymentMethod === 'VIETQR'
                ? 'border-[#5433eb] bg-[#5433eb]/5 ring-2 ring-[#5433eb]/10'
                : 'border-gray-100 bg-[#f8f9fa] hover:border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === 'VIETQR'}
              onChange={() => setPaymentMethod('VIETQR')}
              className="mt-1 accent-[#5433eb]"
            />
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-900">Chuyển khoản VietQR (Casso)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Phổ biến nhất
                </span>
              </div>
              <p className="text-[11px] text-[#787574] mt-0.5 leading-relaxed">
                Quét mã QR động qua ứng dụng mọi ngân hàng hoặc ví điện tử (MoMo, ZaloPay, Vietcombank, Techcombank...)
              </p>
            </div>
            {paymentMethod === 'VIETQR' && <CheckCircle2 className="w-5 h-5 text-[#5433eb] shrink-0" />}
          </label>

          {/* Option 2: PayOS */}
          <label
            onClick={() => setPaymentMethod('PAYOS')}
            className={`flex items-start gap-4 p-4 rounded-[20px] border-2 cursor-pointer transition ${
              paymentMethod === 'PAYOS'
                ? 'border-[#5433eb] bg-[#5433eb]/5 ring-2 ring-[#5433eb]/10'
                : 'border-gray-100 bg-[#f8f9fa] hover:border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === 'PAYOS'}
              onChange={() => setPaymentMethod('PAYOS')}
              className="mt-1 accent-[#5433eb]"
            />
            <div className="w-10 h-10 rounded-xl bg-[#003B95]/10 text-[#003B95] flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-900">Cổng thanh toán PayOS</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Napas 247 & Thẻ ATM
                </span>
              </div>
              <p className="text-[11px] text-[#787574] mt-0.5 leading-relaxed">
                Cổng thanh toán chính thức bảo mật HMAC-SHA256, tự sinh liên kết thanh toán và kiểm tra chữ ký tự động
              </p>
            </div>
            {paymentMethod === 'PAYOS' && <CheckCircle2 className="w-5 h-5 text-[#5433eb] shrink-0" />}
          </label>

          {/* Option 3: Ví nội bộ Shop Wallet */}
          <label
            onClick={() => {
              if (isWalletEligible) setPaymentMethod('WALLET');
            }}
            className={`flex items-start gap-4 p-4 rounded-[20px] border-2 transition ${
              !session?.user?.id || !isWalletEligible
                ? 'opacity-60 cursor-not-allowed border-gray-100 bg-[#f8f9fa]'
                : paymentMethod === 'WALLET'
                ? 'border-[#5433eb] bg-[#5433eb]/5 ring-2 ring-[#5433eb]/10 cursor-pointer'
                : 'border-gray-100 bg-[#f8f9fa] hover:border-gray-200 cursor-pointer'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              disabled={!isWalletEligible}
              checked={paymentMethod === 'WALLET'}
              onChange={() => {
                if (isWalletEligible) setPaymentMethod('WALLET');
              }}
              className="mt-1 accent-[#5433eb]"
            />
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5433eb] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-900">Ví Shop nội bộ (Shop Wallet)</span>
                {session?.user?.id ? (
                  isWalletEligible ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Khả dụng ({formatVND(walletBalance || 0)})
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      Số dư không đủ ({formatVND(walletBalance || 0)})
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                    Cần đăng nhập
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#787574] mt-0.5 leading-relaxed">
                {session?.user?.id
                  ? isWalletEligible
                    ? 'Thanh toán trừ tiền tức thì 1-chạm mà không cần quét mã QR'
                    : `Số dư ví hiện có ${formatVND(walletBalance || 0)}, cần ${formatVND(finalTotalAmount)} để thanh toán.`
                  : 'Vui lòng đăng nhập tài khoản để thanh toán hoặc nhận tiền hoàn từ ví Shop.'}
              </p>
            </div>
            {paymentMethod === 'WALLET' && <CheckCircle2 className="w-5 h-5 text-[#5433eb] shrink-0" />}
          </label>
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
                  (Giảm {formatVND(discountAmount)})
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
          <span className="font-medium text-[#000000]">{formatVND(subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-[#787574] tracking-[-0.014em]">
          <span>Phí vận chuyển GHN:</span>
          <span className="font-medium text-[#000000]">
            {effectiveShippingFee === 0 ? 'Miễn phí' : formatVND(effectiveShippingFee)}
          </span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs text-[#000000] font-medium tracking-[-0.014em]">
            <span>Giảm giá:</span>
            <span>-{formatVND(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-[#000000] pt-2.5 border-t border-[#ebebeb] tracking-[-0.05em]">
          <span>Tổng thanh toán:</span>
          <span className="text-lg">{formatVND(finalTotalAmount)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#5433eb] hover:bg-[#4428d4] text-white font-medium py-3.5 px-6 rounded-full transition shadow-violet-custom disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-[-0.014em]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang xử lý thanh toán...</span>
          </>
        ) : paymentMethod === 'WALLET' ? (
          <>
            <Wallet className="w-4 h-4" />
            <span>Thanh toán bằng Ví Shop ({formatVND(finalTotalAmount)})</span>
            <ArrowRight className="w-4 h-4" />
          </>
        ) : paymentMethod === 'PAYOS' ? (
          <>
            <CreditCard className="w-4 h-4" />
            <span>Chuyển sang Cổng PayOS ({formatVND(finalTotalAmount)})</span>
            <ArrowRight className="w-4 h-4" />
          </>
        ) : (
          <>
            <Truck className="w-4 h-4" />
            <span>Tạo mã QR & Thanh toán ({formatVND(finalTotalAmount)})</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
