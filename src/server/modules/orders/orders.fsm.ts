import type { NotificationType, OrderStatus, PaymentStatus } from '@/types';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
];

export const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'EXPIRED', 'REFUNDED'];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatus);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

/**
 * Bộ kiểm tra hợp lệ của Cỗ máy hữu hạn trạng thái đơn hàng (Order Finite State Machine - FSM)
 *
 * @param params.currentStatus - Trạng thái xử lý đơn hàng hiện tại
 * @param params.currentPaymentStatus - Trạng thái thanh toán hiện tại
 * @param params.nextStatus - Trạng thái xử lý đơn hàng dự kiến chuyển tiếp
 * @param params.nextPaymentStatus - Trạng thái thanh toán dự kiến chuyển tiếp
 * @returns `null` nếu bước chuyển trạng thái hợp lệ; chuỗi `string` thông báo lỗi nếu vi phạm luật FSM
 *
 * @invariants & Business State Rules
 * 1. Đơn hàng đã hủy (Terminal State):
 *    - `CANCELLED` là trạng thái kết thúc (Terminal State). Tuyệt đối không cho phép đổi sang bất kỳ trạng thái nào khác.
 * 2. Đơn quá hạn thanh toán (Expired Invariant):
 *    - Khi `currentPaymentStatus === 'EXPIRED'`, không được phép đổi sang `PAID` qua luồng cập nhật thông thường
 *      (buộc phải qua luồng đối soát thủ công hoặc yêu cầu tạo đơn mới để kiểm tra lại tồn kho).
 * 3. Ràng buộc giao hàng & hoàn tất (Payment Requirement):
 *    - Không được chuyển đơn sang `SHIPPING` hoặc `COMPLETED` nếu `effectivePaymentStatus !== 'PAID'`.
 *      (Đảm bảo nguyên tắc không bao giờ giao hàng hoặc đóng đơn cho đơn chưa trả tiền).
 */
export function validateOrderTransition(params: {
  currentStatus: OrderStatus;
  currentPaymentStatus: PaymentStatus;
  nextStatus?: OrderStatus;
  nextPaymentStatus?: PaymentStatus;
}): string | null {
  const { currentStatus, currentPaymentStatus, nextStatus, nextPaymentStatus } = params;

  if (!nextStatus && !nextPaymentStatus) return 'Không có trạng thái cần cập nhật';

  if (currentStatus === 'CANCELLED' && nextStatus && nextStatus !== 'CANCELLED') {
    return 'Không thể chuyển trạng thái đơn hàng đã hủy';
  }

  if (currentPaymentStatus === 'EXPIRED' && nextPaymentStatus === 'PAID') {
    return 'Không thể xác nhận thanh toán cho đơn hàng đã hết hạn';
  }

  const effectivePaymentStatus = nextPaymentStatus || currentPaymentStatus;
  if (nextStatus === 'COMPLETED' && effectivePaymentStatus !== 'PAID') {
    return 'Chỉ có thể hoàn tất đơn hàng đã thanh toán';
  }

  if (nextStatus === 'SHIPPING' && effectivePaymentStatus !== 'PAID') {
    return 'Chỉ có thể giao đơn hàng đã thanh toán';
  }

  return null;
}

export const STATUS_NOTIFICATION_MAP: Partial<
  Record<OrderStatus, { title: string; message: (orderCode: string) => string; type: NotificationType }>
> = {
  CONFIRMED: {
    title: 'Đơn hàng đã được xác nhận',
    message: (orderCode) => `Shop đã tiếp nhận và đang chuẩn bị hàng cho đơn ${orderCode}.`,
    type: 'ORDER_CONFIRMED',
  },
  SHIPPING: {
    title: 'Đơn hàng đang được giao',
    message: (orderCode) => `Đơn hàng ${orderCode} đang trên đường giao tới bạn.`,
    type: 'ORDER_SHIPPING',
  },
  COMPLETED: {
    title: 'Đơn hàng hoàn tất',
    message: (orderCode) => `Đơn hàng ${orderCode} đã giao thành công. Cảm ơn bạn đã mua sắm!`,
    type: 'ORDER_COMPLETED',
  },
  CANCELLED: {
    title: 'Đơn hàng đã hủy',
    message: (orderCode) => `Đơn hàng ${orderCode} đã bị hủy.`,
    type: 'ORDER_CONFIRMED',
  },
};
