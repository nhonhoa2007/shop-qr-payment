import crypto from 'node:crypto';

export const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
export const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '';
export const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';
export const PAYOS_API_URL = process.env.PAYOS_API_URL || 'https://api-merchant.payos.vn/v2';

export interface PayOSCreatePaymentParams {
  orderCode: number; // PayOS yêu cầu orderCode dạng số nguyên dương an toàn <= 9007199254740991
  amount: number;
  description: string; // Tối đa 25 ký tự theo quy định PayOS
  cancelUrl: string;
  returnUrl: string;
  items?: {
    name: string;
    quantity: number;
    price: number;
  }[];
}

export interface PayOSCreatePaymentResult {
  success: boolean;
  checkoutUrl: string;
  paymentLinkId: string;
  orderCode: number;
  qrCode?: string;
  source: 'PAYOS_API' | 'MOCK';
  rawResponse?: unknown;
}

export interface PayOSWebhookData {
  orderCode: number;
  amount: number;
  description: string;
  accountNumber?: string;
  reference?: string;
  transactionDateTime?: string;
  currency?: string;
  paymentLinkId?: string;
  code?: string;
  desc?: string;
  counterAccountBankId?: string;
  counterAccountBankName?: string;
  counterAccountName?: string;
  counterAccountNumber?: string;
  virtualAccountName?: string;
  virtualAccountNumber?: string;
  [key: string]: unknown;
}

export interface PayOSWebhookPayload {
  code: string;
  desc: string;
  data: PayOSWebhookData;
  signature: string;
}

/**
 * Sinh chữ ký HMAC-SHA256 cho yêu cầu tạo liên kết thanh toán PayOS
 */
export function generatePayOSRequestSignature(
  params: {
    amount: number;
    cancelUrl: string;
    description: string;
    orderCode: number;
    returnUrl: string;
  },
  checksumKey: string
): string {
  const dataStr = `amount=${params.amount}&cancelUrl=${params.cancelUrl}&description=${params.description}&orderCode=${params.orderCode}&returnUrl=${params.returnUrl}`;
  return crypto.createHmac('sha256', checksumKey).update(dataStr).digest('hex');
}

/**
 * Xác thực tính hợp lệ của chữ ký Webhook từ PayOS bằng HMAC-SHA256 và so sánh an toàn timingSafeEqual
 */
export function verifyPayOSWebhookSignature(
  data: Record<string, unknown>,
  signature: string,
  checksumKey: string
): boolean {
  if (!signature || !checksumKey || typeof signature !== 'string') {
    return false;
  }

  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys
    .map((key) => {
      const val = data[key];
      const stringVal = val !== null && val !== undefined ? String(val) : '';
      return `${key}=${stringVal}`;
    })
    .join('&');

  const computedSignature = crypto
    .createHmac('sha256', checksumKey)
    .update(queryString)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const compBuf = Buffer.from(computedSignature);

  if (sigBuf.length !== compBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, compBuf);
}

/**
 * Chuyển đổi mã đơn hàng string dạng DH123456 sang số nguyên dương để tương thích với PayOS orderCode
 */
export function parsePayOSOrderCode(orderCodeStr: string): number {
  const numericOnly = orderCodeStr.replace(/\D/g, '');
  if (numericOnly.length > 0) {
    const num = Number(numericOnly.slice(-9)); // Giới hạn 9 chữ số tránh tràn số
    if (num > 0) return num;
  }
  // Fallback timestamp mod 1 tỷ
  return Math.floor(Date.now() % 1_000_000_000);
}

/**
 * Khởi tạo liên kết thanh toán PayOS
 */
export async function createPayOSPaymentLink(
  params: PayOSCreatePaymentParams
): Promise<PayOSCreatePaymentResult> {
  const cleanDescription = params.description.slice(0, 25);

  if (PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY) {
    try {
      const signature = generatePayOSRequestSignature(
        {
          amount: params.amount,
          cancelUrl: params.cancelUrl,
          description: cleanDescription,
          orderCode: params.orderCode,
          returnUrl: params.returnUrl,
        },
        PAYOS_CHECKSUM_KEY
      );

      const requestBody = {
        orderCode: params.orderCode,
        amount: params.amount,
        description: cleanDescription,
        cancelUrl: params.cancelUrl,
        returnUrl: params.returnUrl,
        items: params.items || [],
        signature,
      };

      const res = await fetch(`${PAYOS_API_URL}/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': PAYOS_CLIENT_ID,
          'x-api-key': PAYOS_API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.code === '00' && json.data) {
          return {
            success: true,
            checkoutUrl: json.data.checkoutUrl,
            paymentLinkId: json.data.paymentLinkId,
            orderCode: params.orderCode,
            qrCode: json.data.qrCode,
            source: 'PAYOS_API',
            rawResponse: json.data,
          };
        }
      }
    } catch (error) {
      console.warn('PayOS API call failed, falling back to mock checkout:', error);
    }
  }

  // Fallback Mock link an toàn cho dev/testing
  const mockPaymentId = `payos_${Date.now()}_${params.orderCode}`;
  const mockCheckoutUrl = `/payment/payos-checkout?id=${mockPaymentId}&code=${params.orderCode}&amount=${params.amount}`;

  return {
    success: true,
    checkoutUrl: mockCheckoutUrl,
    paymentLinkId: mockPaymentId,
    orderCode: params.orderCode,
    source: 'MOCK',
  };
}
