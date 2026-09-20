export * from '@/types';

// DTOs & Domain Types
export interface OrderRequestItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface ValidatedOrderItem {
  productId: string;
  variantId?: string | null;
  variantTitle?: string | null;
  quantity: number;
  price: number;
}

export interface CheckoutTotals {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: import('@/types').Coupon;
  discountAmount: number;
  message?: string;
}

export interface ReconcileInput {
  orderId?: string;
  orderCode?: string;
  amount: number;
  bankTransId?: string;
  bankName?: string;
  note?: string;
}

export interface ReconcileValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  normalizedData?: {
    orderId?: string;
    orderCode?: string;
    amount: number;
    bankTransId: string;
    bankName?: string;
    note?: string;
  };
}

export interface ReviewModerationInput {
  id: string;
  isApproved?: boolean;
  reply?: string | null;
}

export interface ReviewModerationResult {
  isValid: boolean;
  error?: string;
}

export type UrgentActionType = 'PENDING_ORDER' | 'OUT_OF_STOCK' | 'EXPIRED_PAYMENT';

export interface UrgentAction {
  id: string;
  type: UrgentActionType;
  title: string;
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  actionUrl: string;
}

export interface RecentOrderDto {
  id: string;
  orderCode: string;
  customerName: string;
  totalAmount: number;
  status: import('@/types').OrderStatus;
  paymentStatus: import('@/types').PaymentStatus;
  paymentMethod: 'VIETQR' | 'PAYOS' | 'COD' | 'WALLET';
  createdAt: string;
  itemsSummary: string;
}

export interface TopProductDto {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  price: number;
  soldQuantity: number;
  revenue: number;
}

export interface PaymentMethodDistribution {
  vietqr: number;
  payos: number;
  cod: number;
  wallet: number;
}

export interface RevenueTrendItem {
  label: string;
  revenue: number;
}

export interface AdminAnalyticsSummary {
  todayRevenue: number;
  revenueGrowthPercent: number;
  todayOrders: number;
  ordersGrowthPercent: number;
  newCustomers: number;
  customersGrowthPercent: number;
  qrMatchRate: number;
  pendingOrdersCount: number;
  outOfStockProductsCount: number;
  expiredPaymentsCount: number;
  urgentActions: UrgentAction[];
  paymentMethodDistribution: PaymentMethodDistribution;
  recentOrders: RecentOrderDto[];
  topProducts: TopProductDto[];
  revenueTrend: RevenueTrendItem[];
}

export type AnalyticsRange = 'today' | '7days' | 'month';

export interface AdminAnalyticsResponse {
  summary: AdminAnalyticsSummary;
  generatedAt: string;
  range: AnalyticsRange;
}

export interface Ward {
  code: string;
  name: string;
}

export interface District {
  code: string;
  name: string;
  wards: Ward[];
}

export interface Province {
  code: string;
  name: string;
  districts: District[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
