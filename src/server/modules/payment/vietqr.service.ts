interface QRPaymentParams {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
  orderId: string;
}

export function generateVietQRUrl(params: QRPaymentParams): string {
  const template = 'compact2';
  const addInfo = `Thanh toan don hang ${params.orderId}`;

  return (
    `https://img.vietqr.io/image/${params.bankId}-${params.accountNo}-${template}.png` +
    `?amount=${params.amount}` +
    `&addInfo=${encodeURIComponent(addInfo)}` +
    `&accountName=${encodeURIComponent(params.accountName)}`
  );
}

export function getBankInfo() {
  return {
    bankId: process.env.BANK_ID || 'mbbank',
    accountNo: process.env.BANK_ACCOUNT || '',
    accountName: process.env.BANK_NAME || '',
    displayName: process.env.BANK_DISPLAY_NAME || 'MB Bank',
  };
}
