export interface ReconcileInput {
  orderId?: string;
  orderCode?: string;
  amount?: number;
  bankTransId?: string;
  bankName?: string;
  senderAccount?: string;
  note?: string;
}

export interface ReconcileValidationResult {
  valid: boolean;
  error?: string;
  data?: {
    orderId?: string;
    orderCode?: string;
    amount: number;
    bankTransId: string;
    bankName: string;
    senderAccount?: string;
    note?: string;
  };
}

export function validateReconcileInput(input: unknown): ReconcileValidationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' };
  }

  const raw = input as Record<string, unknown>;
  const orderId = typeof raw.orderId === 'string' && raw.orderId.trim() ? raw.orderId.trim() : undefined;
  const orderCode = typeof raw.orderCode === 'string' && raw.orderCode.trim() ? raw.orderCode.trim().toUpperCase() : undefined;

  if (!orderId && !orderCode) {
    return { valid: false, error: 'Vui lòng cung cấp mã đơn hàng hoặc ID đơn hàng' };
  }

  const amountNumber = Number(raw.amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return { valid: false, error: 'Số tiền đối soát phải lớn hơn 0' };
  }
  const amount = Math.round(amountNumber);

  const bankTransId = typeof raw.bankTransId === 'string' && raw.bankTransId.trim()
    ? raw.bankTransId.trim()
    : `RECON-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const bankName = typeof raw.bankName === 'string' && raw.bankName.trim()
    ? raw.bankName.trim()
    : 'Chuyển khoản đối soát thủ công';

  const senderAccount = typeof raw.senderAccount === 'string' && raw.senderAccount.trim()
    ? raw.senderAccount.trim()
    : undefined;

  const note = typeof raw.note === 'string' && raw.note.trim()
    ? raw.note.trim()
    : undefined;

  return {
    valid: true,
    data: {
      orderId,
      orderCode,
      amount,
      bankTransId,
      bankName,
      senderAccount,
      note,
    },
  };
}

export function canReconcileOrder(order: {
  status: string;
  paymentStatus: string;
  totalAmount: number;
}, amount: number): { allowed: boolean; warning?: string; error?: string } {
  if (amount < order.totalAmount) {
    return {
      allowed: false,
      error: `Số tiền đối soát (${amount.toLocaleString('vi-VN')}đ) nhỏ hơn giá trị đơn hàng (${order.totalAmount.toLocaleString('vi-VN')}đ)`,
    };
  }

  if (order.paymentStatus === 'PAID') {
    return {
      allowed: true,
      warning: 'Đơn hàng này đã ở trạng thái đã thanh toán (PAID). Bản ghi đối soát sẽ được đồng bộ lại.',
    };
  }

  if (order.status === 'CANCELLED') {
    return {
      allowed: true,
      warning: 'Đơn hàng từng bị hủy. Đối soát thủ công sẽ kích hoạt lại đơn hàng sang trạng thái CONFIRMED.',
    };
  }

  return { allowed: true };
}
