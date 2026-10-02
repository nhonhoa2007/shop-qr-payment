'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { pusherClient } from '@/lib/pusher-client';
import { formatVND, formatCountdown } from '@shared/utils';
import { toast } from 'sonner';
import {
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  ShieldCheck,
  Zap,
  Sparkles,
  Loader2,
  Building2,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import type { WalletTopupResponse } from '@shared/types';

interface WalletTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onTopupSuccess?: (newBalance: number) => void;
}

type TopupStep = 'SELECT_AMOUNT' | 'QR_PAYMENT' | 'SUCCESS';

const PRESET_AMOUNTS = [
  { value: 100_000, label: '100.000đ', badge: '100k' },
  { value: 200_000, label: '200.000đ', badge: '200k', popular: true },
  { value: 500_000, label: '500.000đ', badge: '500k' },
  { value: 1_000_000, label: '1.000.000đ', badge: '1M' },
];

export function WalletTopupModal({
  isOpen,
  onClose,
  userId,
  userName,
  onTopupSuccess,
}: WalletTopupModalProps) {
  const [step, setStep] = useState<TopupStep>('SELECT_AMOUNT');
  const [selectedAmount, setSelectedAmount] = useState<number>(200_000);
  const [customAmountInput, setCustomAmountInput] = useState<string>('200.000');
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [topupData, setTopupData] = useState<WalletTopupResponse | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    newBalance: number;
    amount: number;
    topupCode: string;
  } | null>(null);

  // Khôi phục trạng thái ban đầu khi đóng modal
  const handleResetAndClose = useCallback(() => {
    setStep('SELECT_AMOUNT');
    setSelectedAmount(200_000);
    setCustomAmountInput('200.000');
    setLoading(false);
    setSimulating(false);
    setTopupData(null);
    setSuccessInfo(null);
    onClose();
  }, [onClose]);

  // Khóa cuộn trang khi modal mở & xử lý phím ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleResetAndClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleResetAndClose]);

  // Bộ đếm lùi thời gian hết hạn mã QR (15 phút)
  useEffect(() => {
    if (step !== 'QR_PAYMENT' || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) {
        toast.error('Phiên nạp tiền đã hết hạn. Vui lòng tạo mã QR mới.');
        setStep('SELECT_AMOUNT');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt]);

  // Lắng nghe sự kiện Pusher thời gian thực & Polling dự phòng
  useEffect(() => {
    if (!userId || step !== 'QR_PAYMENT' || !topupData) return;

    const channel = pusherClient.subscribe(`private-user-${userId}`);

    const handleWalletUpdated = (data: {
      balance: number;
      topupCode?: string;
      topupAmount?: number;
    }) => {
      if (!data.topupCode || data.topupCode === topupData.topupCode) {
        setSuccessInfo({
          newBalance: data.balance,
          amount: data.topupAmount || topupData.amount,
          topupCode: topupData.topupCode,
        });
        setStep('SUCCESS');
        onTopupSuccess?.(data.balance);
        toast.success('Nạp tiền vào ví thành công!');
      }
    };

    const handlePaymentSuccess = (data: {
      topupCode?: string;
      amount?: number;
      type?: string;
    }) => {
      if (!data.topupCode || data.topupCode === topupData.topupCode) {
        fetch('/api/wallet')
          .then((r) => r.json())
          .then((d) => {
            const newBal = d.data?.balance;
            setSuccessInfo({
              newBalance: newBal ?? (data.amount || topupData.amount),
              amount: data.amount || topupData.amount,
              topupCode: topupData.topupCode,
            });
            setStep('SUCCESS');
            if (newBal !== undefined) onTopupSuccess?.(newBal);
            toast.success('Nạp tiền vào ví thành công!');
          })
          .catch(() => {
            setStep('SUCCESS');
          });
      }
    };

    channel.bind('wallet-updated', handleWalletUpdated);
    channel.bind('payment-success', handlePaymentSuccess);

    // Polling dự phòng mỗi 3.5 giây kiểm tra biến động giao dịch
    const pollInterval = setInterval(async () => {
      try {
        const r = await fetch('/api/wallet');
        const d = await r.json();
        if (d.success && d.data) {
          const hasTx = d.data.transactions?.some(
            (tx: { orderId?: string; description?: string }) =>
              tx.orderId === topupData.topupCode ||
              (tx.description && tx.description.includes(topupData.topupCode))
          );
          if (hasTx) {
            setSuccessInfo({
              newBalance: d.data.balance,
              amount: topupData.amount,
              topupCode: topupData.topupCode,
            });
            setStep('SUCCESS');
            onTopupSuccess?.(d.data.balance);
            toast.success('Nạp tiền vào ví thành công!');
          }
        }
      } catch {
        // im lặng bỏ qua lỗi polling
      }
    }, 3500);

    return () => {
      channel.unbind('wallet-updated', handleWalletUpdated);
      channel.unbind('payment-success', handlePaymentSuccess);
      pusherClient.unsubscribe(`private-user-${userId}`);
      clearInterval(pollInterval);
    };
  }, [userId, step, topupData, onTopupSuccess]);

  // Xử lý chọn mốc nạp nhanh
  const handleSelectPreset = (value: number) => {
    setSelectedAmount(value);
    setCustomAmountInput(new Intl.NumberFormat('vi-VN').format(value));
  };

  // Xử lý gõ số tiền tùy chọn
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setSelectedAmount(0);
      setCustomAmountInput('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setSelectedAmount(num);
    setCustomAmountInput(new Intl.NumberFormat('vi-VN').format(num));
  };

  // Tạo phiên nạp tiền và nhận thông tin VietQR PayOS
  const handleCreateTopup = async () => {
    if (selectedAmount < 10_000) {
      toast.error('Số tiền nạp tối thiểu là 10.000đ');
      return;
    }
    if (selectedAmount > 50_000_000) {
      toast.error('Số tiền nạp tối đa là 50.000.000đ cho mỗi lần');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedAmount }),
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || 'Không thể tạo phiên nạp tiền VietQR');
        return;
      }

      setTopupData(json.data);
      const expireTime = Date.now() + 15 * 60 * 1000;
      setExpiresAt(expireTime);
      setTimeLeft(15 * 60 * 1000);
      setStep('QR_PAYMENT');
    } catch {
      toast.error('Lỗi kết nối máy chủ khi tạo mã nạp ví');
    } finally {
      setLoading(false);
    }
  };

  // Sao chép văn bản vào clipboard
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`Đã sao chép ${field}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Không thể sao chép vào bộ nhớ tạm');
    }
  };

  // Mô phỏng thanh toán thành công (Sandbox/Dev helper)
  // Chỉ khả dụng ở môi trường dev — tuyệt đối không gọi webhook thật từ client ở production
  const isDevSandbox = process.env.NODE_ENV === 'development';
  const handleSimulatePayment = async () => {
    if (!topupData || !isDevSandbox) return;
    setSimulating(true);
    try {
      const res = await fetch('/api/webhooks/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '00',
          desc: 'success',
          data: {
            orderCode: topupData.orderCode,
            amount: topupData.amount,
            description: topupData.topupCode,
            reference: topupData.paymentLinkId || `PAYOS_TOPUP_${Date.now()}`,
            paymentLinkId: topupData.paymentLinkId,
          },
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        const newBal = resJson.newBalance;
        setSuccessInfo({
          newBalance: newBal ?? (topupData.amount),
          amount: topupData.amount,
          topupCode: topupData.topupCode,
        });
        setStep('SUCCESS');
        if (newBal !== undefined) onTopupSuccess?.(newBal);
        toast.success('Mô phỏng thanh toán PayOS thành công!');
      } else {
        toast.error(resJson.message || 'Lỗi khi kích hoạt callback PayOS');
      }
    } catch {
      toast.error('Lỗi kết nối mô phỏng');
    } finally {
      setSimulating(false);
    }
  };

  if (!isOpen) return null;

  const isAmountValid = selectedAmount >= 10_000 && selectedAmount <= 50_000_000;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-topup-title"
    >
      {/* Backdrop click handler */}
      <div
        className="fixed inset-0 -z-10"
        onClick={handleResetAndClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-shop-violet to-[#3b1cb8] text-white flex items-center justify-center shadow-md shadow-[#5433eb]/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="wallet-topup-title"
                className="text-base font-bold text-gray-900 tracking-tight"
              >
                {step === 'SELECT_AMOUNT' && 'Nạp tiền vào ví'}
                {step === 'QR_PAYMENT' && 'Quét mã VietQR để nạp'}
                {step === 'SUCCESS' && 'Nạp tiền thành công'}
              </h2>
              <p className="text-[11px] text-gray-500">
                {step === 'SELECT_AMOUNT' && 'Cộng số dư tự động qua VietQR PayOS 24/7'}
                {step === 'QR_PAYMENT' && `Mã giao dịch: ${topupData?.topupCode}`}
                {step === 'SUCCESS' && 'Giao dịch đã được xác nhận nguyên tử'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition active:scale-95"
            aria-label="Đóng modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {/* STEP 1: SELECT AMOUNT */}
          {step === 'SELECT_AMOUNT' && (
            <div className="space-y-5">
              {/* Presets Grid */}
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-2.5">
                  Chọn các mốc nạp nhanh:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_AMOUNTS.map((item) => {
                    const isSelected = selectedAmount === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSelectPreset(item.value)}
                        className={`relative p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-shop-violet/5 border-shop-violet text-shop-violet shadow-sm ring-2 ring-shop-violet/20 font-bold'
                            : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100 text-gray-700 font-medium'
                        }`}
                      >
                        {item.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                            Phổ biến
                          </span>
                        )}
                        <span className="block text-sm sm:text-base font-extrabold tracking-tight">
                          {item.badge}
                        </span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                  Hoặc nhập số tiền tùy chọn:
                </label>
                <div className="relative rounded-2xl border border-gray-200 focus-within:border-shop-violet focus-within:ring-2 focus-within:ring-shop-violet/20 transition bg-white overflow-hidden">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Tối thiểu 10.000"
                    value={customAmountInput}
                    onChange={handleCustomAmountChange}
                    className="w-full px-4 py-3 text-base sm:text-lg font-bold text-gray-900 placeholder:text-gray-400 focus:outline-hidden pr-14"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    VND
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
                  <span>Tối thiểu: 10.000đ</span>
                  <span>Tối đa: 50.000.000đ</span>
                </div>

                {selectedAmount > 0 && !isAmountValid && (
                  <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {selectedAmount < 10_000
                      ? 'Số tiền nạp tối thiểu là 10.000đ'
                      : 'Số tiền nạp tối đa là 50.000.000đ'}
                  </p>
                )}
              </div>

              {/* Value Proposition Highlights */}
              <div className="rounded-2xl bg-gradient-to-br from-shop-violet/5 via-purple-50/30 to-[#c0b5f3]/20 p-4 border border-purple-100/60 space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-gray-700">
                  <Zap className="w-4 h-4 text-shop-violet shrink-0 mt-0.5" />
                  <span>
                    <strong>Cộng tiền tức thì:</strong> Hệ thống tự động nhận diện và cập nhật số
                    dư chỉ sau 1-3 giây khi chuyển khoản thành công.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-gray-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Miễn phí 100%:</strong> Không thu bất kỳ khoản phí nạp tiền hoặc phí
                    duy trì nào đối với khách hàng.
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleCreateTopup}
                disabled={loading || !isAmountValid}
                className="w-full bg-shop-violet hover:bg-shop-violet-deep text-white font-bold py-3.5 px-6 rounded-full transition shadow-lg shadow-[#5433eb]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang khởi tạo mã VietQR...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>
                      Tiếp tục nạp {selectedAmount > 0 ? formatVND(selectedAmount) : ''}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: QR PAYMENT & SCAN */}
          {step === 'QR_PAYMENT' && topupData && (
            <div className="space-y-5">
              {/* Countdown & Status Header */}
              <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 rounded-2xl px-4 py-2.5 text-amber-800 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium">Mã QR hết hạn sau:</span>
                </div>
                <span className="font-mono font-bold text-sm text-amber-900">
                  {formatCountdown(timeLeft)}
                </span>
              </div>

              {/* QR Image Display Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-3xl border border-gray-100">
                <div className="relative p-3 bg-white rounded-2xl shadow-md border border-gray-200/80">
                  {topupData.qrUrl ? (
                    <Image
                      src={topupData.qrUrl}
                      alt="VietQR PayOS Topup"
                      width={220}
                      height={220}
                      className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl object-contain"
                      priority
                      unoptimized
                    />
                  ) : topupData.qrCode && topupData.qrCode.startsWith('http') ? (
                    <Image
                      src={topupData.qrCode}
                      alt="VietQR PayOS Topup"
                      width={220}
                      height={220}
                      className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl object-contain"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="w-52 h-52 sm:w-56 sm:h-56 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                      <QrCode className="w-16 h-16 text-gray-500 mb-2" />
                      <span className="text-xs font-semibold text-gray-700">
                        Mã VietQR Napas 24/7
                      </span>
                      <span className="text-[11px] text-gray-500 mt-1">
                        Quét bằng app ngân hàng
                      </span>
                    </div>
                  )}

                  <div className="mt-2 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      PayOS VietQR Napas 24/7
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 text-center mt-3 max-w-xs">
                  Mở ứng dụng Mobile Banking bất kỳ để quét mã và chuyển tiền tự động
                </p>
              </div>

              {/* Transfer Details Card */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-3 text-xs">
                {/* Bank Name */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    Ngân hàng:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {topupData.bankInfo?.bankName || 'MB Bank (Napas 247)'}
                  </span>
                </div>

                {/* Account Number */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-gray-900">
                      {topupData.bankInfo?.accountNo || '970422123456789'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          topupData.bankInfo?.accountNo || '970422123456789',
                          'Số tài khoản'
                        )
                      }
                      className="p-1 rounded-md hover:bg-gray-200 text-gray-500 transition"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === 'Số tài khoản' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Name */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Chủ tài khoản:</span>
                  <span className="font-semibold text-gray-900">
                    {topupData.bankInfo?.accountName || 'SHOP QR PAYMENT'}
                  </span>
                </div>

                {/* Amount */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Số tiền nạp:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-shop-violet">
                      {formatVND(topupData.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(String(topupData.amount), 'Số tiền')}
                      className="p-1 rounded-md hover:bg-gray-200 text-gray-500 transition"
                      title="Sao chép số tiền"
                    >
                      {copiedField === 'Số tiền' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Transfer Content / Description */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                  <div>
                    <span className="block text-[11px] font-semibold text-amber-900">
                      Nội dung CK (bắt buộc):
                    </span>
                    <span className="font-mono font-extrabold text-sm text-amber-950">
                      {topupData.topupCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(topupData.topupCode, 'Nội dung chuyển khoản')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-200/70 hover:bg-amber-300 text-amber-900 font-semibold text-[11px] transition shadow-2xs"
                  >
                    {copiedField === 'Nội dung chuyển khoản' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Realtime Waiting Pulse Banner */}
              <div className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-2xl bg-purple-50 text-shop-violet text-xs font-medium border border-purple-100">
                <div className="w-3 h-3 rounded-full bg-shop-violet animate-ping shrink-0" />
                <span>Đang chờ chuyển tiền... Số dư tự động cộng sau 1-3 giây</span>
              </div>

              {/* Actions Footer */}
              <div className="space-y-2 pt-1">
                {topupData.checkoutUrl && (
                  <a
                    href={topupData.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở trang thanh toán PayOS Gateway</span>
                  </a>
                )}

                {/* Sandbox / Dev Test Helper Button — chỉ render ở môi trường dev */}
                {isDevSandbox && (
                  <button
                    type="button"
                    onClick={handleSimulatePayment}
                    disabled={simulating}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition border border-emerald-200 disabled:opacity-50 cursor-pointer"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang mô phỏng giao dịch...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mô phỏng Quét mã Thành công (Dev Sandbox)</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setStep('SELECT_AMOUNT')}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-800 py-1 transition flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Chọn lại số tiền khác</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CELEBRATION */}
          {step === 'SUCCESS' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Giao dịch thành công
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Nạp tiền vào ví thành công!
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Cảm ơn {userName}. Số tiền nạp đã được ghi nhận vào tài khoản của bạn.
                </p>
              </div>

              {/* Summary Box */}
              <div className="bg-gray-50 rounded-2xl p-4 text-xs space-y-2 border border-gray-100 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-gray-500">Số tiền nạp:</span>
                  <span className="font-extrabold text-emerald-600">
                    +{formatVND(successInfo?.amount || selectedAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mã giao dịch:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {successInfo?.topupCode || topupData?.topupCode}
                  </span>
                </div>
                {successInfo?.newBalance !== undefined && (
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-500 font-medium">Số dư mới khả dụng:</span>
                    <span className="font-extrabold text-gray-900 text-sm">
                      {formatVND(successInfo.newBalance)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full bg-shop-violet hover:bg-shop-violet-deep text-white font-bold py-3.5 px-6 rounded-full transition shadow-lg shadow-[#5433eb]/25 text-xs sm:text-sm active:scale-[0.99] cursor-pointer"
                >
                  Xong & Quay lại ví
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WalletTopupModal;
