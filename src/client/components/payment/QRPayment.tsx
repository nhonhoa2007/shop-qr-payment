'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { pusherClient } from '@client/infrastructure/pusher-client';
import { formatVND, formatCountdown } from '@shared/utils';
import { PAYMENT_EXPIRY_GRACE_MS } from '@shared/constants';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { QRPaymentData } from '@shared/types';

interface QRPaymentProps extends QRPaymentData {
  userId?: string;
  initialPaymentStatus?: 'waiting' | 'paid' | 'expired';
}

export function QRPayment({
  orderId,
  orderCode,
  qrUrl,
  totalAmount,
  expiresAt,
  bankInfo,
  userId,
  initialPaymentStatus = 'waiting',
}: QRPaymentProps) {
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'confirming' | 'paid' | 'expired'>(initialPaymentStatus);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const isBankConfigured = bankInfo.bankName && bankInfo.accountNo && bankInfo.accountName;
  const transferContent = getQrTransferContent(qrUrl, orderCode);

  useEffect(() => {
    if (paymentStatus === 'paid' || paymentStatus === 'expired') return;
    const interval = setInterval(() => {
      const deadline = new Date(expiresAt).getTime();
      const remaining = deadline - Date.now();
      const settlementRemaining = deadline + PAYMENT_EXPIRY_GRACE_MS - Date.now();
      if (remaining > 0) {
        setTimeLeft(remaining);
        setPaymentStatus('waiting');
      } else if (settlementRemaining > 0) {
        setTimeLeft(settlementRemaining);
        setPaymentStatus('confirming');
      } else {
        setTimeLeft(0);
        setPaymentStatus('expired');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, paymentStatus]);

  useEffect(() => {
    if (!userId || paymentStatus === 'paid' || paymentStatus === 'expired') return;
    const channel = pusherClient.subscribe(`private-user-${userId}`);
    channel.bind('payment-success', (data: { orderId?: string; orderCode?: string }) => {
      if (
        data.orderId === orderCode ||
        data.orderId === orderId ||
        data.orderCode === orderCode
      ) {
        setPaymentStatus('paid');
      }
    });
    return () => {
      pusherClient.unsubscribe(`private-user-${userId}`);
    };
  }, [userId, orderCode, orderId, paymentStatus]);

  useEffect(() => {
    if (paymentStatus === 'paid' || paymentStatus === 'expired') return;
    let stopped = false;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(orderCode)}`, {
          cache: 'no-store',
        });
        if (!response.ok || stopped) return;
        const body = await response.json();
        if (body.data?.status === 'COMPLETED') setPaymentStatus('paid');
        if (body.data?.status === 'EXPIRED') setPaymentStatus('expired');
      } catch {
        // Pusher và lần poll kế tiếp tiếp tục làm cơ chế dự phòng.
      }
    };

    void pollStatus();
    const interval = setInterval(pollStatus, 3500);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [orderCode, paymentStatus]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (paymentStatus === 'paid') {
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-[28px] shadow-card text-center">
        <div className="w-16 h-16 bg-canvas-mist rounded-full flex items-center justify-center mx-auto mb-4 text-ink-black">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-ink-black tracking-[-0.05em] mb-1">Thanh toán thành công</h2>
        <p className="text-muted-gray text-xs mb-6 tracking-[-0.014em]">Đơn hàng {orderCode} đã được xác nhận</p>
        <Link
          href="/orders"
          className="inline-block bg-ink-black text-white px-6 py-3 rounded-full text-xs font-medium hover:bg-slate-ink transition tracking-[-0.014em]"
        >
          Xem đơn hàng
        </Link>
      </div>
    );
  }

  if (paymentStatus === 'expired') {
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-[28px] shadow-card text-center">
        <div className="w-16 h-16 bg-canvas-mist rounded-full flex items-center justify-center mx-auto mb-4 text-muted-gray">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-ink-black tracking-[-0.05em] mb-1">Mã QR đã hết hạn</h2>
        <p className="text-muted-gray text-xs mb-6 tracking-[-0.014em]">Vui lòng đặt hàng lại để nhận mã QR mới.</p>
        <Link
          href="/"
          className="inline-block bg-ink-black text-white px-6 py-3 rounded-full text-xs font-medium hover:bg-slate-ink transition tracking-[-0.014em]"
        >
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  if (paymentStatus === 'confirming') {
    return (
      <div className="max-w-md mx-auto p-10 bg-white rounded-[28px] shadow-card text-center">
        <div className="w-16 h-16 bg-canvas-mist rounded-full flex items-center justify-center mx-auto mb-4 text-ink-black">
          <div className="w-7 h-7 border-2 border-ink-black border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-ink-black tracking-[-0.05em] mb-1">
          Đang xác nhận giao dịch
        </h2>
        <p className="text-muted-gray text-xs mb-4 tracking-[-0.014em]">
          Mã QR đã đóng. Hệ thống vẫn kiểm tra giao dịch đã chuyển trước hạn; vui lòng không chuyển thêm.
        </p>
        <p className="font-mono text-xl font-semibold text-ink-black tracking-tight-display">
          {formatCountdown(timeLeft)}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 sm:p-8 bg-white rounded-[28px] shadow-card">
      <h2 className="text-lg font-semibold text-center text-ink-black tracking-[-0.05em] mb-1">
        Quét mã SePay/VietQR để thanh toán
      </h2>
      <p className="text-muted-gray text-center text-xs mb-6 tracking-[-0.014em]">Đơn hàng: {orderCode}</p>

      {!isBankConfigured && (
        <div className="mb-4 flex items-start gap-2 bg-canvas-mist text-muted-gray text-xs rounded-[20px] p-3 tracking-[-0.014em]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-ink-black" />
          <span>Thông tin tài khoản ngân hàng chưa được cấu hình. Vui lòng liên hệ shop.</span>
        </div>
      )}

      {isBankConfigured ? (
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-canvas-mist rounded-[20px]">
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
        <div className="flex items-center justify-center mb-6 h-60 bg-canvas-mist rounded-[20px] text-cool-stone text-xs">
          Không có mã QR
        </div>
      )}

      {/* Info Stack */}
      <div className="bg-canvas-mist rounded-[20px] p-4 space-y-2.5 text-xs">
        <InfoRow label="Ngân hàng" value={bankInfo.bankName || '(Chưa cấu hình)'} />
        <InfoRow
          label="Số tài khoản"
          value={bankInfo.accountNo || '(Chưa cấu hình)'}
          onCopy={bankInfo.accountNo ? () => copyToClipboard(bankInfo.accountNo, 'account') : undefined}
          copied={copied === 'account'}
        />
        <InfoRow label="Chủ tài khoản" value={bankInfo.accountName || '(Chưa cấu hình)'} />
        <div className="flex justify-between items-center py-2 border-t border-faint-border">
          <span className="text-muted-gray">Số tiền</span>
          <span className="text-base font-semibold text-ink-black tracking-[-0.05em]">{formatVND(totalAmount)}</span>
        </div>
        <InfoRow
          label="Nội dung CK"
          value={transferContent}
          onCopy={() => copyToClipboard(transferContent, 'content')}
          copied={copied === 'content'}
        />
      </div>

      <div className="text-center mt-6">
        <p className="text-muted-gray text-xs tracking-[-0.014em]">Hết hạn sau</p>
        <p className="font-mono text-xl font-semibold text-ink-black tracking-tight-display mt-0.5">
          {formatCountdown(timeLeft)}
        </p>
      </div>

      <div className="flex items-center justify-center mt-4 gap-2 text-muted-gray">
        <div className="w-4 h-4 border-2 border-[#000000] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-ink-black tracking-[-0.014em]">Đang chờ thanh toán tự động...</span>
      </div>

      {!isBankConfigured && (
        <p className="text-center text-[10px] text-muted-gray mt-4">
          Mã đơn hàng: <span className="font-semibold text-ink-black">{orderId}</span>
        </p>
      )}
    </div>
  );
}

function getQrTransferContent(qrUrl: string, fallback: string): string {
  try {
    return new URL(qrUrl).searchParams.get('des')?.trim() || fallback;
  } catch {
    return fallback;
  }
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
      <span className="text-muted-gray">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink-black">{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-shop-violet hover:underline transition text-[11px]">
            {copied ? '✓ Đã sao chép' : 'Sao chép'}
          </button>
        )}
      </div>
    </div>
  );
}
