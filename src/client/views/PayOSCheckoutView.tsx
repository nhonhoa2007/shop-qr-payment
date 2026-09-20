'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatVND } from '@shared/utils';
import { ShieldCheck, ArrowLeft, CheckCircle2, XCircle, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

function PayOSCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = searchParams.get('id') || '';
  const code = searchParams.get('code') || '';
  const amountStr = searchParams.get('amount') || '0';
  const amount = Number(amountStr) || 0;

  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSimulatePayment = async () => {
    setLoading(true);
    try {
      // Gửi webhook mô phỏng PayOS callback
      const res = await fetch('/api/webhooks/payos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '00',
          desc: 'success',
          data: {
            orderCode: Number(code) || 123456,
            amount,
            description: `ShopQR DH${code}`,
            reference: id || `PAYOS_REF_${Date.now()}`,
            paymentLinkId: id,
          },
        }),
      });

      if (res.ok) {
        setSuccess(true);
        toast.success('Mô phỏng thanh toán PayOS thành công!');
        setTimeout(() => {
          router.push('/orders');
        }, 2000);
      } else {
        toast.error('Lỗi khi kích hoạt callback PayOS');
      }
    } catch {
      toast.error('Lỗi kết nối cổng thanh toán');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = () => {
    setCancelling(true);
    toast.info('Đã hủy phiên thanh toán PayOS');
    setTimeout(() => {
      router.push('/orders');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] py-12 px-4 sm:px-6">
      <div className="max-w-md mx-auto bg-white rounded-[28px] p-6 sm:p-8 shadow-card-custom border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#003B95] text-white flex items-center justify-center font-bold text-xs tracking-wider">
              P
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900">payOS Gateway</span>
              <span className="block text-[10px] text-gray-400">VietQR Napas 247 Sandbox</span>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Bảo mật SSL
          </span>
        </div>

        {/* Order Details */}
        <div className="bg-[#f8f9fa] rounded-2xl p-4 mb-6 space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Mã đơn hàng:</span>
            <span className="font-mono font-bold text-gray-900">DH{code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Số tiền thanh toán:</span>
            <span className="font-bold text-sm text-[#5433eb]">{formatVND(amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Mã phiên giao dịch:</span>
            <span className="font-mono text-[11px] text-gray-600 truncate max-w-[180px]">{id}</span>
          </div>
        </div>

        {/* Simulated QR display */}
        <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center mb-6">
          <div className="w-40 h-40 bg-[#f2f4f5] rounded-xl mx-auto flex flex-col items-center justify-center text-gray-400 mb-3">
            <QrCode className="w-16 h-16 text-gray-600 mb-1" />
            <span className="text-[11px] font-medium text-gray-500">Mã QR PayOS Napas</span>
          </div>
          <p className="text-xs text-gray-500">
            Quét mã bằng ứng dụng ngân hàng hoặc nhấn nút mô phỏng bên dưới để hoàn tất
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSimulatePayment}
            disabled={loading || cancelling || success}
            className="w-full bg-[#5433eb] hover:bg-[#4428d4] text-white font-medium py-3 px-4 rounded-full transition shadow-violet-custom disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý giao dịch...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Thanh toán thành công!</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Mô phỏng Thanh toán Thành công</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCancelPayment}
            disabled={loading || cancelling || success}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-full transition text-xs flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Hủy giao dịch & Quay lại</span>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về trang đơn hàng</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PayOSCheckoutView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-gray-500">
          Đang tải cổng thanh toán PayOS...
        </div>
      }
    >
      <PayOSCheckoutContent />
    </Suspense>
  );
}

export default PayOSCheckoutView;
