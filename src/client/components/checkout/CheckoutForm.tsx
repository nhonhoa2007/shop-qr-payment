'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@client/stores/cart-store';
import { formatVND } from '@shared/utils';
import { calculateDiscount } from '@shared/utils/checkout';
import { getErrorMessage } from '@shared/errors';
import {
  Tag,
  Check,
  X,
  ArrowRight,
  Truck,
  MapPin,
  Loader2,
  QrCode,
  Wallet,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { VIETNAM_LOCATIONS } from '@shared/constants/vietnam-locations';
import {
  classifyLocationAccuracy,
  formatAccuracy,
  isBetterLocationSample,
  type DeviceLocationSample,
  type LocationQuality,
} from '@client/lib/geolocation';

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

type PaymentMethodType = 'VIETQR' | 'WALLET';
type LocationMatchLevel = 'NONE' | 'PROVINCE' | 'DISTRICT' | 'WARD';

interface ReverseGeocodeSuggestion {
  provinceId: string | null;
  provinceName: string | null;
  districtId: number | null;
  districtName: string | null;
  wardCode: string | null;
  wardName: string | null;
  specificAddress: string;
  fullDisplayName: string;
  matchLevel: LocationMatchLevel;
  isMatched: boolean;
}

interface DetectedLocationState {
  label: string;
  accuracy: number;
  quality: LocationQuality;
  matchLevel: LocationMatchLevel;
}

const LOCATION_COLLECTION_MS = 10_000;
const LOCATION_REQUEST_TIMEOUT_MS = 20_000;

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
  const [walletFetchFailed, setWalletFetchFailed] = useState(false);

  // Address location state
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState(0);
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [specificAddress, setSpecificAddress] = useState('');

  // Geolocation only provides an editable suggestion; user-confirmed fields remain authoritative.
  const [locating, setLocating] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocationState | null>(null);
  const locationRunRef = useRef(0);
  const locationWatchRef = useRef<number | null>(null);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationAbortRef = useRef<AbortController | null>(null);
  const addressRevisionRef = useRef(0);

  // Shipping fee calculation state
  const [shippingFee, setShippingFee] = useState(0);
  const [quotedSubtotal, setQuotedSubtotal] = useState<number | null>(null);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [settledQuoteKey, setSettledQuoteKey] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: initialName,
    customerPhone: '',
    customerEmail: initialEmail,
    note: '',
  });

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
        .catch(() => {
          if (!ignore) setWalletFetchFailed(true);
        });

      return () => {
        ignore = true;
      };
    }
  }, [session?.user?.id]);

  // Location helpers — no implicit fallback to the first location in the dataset.
  const currentProvince = useMemo(
    () => VIETNAM_LOCATIONS.find((province) => province.id === selectedProvinceId) ?? null,
    [selectedProvinceId]
  );
  const districts = useMemo(() => currentProvince?.districts ?? [], [currentProvince]);
  const currentDistrict = useMemo(
    () => districts.find((district) => district.id === selectedDistrictId) ?? null,
    [districts, selectedDistrictId]
  );
  const wards = useMemo(() => currentDistrict?.wards ?? [], [currentDistrict]);
  const currentWard = useMemo(
    () => wards.find((ward) => ward.code === selectedWardCode) ?? null,
    [wards, selectedWardCode]
  );
  const destinationReady = Boolean(currentProvince && currentDistrict && currentWard);

  const quoteKey = JSON.stringify({ toDistrictId: selectedDistrictId, toWardCode: selectedWardCode, items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })) });
  const quoteReady = destinationReady && settledQuoteKey === quoteKey;
  const subtotal = quoteReady && quotedSubtotal !== null ? quotedSubtotal : getTotalAmount();
  const calculatingShipping = destinationReady && !quoteReady;

  // Auto-calculate dynamic GHN shipping fee only after the full hierarchy is valid.
  useEffect(() => {
    if (!destinationReady) return;

    let ignore = false;
    fetch('/api/shipping/fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: quoteKey,
    })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Không thể tính phí GHN'); return data; })
      .then((data) => {
        if (!ignore && data.success && data.data) {
          setShippingFee(data.data.totalFee);
          setQuotedSubtotal(data.data.subtotal);
          setIsFreeShipping(data.data.isFreeShipping);
          setSettledQuoteKey(quoteKey);
          setError('');
        }
      })
      .catch((err) => {
        console.warn('Lỗi tính phí GHN:', err);
        if (!ignore) { setSettledQuoteKey(null); setError(err instanceof Error ? err.message : 'Không thể tính phí GHN'); }
      });

    return () => { ignore = true; };
  }, [destinationReady, quoteKey]);

  useEffect(() => () => {
    locationRunRef.current += 1;
    if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    locationAbortRef.current?.abort();
  }, []);

  const markAddressEdited = () => {
    addressRevisionRef.current += 1;
    setDetectedLocation(null);
  };

  const handleProvinceChange = (provinceId: string) => {
    markAddressEdited();
    setSelectedProvinceId(provinceId);
    setSelectedDistrictId(0);
    setSelectedWardCode('');
  };

  const handleDistrictChange = (districtId: number) => {
    markAddressEdited();
    setSelectedDistrictId(districtId);
    setSelectedWardCode('');
  };

  const handleWardChange = (wardCode: string) => {
    markAddressEdited();
    setSelectedWardCode(wardCode);
  };

  const applyDetectedLocation = (
    data: ReverseGeocodeSuggestion,
    sample: DeviceLocationSample,
    startRevision: number
  ) => {
    if (addressRevisionRef.current !== startRevision) {
      toast.info('Bạn đã sửa địa chỉ trong lúc định vị nên gợi ý mới không được áp dụng.');
      return;
    }

    const province = data.provinceId
      ? VIETNAM_LOCATIONS.find((item) => item.id === data.provinceId) ?? null
      : null;
    const district = province && data.districtId
      ? province.districts.find((item) => item.id === data.districtId) ?? null
      : null;
    const ward = district && data.wardCode
      ? district.wards.find((item) => item.code === data.wardCode) ?? null
      : null;

    const hierarchyChanged = Boolean(
      province && (
        province.id !== selectedProvinceId ||
        (district?.id ?? 0) !== selectedDistrictId ||
        (ward?.code ?? '') !== selectedWardCode
      )
    );
    const detectedSpecificAddress = data.specificAddress.trim();

    if (province) {
      setSelectedProvinceId(province.id);
      setSelectedDistrictId(district?.id ?? 0);
      setSelectedWardCode(ward?.code ?? '');

      // Không giữ số nhà cũ khi địa giới đổi. Nếu provider không có số nhà/đường,
      // để trống để người dùng bắt buộc xác nhận thay vì ghép hai địa chỉ khác nhau.
      if (hierarchyChanged) setSpecificAddress(detectedSpecificAddress);
      else if (detectedSpecificAddress) setSpecificAddress(detectedSpecificAddress);
    }
    // Không áp địa chỉ đường khi chưa khớp được tỉnh: tránh ghép với địa giới cũ.

    const quality = classifyLocationAccuracy(sample.accuracy);
    const label = data.fullDisplayName || [data.wardName, data.districtName, data.provinceName].filter(Boolean).join(', ');
    setDetectedLocation({
      label: label || 'Đã nhận tọa độ nhưng chưa nhận diện được địa chỉ',
      accuracy: sample.accuracy,
      quality,
      matchLevel: data.matchLevel,
    });

    if (data.matchLevel === 'WARD') {
      toast.success('Đã điền địa chỉ gợi ý. Vui lòng kiểm tra trước khi đặt hàng.');
    } else {
      toast.info('Chỉ nhận diện được một phần khu vực. Vui lòng chọn các mục còn thiếu.');
    }
  };

  const handleLocateCurrentPosition = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      toast.error('Trình duyệt không hỗ trợ định vị. Vui lòng chọn địa chỉ thủ công.');
      return;
    }

    const runId = ++locationRunRef.current;
    const startRevision = addressRevisionRef.current;
    let bestSample: DeviceLocationSample | null = null;
    let completed = false;

    if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    locationAbortRef.current?.abort();
    setLocating(true);
    setDetectedLocation(null);

    const cleanup = () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      if (locationTimerRef.current) {
        clearTimeout(locationTimerRef.current);
        locationTimerRef.current = null;
      }
    };

    const reverseBestSample = async () => {
      if (completed || runId !== locationRunRef.current) return;
      completed = true;
      cleanup();

      if (!bestSample) {
        setLocating(false);
        toast.error('Không lấy được vị trí thiết bị. Vui lòng chọn địa chỉ thủ công.');
        return;
      }

      const sample: DeviceLocationSample = bestSample;
      const quality = classifyLocationAccuracy(sample.accuracy);
      if (quality === 'UNRELIABLE') {
        setDetectedLocation({
          label: 'Vị trí thiết bị chưa đủ chính xác để điền địa chỉ',
          accuracy: sample.accuracy,
          quality,
          matchLevel: 'NONE',
        });
        setLocating(false);
        toast.info('Vị trí sai lệch quá lớn. Vui lòng chọn địa chỉ thủ công.');
        return;
      }

      const controller = new AbortController();
      locationAbortRef.current = controller;
      const requestTimeout = setTimeout(() => controller.abort(), LOCATION_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch('/api/shipping/geocode/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: sample.latitude,
            longitude: sample.longitude,
            accuracy: sample.accuracy,
          }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'Không thể phân tích vị trí');
        }
        if (runId === locationRunRef.current) {
          applyDetectedLocation(result.data as ReverseGeocodeSuggestion, sample, startRevision);
        }
      } catch (err) {
        if (runId === locationRunRef.current && !(err instanceof DOMException && err.name === 'AbortError')) {
          toast.error(err instanceof Error ? err.message : 'Không thể phân tích vị trí.');
        } else if (runId === locationRunRef.current) {
          toast.error('Phân tích vị trí quá thời gian. Vui lòng thử lại.');
        }
      } finally {
        clearTimeout(requestTimeout);
        if (runId === locationRunRef.current) {
          locationAbortRef.current = null;
          setLocating(false);
        }
      }
    };

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (completed || runId !== locationRunRef.current) return;
        const sample: DeviceLocationSample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        if (isBetterLocationSample(sample, bestSample)) bestSample = sample;
        if (classifyLocationAccuracy(sample.accuracy) === 'PRECISE') void reverseBestSample();
      },
      (geoError) => {
        if (completed || runId !== locationRunRef.current) return;
        completed = true;
        cleanup();
        setLocating(false);
        const message = geoError.code === geoError.PERMISSION_DENIED
          ? 'Quyền vị trí đã bị từ chối. Vui lòng chọn địa chỉ thủ công.'
          : 'Không lấy được vị trí thiết bị. Vui lòng chọn địa chỉ thủ công.';
        toast.error(message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATION_REQUEST_TIMEOUT_MS }
    );

    locationTimerRef.current = setTimeout(() => void reverseBestSample(), LOCATION_COLLECTION_MS);
  };

  // Calculate discount & totals
  const effectiveShippingFee = isFreeShipping || subtotal >= 500_000 ? 0 : shippingFee;
  const discountAmount = appliedCoupon ? calculateDiscount(appliedCoupon, subtotal, effectiveShippingFee) : 0;
  const finalTotalAmount = Math.max(0, subtotal + effectiveShippingFee - discountAmount);

  // Kiểm tra số dư ví có đủ thanh toán đơn hàng không
  const isWalletEligible = session?.user?.id && walletBalance !== null && walletBalance >= finalTotalAmount;

  // Full formatted customer address
  const fullAddress = useMemo(() => {
    const parts = [specificAddress.trim(), currentWard?.name, currentDistrict?.name, currentProvince?.name]
      .filter(Boolean);
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
    if (!destinationReady) { setError('Vui lòng chọn đủ tỉnh/thành, quận/huyện và phường/xã.'); return; }
    if (!quoteReady || calculatingShipping) { setError('Chưa lấy được phí GHN. Vui lòng thử chọn lại địa bàn.'); return; }

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
          toDistrictId: selectedDistrictId,
          toWardCode: selectedWardCode,
          quotedShippingFee: effectiveShippingFee,
          quotedSubtotal: subtotal,
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
        if (res.status === 409) {
          const quote = data as CreateOrderResponse & { shippingFee?: number; subtotal?: number };
          if (typeof quote.shippingFee === 'number') { setShippingFee(quote.shippingFee); setIsFreeShipping(quote.shippingFee === 0); }
          if (typeof quote.subtotal === 'number') setQuotedSubtotal(quote.subtotal);
        }
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
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card">
        <h2 className="font-semibold text-base text-ink-black tracking-[-0.031em] mb-6">
          Thông tin người nhận
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="checkout-name"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Họ và tên người nhận *
            </label>
            <input
              id="checkout-name"
              name="customerName"
              type="text"
              required
              autoComplete="name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="checkout-phone"
                className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
              >
                Số điện thoại *
              </label>
              <input
                id="checkout-phone"
                name="customerPhone"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
                placeholder="0912345678"
              />
            </div>

            <div>
              <label
                htmlFor="checkout-email"
                className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
              >
                Email nhận hóa đơn & mã vận đơn
              </label>
              <input
                id="checkout-email"
                name="customerEmail"
                type="email"
                autoComplete="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
                placeholder="email@example.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Địa chỉ giao hàng & Cước phí GHN — 28px card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-base text-ink-black tracking-[-0.031em] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-shop-violet" />
            <span>Địa chỉ giao hàng & Cước phí GHN</span>
          </h2>

          <button
            type="button"
            onClick={handleLocateCurrentPosition}
            disabled={locating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-shop-violet/10 text-shop-violet hover:bg-shop-violet/15 active:scale-95 transition disabled:opacity-50 self-start sm:self-auto cursor-pointer shadow-soft-sm"
            title="Lấy vị trí hiện tại để gợi ý địa chỉ"
          >
            {locating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang định vị GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 fill-shop-violet/20" />
                <span>Gợi ý từ vị trí hiện tại</span>
              </>
            )}
          </button>
        </div>

        {detectedLocation && (
          <div className={`mb-4 rounded-[18px] p-3 flex items-start gap-2.5 text-xs animate-fadeIn border ${
            detectedLocation.quality === 'UNRELIABLE'
              ? 'bg-amber-50 border-amber-200/70 text-amber-900'
              : 'bg-emerald-50 border-emerald-200/70 text-emerald-900'
          }`}>
            <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
              detectedLocation.quality === 'UNRELIABLE' ? 'text-amber-600' : 'text-emerald-600'
            }`} />
            <div className="flex-1 min-w-0">
              <span className="font-semibold block mb-0.5">
                {detectedLocation.matchLevel === 'WARD' ? 'Địa chỉ gợi ý — cần kiểm tra' : 'Vị trí chỉ mang tính ước lượng'}
              </span>
              <span className="leading-relaxed block">{detectedLocation.label}</span>
              <span className="block mt-1 opacity-80">
                Sai lệch thiết bị: {formatAccuracy(detectedLocation.accuracy)}. Vui lòng xác nhận số nhà và khu vực bên dưới.
              </span>
            </div>
            <button
              type="button"
              onClick={handleLocateCurrentPosition}
              disabled={locating}
              className="text-[11px] font-medium underline flex-shrink-0 cursor-pointer disabled:opacity-50"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tỉnh / Thành */}
            <div>
              <label
                htmlFor="checkout-province"
                className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
              >
                Tỉnh / Thành phố *
              </label>
              <select
                id="checkout-province"
                required
                value={selectedProvinceId}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs font-medium text-ink-black focus:outline-none focus:border-shop-violet/40 transition"
              >
                <option value="">Chọn tỉnh / thành phố</option>
                {VIETNAM_LOCATIONS.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quận / Huyện */}
            <div>
              <label
                htmlFor="checkout-district"
                className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
              >
                Quận / Huyện *
              </label>
              <select
                id="checkout-district"
                required
                disabled={!currentProvince}
                value={selectedDistrictId || ''}
                onChange={(e) => handleDistrictChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs font-medium text-ink-black focus:outline-none focus:border-shop-violet/40 transition disabled:bg-gray-50 disabled:text-muted-gray"
              >
                <option value="">Chọn quận / huyện</option>
                {districts.map((dist) => (
                  <option key={dist.id} value={dist.id}>
                    {dist.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Phường / Xã */}
            <div>
              <label
                htmlFor="checkout-ward"
                className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
              >
                Phường / Xã *
              </label>
              <select
                id="checkout-ward"
                required
                disabled={!currentDistrict || wards.length === 0}
                value={selectedWardCode}
                onChange={(e) => handleWardChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-full border border-ink-black/10 bg-white text-xs font-medium text-ink-black focus:outline-none focus:border-shop-violet/40 transition disabled:bg-gray-50 disabled:text-muted-gray"
              >
                <option value="">{currentDistrict && wards.length === 0 ? 'Khu vực chưa có dữ liệu GHN' : 'Chọn phường / xã'}</option>
                {wards.map((ward) => (
                  <option key={ward.code} value={ward.code}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="checkout-address"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Số nhà, tên đường cụ thể *
            </label>
            <input
              id="checkout-address"
              name="specificAddress"
              type="text"
              required
              autoComplete="street-address"
              value={specificAddress}
              onChange={(e) => {
                markAddressEdited();
                setSpecificAddress(e.target.value);
              }}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="Ví dụ: 123 Lê Lợi, Tòa nhà Bitexco..."
            />
          </div>

          {/* GHN Shipping Live Status Box */}
          <div className="bg-canvas-mist border border-faint-border rounded-[20px] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ff6b00]/10 text-[#ff6b00] flex items-center justify-center font-bold text-xs">
                GHN
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-ink-black">Giao Hàng Nhanh (GHN Express)</span>
                  <span className="bg-shop-violet/10 text-shop-violet text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Tự động tạo vận đơn
                  </span>
                </div>
                <p className="text-[11px] text-muted-gray mt-0.5">Dự kiến giao: 1 - 3 ngày làm việc</p>
              </div>
            </div>

            <div className="text-right">
              {!destinationReady ? (
                <span className="text-[11px] text-muted-gray">Chọn đủ địa bàn</span>
              ) : calculatingShipping ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-gray">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-shop-violet" />
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
                  <span className="text-sm font-semibold text-ink-black">{formatVND(effectiveShippingFee)}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="checkout-note"
              className="block text-xs font-medium text-muted-gray mb-1 tracking-[-0.014em]"
            >
              Ghi chú cho Shipper
            </label>
            <input
              id="checkout-note"
              name="note"
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-ink-black/10 bg-white text-sm text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 transition tracking-[-0.014em]"
              placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
            />
          </div>
        </div>
      </div>

      {/* Phương thức thanh toán — 28px card */}
      <div className="bg-white rounded-[28px] p-6 sm:p-8 shadow-card space-y-4">
        <h2 className="font-semibold text-base text-ink-black tracking-[-0.031em] flex items-center justify-between">
          <span>Phương thức thanh toán</span>
          <span className="text-xs font-normal text-muted-gray">Chọn 1 trong 3 kênh</span>
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {/* Option 1: VietQR Casso */}
          <label
            onClick={() => setPaymentMethod('VIETQR')}
            className={`flex items-start gap-4 p-4 rounded-[20px] border-2 cursor-pointer transition ${
              paymentMethod === 'VIETQR'
                ? 'border-shop-violet bg-shop-violet/5 ring-2 ring-shop-violet/10'
                : 'border-gray-100 bg-canvas-mist hover:border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === 'VIETQR'}
              onChange={() => setPaymentMethod('VIETQR')}
              className="mt-1 accent-shop-violet"
            />
            <div className="w-10 h-10 rounded-xl bg-shop-violet/10 text-shop-violet flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-900">Chuyển khoản VietQR (Casso)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-shop-violet/10 text-shop-violet">
                  Phổ biến nhất
                </span>
              </div>
              <p className="text-[11px] text-muted-gray mt-0.5 leading-relaxed">
                Quét mã QR động qua ứng dụng mọi ngân hàng hoặc ví điện tử (MoMo, ZaloPay, Vietcombank, Techcombank...)
              </p>
            </div>
            {paymentMethod === 'VIETQR' && <CheckCircle2 className="w-5 h-5 text-shop-violet shrink-0" />}
          </label>

          {/* Option 2: Ví nội bộ Shop Wallet */}
          <label
            onClick={() => {
              if (isWalletEligible) setPaymentMethod('WALLET');
            }}
            className={`flex items-start gap-4 p-4 rounded-[20px] border-2 transition ${
              !session?.user?.id || !isWalletEligible
                ? 'opacity-60 cursor-not-allowed border-gray-100 bg-canvas-mist'
                : paymentMethod === 'WALLET'
                ? 'border-shop-violet bg-shop-violet/5 ring-2 ring-shop-violet/10 cursor-pointer'
                : 'border-gray-100 bg-canvas-mist hover:border-gray-200 cursor-pointer'
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
              className="mt-1 accent-shop-violet"
            />
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-shop-violet flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-900">Ví Shop nội bộ (Shop Wallet)</span>
                {walletFetchFailed ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Không kiểm tra được số dư
                  </span>
                ) : session?.user?.id ? (
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
              <p className="text-[11px] text-muted-gray mt-0.5 leading-relaxed">
                {walletFetchFailed
                  ? 'Không tải được số dư ví lúc này. Bạn vẫn có thể thanh toán bằng VietQR hoặc thử tải lại trang.'
                  : session?.user?.id
                  ? isWalletEligible
                    ? 'Thanh toán trừ tiền tức thì 1-chạm mà không cần quét mã QR'
                    : `Số dư ví hiện có ${formatVND(walletBalance || 0)}, cần ${formatVND(finalTotalAmount)} để thanh toán.`
                  : 'Vui lòng đăng nhập tài khoản để thanh toán hoặc nhận tiền hoàn từ ví Shop.'}
              </p>
            </div>
            {paymentMethod === 'WALLET' && <CheckCircle2 className="w-5 h-5 text-shop-violet shrink-0" />}
          </label>
        </div>
      </div>

      {/* Áp dụng Mã giảm giá — 28px card */}
      <div className="bg-white rounded-[28px] p-6 shadow-card">
        <h2 className="font-semibold text-sm text-ink-black tracking-[-0.031em] mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-gray" />
          <span>Mã giảm giá / Voucher</span>
        </h2>

        {appliedCoupon ? (
          <div className="flex items-center justify-between p-3 bg-canvas-mist rounded-full">
            <div className="flex items-center gap-2 pl-2">
              <Check className="w-4 h-4 text-ink-black" />
              <div>
                <span className="font-semibold text-xs tracking-[-0.014em] text-ink-black">{appliedCoupon.code}</span>
                <span className="text-xs text-muted-gray ml-2 tracking-[-0.017em]">
                  (Giảm {formatVND(discountAmount)})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="p-1.5 text-muted-gray hover:text-red-500 rounded-full hover:bg-white transition"
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
              className="flex-1 px-4 py-2 rounded-full border border-ink-black/10 bg-white uppercase text-xs font-medium text-ink-black placeholder:text-muted-gray focus:outline-none focus:border-shop-violet/40 tracking-wider"
            />
            <button
              type="button"
              disabled={applyingCoupon || !couponCodeInput.trim()}
              onClick={handleApplyCoupon}
              className="bg-ink-black text-white px-5 py-2 rounded-full text-xs font-medium hover:bg-slate-ink disabled:opacity-40 transition tracking-[-0.014em]"
            >
              {applyingCoupon ? 'Đang kiểm tra...' : 'Áp dụng'}
            </button>
          </div>
        )}
      </div>

      {/* Chi tiết thanh toán */}
      <div className="bg-white rounded-[28px] p-6 space-y-2.5 shadow-card">
        <div className="flex justify-between text-xs text-muted-gray tracking-[-0.014em]">
          <span>Tiền hàng:</span>
          <span className="font-medium text-ink-black">{formatVND(subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-gray tracking-[-0.014em]">
          <span>Phí vận chuyển GHN:</span>
          <span className="font-medium text-ink-black">
            {effectiveShippingFee === 0 ? 'Miễn phí' : formatVND(effectiveShippingFee)}
          </span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs text-ink-black font-medium tracking-[-0.014em]">
            <span>Giảm giá:</span>
            <span>-{formatVND(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-ink-black pt-2.5 border-t border-faint-border tracking-[-0.05em]">
          <span>Tổng thanh toán:</span>
          <span className="text-lg">{formatVND(finalTotalAmount)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || calculatingShipping || !quoteReady || !destinationReady}
        className="w-full bg-shop-violet hover:bg-shop-violet-deep text-white font-medium py-3.5 px-6 rounded-full transition shadow-violet disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-[-0.014em]"
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
