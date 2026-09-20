export interface BankTransactionPayload {
  id?: string | number | null;
  amount?: number | string | null;
  description?: string | null;
  bankSubAccId?: string | null;
  when?: string | null;
}

/**
 * Trích xuất mã đơn hàng từ chuỗi nội dung chuyển khoản ngân hàng (VietQR Transfer Description Parser)
 *
 * @param description - Chuỗi nội dung tin nhắn báo có biến động số dư ngân hàng
 * @returns Mã đơn chuẩn dạng `DH123456` nếu khớp mẫu regex; trả về `null` nếu không tìm thấy
 *
 * @rules & Regex Matching
 * - Nhận diện tiền tố `DH` không phân biệt hoa thường (`/DH\s*([0-9]{6,}[A-Z0-9]*)/i`).
 * - Xử lý trường hợp người dùng gõ có khoảng trắng giữa tiền tố và số (vd: "DH 100001" -> "DH100001").
 */
export function parseOrderCodeFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;

  const match = description.toUpperCase().match(/DH\s*([0-9]{6,}[A-Z0-9]*)/i);
  return match ? `DH${match[1]}` : null;
}

export function getTransactionAmount(transaction: BankTransactionPayload): number | null {
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) ? Math.abs(Math.round(amount)) : null;
}

export function getTransactionId(transaction: BankTransactionPayload): string | null {
  if (transaction.id === null || transaction.id === undefined) return null;
  const id = String(transaction.id).trim();
  return id.length > 0 ? id : null;
}

export type WebhookProcessDecision =
  | {
      action: 'SKIP';
      reason:
        | 'DUPLICATE_TRANSACTION'
        | 'NO_ORDER_CODE'
        | 'INVALID_AMOUNT'
        | 'ORDER_NOT_FOUND'
        | 'ALREADY_PAID'
        | 'ORDER_EXPIRED'
        | 'ORDER_CANCELLED'
        | 'UNDERPAID';
    }
  | {
      action: 'PROCESS';
      orderCode: string;
      amount: number;
      transactionId: string | null;
    };

/**
 * Đánh giá quyết định xử lý webhook chuyển khoản ngân hàng (Webhook Idempotency & Validation Decision Matrix)
 *
 * @param txn - Dữ liệu giao dịch ngân hàng từ webhook (`id`, `amount`, `description`)
 * @param context.isDuplicateTransaction - Cờ kiểm tra giao dịch đã từng xử lý trước đó hay chưa (trùng mã `bankTransId`)
 * @param context.order - Thông tin đơn hàng tìm thấy trong database (hoặc `null` nếu không có)
 * @returns `WebhookProcessDecision`: `{ action: 'PROCESS', ... }` nếu hợp lệ để xác nhận đơn; hoặc `{ action: 'SKIP', reason }` nếu cần bỏ qua
 *
 * @idempotency & Security Hierarchy
 * 1. Chống tấn công phát lại (Replay Attack Prevention):
 *    - Ưu tiên kiểm tra `isDuplicateTransaction`: Bỏ qua ngay nếu mã giao dịch ngân hàng đã tồn tại trong DB (`DUPLICATE_TRANSACTION`).
 * 2. Tính toàn vẹn cú pháp:
 *    - Bỏ qua nếu không trích xuất được mã đơn (`NO_ORDER_CODE`) hoặc số tiền không hợp lệ (`INVALID_AMOUNT`).
 * 3. Bảo vệ trạng thái đơn hàng (Order Lifecycle Guards):
 *    - Không tìm thấy đơn: `ORDER_NOT_FOUND`.
 *    - Đơn đã xác nhận thanh toán: `ALREADY_PAID` (đảm bảo tính lũy đẳng idempotency khi đối tác retry webhook).
 *    - Đơn đã hết hạn thanh toán: `ORDER_EXPIRED`.
 *    - Đơn đã bị hủy: `ORDER_CANCELLED`.
 * 4. Chống chuyển thiếu tiền (Underpaid Protection):
 *    - Nếu `amount < order.totalAmount`: Bỏ qua với lý do `UNDERPAID` (ngăn chặn gian lận chuyển 1đ để kích hoạt đơn tiền triệu).
 */
export function evaluateWebhookDecision(
  txn: BankTransactionPayload,
  context: {
    isDuplicateTransaction: boolean;
    order: {
      orderCode: string;
      totalAmount: number;
      paymentStatus: string;
      status: string;
    } | null;
  }
): WebhookProcessDecision {
  const transactionId = getTransactionId(txn);
  if (transactionId && context.isDuplicateTransaction) {
    return { action: 'SKIP', reason: 'DUPLICATE_TRANSACTION' };
  }

  const matchedCode = parseOrderCodeFromDescription(txn.description);
  if (!matchedCode) {
    return { action: 'SKIP', reason: 'NO_ORDER_CODE' };
  }

  const amount = getTransactionAmount(txn);
  if (!amount || amount <= 0) {
    return { action: 'SKIP', reason: 'INVALID_AMOUNT' };
  }

  if (!context.order) {
    return { action: 'SKIP', reason: 'ORDER_NOT_FOUND' };
  }

  if (context.order.paymentStatus === 'PAID') {
    return { action: 'SKIP', reason: 'ALREADY_PAID' };
  }

  if (context.order.paymentStatus === 'EXPIRED') {
    return { action: 'SKIP', reason: 'ORDER_EXPIRED' };
  }

  if (context.order.status === 'CANCELLED') {
    return { action: 'SKIP', reason: 'ORDER_CANCELLED' };
  }

  if (amount < context.order.totalAmount) {
    return { action: 'SKIP', reason: 'UNDERPAID' };
  }

  return {
    action: 'PROCESS',
    orderCode: matchedCode,
    amount,
    transactionId,
  };
}
