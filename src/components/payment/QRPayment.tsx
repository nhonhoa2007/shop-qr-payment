'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { pusherClient } from '@/lib/pusher-client';
import { formatVND, formatCountdown } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { QRPaymentData } from '@/types';

interface QRPaymentProps extends QRPaymentData {
  userId?: string;
}

export function QRPayment({ orderId, orderCode, qrUrl, totalAmount, expiresAt, bankInfo, userId }: QRPaymentProps) {
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'paid' | 'expired'>('waiting');
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const isBankConfigured = bankInfo.bankName && bankInfo.accountNo && bankInfo.accountName;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) setPaymentStatus('expired');
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (!userId) return;
    const channel = pusherClient.subscribe(`private-user-${userId}`);
    channel.bind('payment-success', (data: { orderId: string }) => {
      if (data.orderId === orderCode) {
        setPaymentStatus('paid');
      }
    });
    return () => {
      pusherClient.unsubscribe(`private-user-${userId}`);
    };
  }, [userId, orderCode]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (paymentStatus === 'paid') {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">Thanh toán thành công! 🎉</h2>
        <p className="text-gray-500 mb-4">Đơn hàng {orderCode} đã được xác nhận</p>
        <Link href="/orders" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
          Xem đơn hàng
        </Link>
      </div>
    );
  }

  if (paymentStatus === 'expired') {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-red-600 mb-2">Hết hạn thanh toán</h2>
        <p className="text-gray-500 mb-4">Mã QR đã hết hạn. Vui lòng đặt hàng lại.</p>
        <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold text-center mb-1">Quét mã QR để thanh toán</h2>
      <p className="text-gray-500 text-center text-sm mb-4">Đơn hàng: {orderCode}</p>

      {!isBankConfigured && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Thông tin tài khoản ngân hàng chưa được cấu hình. Vui lòng liên hệ shop để chuyển khoản thủ công.</span>
        </div>
      )}

      {isBankConfigured ? (
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-white border-2 border-blue-100 rounded-2xl">
            <Image
              src={qrUrl}
              alt="QR Thanh toán"
              width={256}
              height={256}
              className="w-64 h-64 rounded-lg"
              priority
              unoptimized
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center mb-4 h-64 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-sm">
          Không có mã QR
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <InfoRow label="Ngân hàng" value={bankInfo.bankName || '(Chưa cấu hình)'} />
        <InfoRow
          label="Số tài khoản"
          value={bankInfo.accountNo || '(Chưa cấu hình)'}
          onCopy={bankInfo.accountNo ? () => copyToClipboard(bankInfo.accountNo, 'account') : undefined}
          copied={copied === 'account'}
        />
        <InfoRow label="Chủ tài khoản" value={bankInfo.accountName || '(Chưa cấu hình)'} />
        <div className="flex justify-between items-center py-2 border-t border-gray-200">
          <span className="text-gray-500 text-sm">Số tiền</span>
          <span className="text-xl font-bold text-blue-600">{formatVND(totalAmount)}</span>
        </div>
        <InfoRow
          label="Nội dung CK"
          value={`Thanh toan don hang ${orderCode}`}
          onCopy={() => copyToClipboard(`Thanh toan don hang ${orderCode}`, 'content')}
          copied={copied === 'content'}
        />
      </div>

      <div className="text-center mt-4">
        <p className="text-gray-500 text-sm">Hết hạn sau</p>
        <p className="font-mono text-2xl font-bold text-red-500">{formatCountdown(timeLeft)}</p>
      </div>

      <div className="flex items-center justify-center mt-4 gap-2 text-blue-600">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Đang chờ thanh toán...</span>
      </div>

      {/* Fallback for unconfigured bank — manual contact note */}
      {!isBankConfigured && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Mã đơn hàng: <span className="font-semibold text-gray-600">{orderId}</span>
        </p>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-blue-600 hover:text-blue-800 transition text-xs">
            {copied ? '✓ Đã sao chép' : 'Sao chép'}
          </button>
        )}
      </div>
    </div>
  );
}
