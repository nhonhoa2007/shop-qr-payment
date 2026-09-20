import type { OrderStatus, PaymentStatus } from '../types/index.ts';

export const APP_NAME = 'Shop QR Payment';

// Shipping Thresholds & Defaults
export const FREE_SHIPPING_THRESHOLD = 500_000;
export const STANDARD_SHIPPING_FEE = 30_000;
export const DEFAULT_SHIPPING_WEIGHT = 500; // grams
export const BASE_SHIPPING_WEIGHT = 500;
export const STEP_SHIPPING_FEE = 5_000;
export const STEP_SHIPPING_WEIGHT = 500;

// Order & Cart Limits
export const ORDER_EXPIRATION_MINUTES = 15;
export const MAX_QUANTITY_PER_ITEM = 99;

// Pagination Defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// OTP & Security
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_EXPIRATION_MINUTES = 5;
export const OTP_COOLDOWN_SECONDS = 60;

// Status Enums & Lists
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
] as const;

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'UNPAID',
  'PAID',
  'EXPIRED',
  'REFUNDED',
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao hàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
};
