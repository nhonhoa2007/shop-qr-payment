'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { pusherClient } from '@/lib/pusher-client';
import { formatVND, formatCountdown } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
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
      <div className="max-w-md mx-auto p-10 bg-white rounded-[28px] shadow-card-custom text-center">
        <div className="w-16 h-16 bg-[#f2f4f5] rounded-full flex items-center justify-center mx-auto mb-4 text-[#000000]">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-[#000000] tracking-[-0.05em] mb-1">Thanh toán thành công</h2>
        <p className="text-[#787574] text-xs mb-6 tracking-[-0.014em]">Đơn hàng {orderCode} đã được xác nhận</p>
        <Link
          href="/orders"
          className="inline-block bg-[#000000] text-white px-6 py-3 rounded-full text-xs font-medium hover:bg-[#332f2d] transition tracking-[-0.014em]"
        >
          Xem đơn hàng
        </Link>
      </div>
    );
  }

  if (paymentStatus === 'expired') {
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-[28px] shadow-card-custom text-center">
        <div className="w-16 h-16 bg-[#f2f4f5] rounded-full flex items-center justify-center mx-auto mb-4 text-[#787574]">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-[#000000] tracking-[-0.05em] mb-1">Mã QR đã hết hạn</h2>
        <p className="text-[#787574] text-xs mb-6 tracking-[-0.014em]">Vui lòng đặt hàng lại để nhận mã QR mới.</p>
        <Link
          href="/"
          className="inline-block bg-[#000000] text-white px-6 py-3 rounded-full text-xs font-medium hover:bg-[#332f2d] transition tracking-[-0.014em]"
        >
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 sm:p-8 bg-white rounded-[28px] shadow-card-custom">
      <h2 className="text-lg font-semibold text-center text-[#000000] tracking-[-0.05em] mb-1">
        Quét mã VietQR để thanh toán
      </h2>
      <p className="text-[#787574] text-center text-xs mb-6 tracking-[-0.014em]">Đơn hàng: {orderCode}</p>

      {!isBankConfigured && (
        <div className="mb-4 flex items-start gap-2 bg-[#f2f4f5] text-[#787574] text-xs rounded-[20px] p-3 tracking-[-0.014em]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#000000]" />
          <span>Thông tin tài khoản ngân hàng chưa được cấu hình. Vui lòng liên hệ shop.</span>
        </div>
      )}

      {isBankConfigured ? (
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-[#f2f4f5] rounded-[20px]">
            <Image
              src={qrUrl}
              alt="QR Thanh toán"
              width={240}
              height={240}
              className="w-60 h-60 rounded-[14px]"
              priority
              unoptimized
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center mb-6 h-60 bg-[#f2f4f5] rounded-[20px] text-[#cccccc] text-xs">
          Không có mã QR
        </div>
      )}

      {/* Info Stack */}
      <div className="bg-[#f2f4f5] rounded-[20px] p-4 space-y-2.5 text-xs">
        <InfoRow label="Ngân hàng" value={bankInfo.bankName || '(Chưa cấu hình)'} />
        <InfoRow
          label="Số tài khoản"
          value={bankInfo.accountNo || '(Chưa cấu hình)'}
          onCopy={bankInfo.accountNo ? () => copyToClipboard(bankInfo.accountNo, 'account') : undefined}
          copied={copied === 'account'}
        />
        <InfoRow label="Chủ tài khoản" value={bankInfo.accountName || '(Chưa cấu hình)'} />
        <div className="flex justify-between items-center py-2 border-t border-[#ebebeb]">
          <span className="text-[#787574]">Số tiền</span>
          <span className="text-base font-semibold text-[#000000] tracking-[-0.05em]">{formatVND(totalAmount)}</span>
        </div>
        <InfoRow
          label="Nội dung CK"
          value={`Thanh toan don hang ${orderCode}`}
          onCopy={() => copyToClipboard(`Thanh toan don hang ${orderCode}`, 'content')}
          copied={copied === 'content'}
        />
      </div>

      <div className="text-center mt-6">
        <p className="text-[#787574] text-xs tracking-[-0.014em]">Hết hạn sau</p>
        <p className="font-mono text-xl font-semibold text-[#000000] tracking-tight-display mt-0.5">
          {formatCountdown(timeLeft)}
        </p>
      </div>

      <div className="flex items-center justify-center mt-4 gap-2 text-[#787574]">
        <div className="w-4 h-4 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-[#000000] tracking-[-0.014em]">Đang chờ thanh toán tự động...</span>
      </div>

      {!isBankConfigured && (
        <p className="text-center text-[10px] text-[#787574] mt-4">
          Mã đơn hàng: <span className="font-semibold text-[#000000]">{orderId}</span>
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
      <span className="text-[#787574]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-[#000000]">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-[#5433eb] hover:underline transition text-[11px]">
            {copied ? '✓ Đã sao chép' : 'Sao chép'}
          </button>
        )}
      </div>
    </div>
  );
}
