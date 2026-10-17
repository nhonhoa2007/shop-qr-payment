'use client';

import { QRPayment } from '@client/components/payment/QRPayment';
import type { MoneyVnd } from '@shared/types/money';

export interface PaymentViewProps {
  orderId: string;
  orderCode: string;
  qrUrl: string;
  totalAmount: MoneyVnd | number | bigint;
  expiresAt: string;
  bankInfo: {
    bankName: string;
    accountNo: string;
    accountName: string;
  };
  userId?: string;
  initialPaymentStatus?: 'waiting' | 'paid' | 'expired';
}

export function PaymentView(props: PaymentViewProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <QRPayment {...props} />
    </div>
  );
}

export default PaymentView;
