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
  checkoutUrl?: string;
  paymentLinkId?: string;
  orderCode?: number;
  qrCode?: string;
  source?: 'PAYOS_API' | 'MOCK';
  rawResponse?: unknown;
  error?: string;
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
 * Xác thực tính hợp lệ của chữ ký Webhook từ cổng thanh toán PayOS bằng thuật toán HMAC-SHA256
 *
 * @param data - Dữ liệu payload webhook (`body.data`) chứa thông tin giao dịch thanh toán
 * @param signature - Chữ ký số nhận được từ header/body của request PayOS
 * @param checksumKey - Khóa bí mật `PAYOS_CHECKSUM_KEY` cấu hình trong biến môi trường
 * @returns `true` nếu chữ ký hợp lệ và payload nguyên vẹn; `false` nếu bị giả mạo hoặc sai khóa
 *
 * @security Protocol
 * 1. Sắp xếp thuộc tính (Deterministic Key Sorting):
 *    - PayOS quy định toàn bộ các khóa trong object `data` phải được sort theo thứ tự từ điển A-Z (`Object.keys(data).sort()`).
 * 2. Chuẩn hóa Query String: Ghép nối dạng `key1=val1&key2=val2`.
 * 3. Chống tấn công dò thời gian (Timing Attack Protection):
 *    - Sử dụng `crypto.timingSafeEqual(sigBuf, compBuf)` để so sánh hai chuỗi băm trong thời gian hằng số,
 *      ngăn chặn kẻ tấn công suy đoán byte chữ ký dựa trên độ trễ phản hồi mạng.
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
 * Khởi tạo liên kết thanh toán PayOS và tạo mã VietQR động theo chuẩn Napas247
 *
 * @param params - Thông tin tạo phiên thanh toán (`orderCode`, `amount`, `description`, `cancelUrl`, `returnUrl`)
 * @returns `PayOSCreatePaymentResult` chứa checkoutUrl, paymentLinkId, mã QR và nguồn dữ liệu (PAYOS_API hoặc MOCK)
 *
 * @security & Production Fail-Closed Invariant (SEC-02)
 * 1. Môi trường Production (`NODE_ENV === 'production'`):
 *    - Áp dụng cơ chế **Fail-Closed**: Tuyệt đối không fallback sang trang giả lập Mock Checkout.
 *    - Nếu thiếu thông tin API credentials hoặc đối tác gặp sự cố, trả về lỗi rõ ràng để bảo vệ an toàn tài chính.
 * 2. Môi trường Development / Test:
 *    - Cho phép tự động fallback sang Mock Checkout (`/payment/payos-checkout`) giúp lập trình viên kiểm thử luồng thanh toán ngoại tuyến.
 */
export async function createPayOSPaymentLink(
  params: PayOSCreatePaymentParams
): Promise<PayOSCreatePaymentResult> {
  const isProduction = process.env.NODE_ENV === 'production';
  const clientId = PAYOS_CLIENT_ID || process.env.PAYOS_CLIENT_ID || '';
  const apiKey = PAYOS_API_KEY || process.env.PAYOS_API_KEY || '';
  const checksumKey = PAYOS_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM_KEY || '';
  const apiUrl = PAYOS_API_URL || process.env.PAYOS_API_URL || 'https://api-merchant.payos.vn/v2';

  const cleanDescription = params.description.slice(0, 25);

  if (clientId && apiKey && checksumKey) {
    try {
      const signature = generatePayOSRequestSignature(
        {
          amount: params.amount,
          cancelUrl: params.cancelUrl,
          description: cleanDescription,
          orderCode: params.orderCode,
          returnUrl: params.returnUrl,
        },
        checksumKey
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

      const res = await fetch(`${apiUrl}/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey,
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

  // Môi trường production tuyệt đối KHÔNG fallback sang mock checkout
  if (isProduction) {
    console.error('[PayOS] Cổng thanh toán PayOS tạm thời không khả dụng trong môi trường production');
    return {
      success: false,
      error: 'Cổng thanh toán PayOS tạm thời không khả dụng',
    };
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
