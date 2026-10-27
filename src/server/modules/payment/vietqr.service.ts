import { generateSePayQrUrl } from './sepay.service';

interface QRPaymentParams {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  orderId: string;
}

export function generateVietQRUrl(params: QRPaymentParams): string {
  if (!params.bankId.trim() || !params.accountNo.trim() || !params.accountName.trim()) {
    return '';
  }

  return generateSePayQrUrl({
    bankId: params.bankId,
    accountNo: params.accountNo,
    accountName: params.accountName,
    amount: params.amount,
    paymentCode: params.orderId,
    memoPrefix: process.env.SEPAY_QR_MEMO_PREFIX,
  });
}

export function getBankInfo() {
  return {
    bankId: process.env.BANK_ID || 'mbbank',
    accountNo: process.env.BANK_ACCOUNT || '',
    accountName: process.env.BANK_NAME || '',
    displayName: process.env.BANK_DISPLAY_NAME || 'MB Bank',
  };
}
