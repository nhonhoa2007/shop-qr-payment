// ==========================================
// CORE DOMAIN ENTITIES & INTERFACES
// ==========================================

import type { MoneyVnd, MoneySnapshot } from './money';
export type { MoneyVnd, MoneySnapshot };
export * from './inventory';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: MoneyVnd | number | bigint;
  image: string | null;
  category: string | null;
  stock: number;
  isActive: boolean;
  inventoryMode?: import('./inventory').InventoryMode;
  variants?: ProductVariant[];
  reviews?: Review[];
  avgRating?: number;
  reviewCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  brandId?: string | null;
  categoryId?: string | null;
  kind?: string | null;
  segment?: string | null;
  specs?: unknown;
  images?: unknown;
  warrantyConfig?: unknown;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  catalogVersion?: number;
  effectivePrice?: MoneyVnd | number | bigint;
  priceRange?: { min: MoneyVnd; max: MoneyVnd };
  brand?: { id: string; name: string; slug: string } | null;
  categoryRef?: { id: string; name: string; slug: string; kind: string } | null;
  sources?: import('./product-detail').EvidenceRef[];
  detail?: import('./product-detail').ProductDetailDto | null;
}

export interface CartItem {
  productId: string;
  name: string;
  price: MoneyVnd | number | bigint;
  image?: string;
  quantity: number;
  variantId?: string | null;
  variantTitle?: string | null;
  attachedToProductId?: string | null;
  attachedToVariantId?: string | null;
  isAddon?: boolean;
  compatibilityStatus?: string | null;
  caveatAcknowledged?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  variantId?: string | null;
  variantTitle?: string | null;
  quantity: number;
  price: MoneyVnd | number | bigint;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'EXPIRED' | 'REFUNDED';
export type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'ORDER_SHIPPING'
  | 'ORDER_COMPLETED'
  | 'NEW_MESSAGE'
  | 'OTP_SENT'
  | 'WARRANTY_UPDATED'
  | 'RETURN_UPDATED'
  | 'REFUND_COMPLETED'
  | 'SYSTEM_ALERT';
export type MessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';

export interface Order {
  id: string;
  orderCode: string;
  userId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  items: OrderItem[];
  subtotal?: MoneyVnd | number | bigint;
  shippingFee?: MoneyVnd | number | bigint;
  discountAmount?: MoneyVnd | number | bigint;
  couponId?: string | null;
  couponCode?: string | null;
  totalAmount: MoneyVnd | number | bigint;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shipment?: Shipment | null;
  qrContent?: string | null;
  note?: string | null;
  expiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  sender: { id: string; name: string | null; avatar?: string | null };
  content: string;
  type: MessageType;
  imageUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  orderId?: string | null;
  order?: { orderCode: string } | null;
  lastMessage?: string | null;
  lastActiveAt: Date | string;
  participants: { user: { id: string; name: string | null; avatar?: string | null } }[];
  _count?: { messages: number };
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  unreadCount?: number;
}

export interface QRPaymentData {
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
}

export interface BankInfo {
  bankId: string;
  accountNo: string;
  accountName: string;
  displayName: string;
}

export type DiscountType = 'FIXED' | 'PERCENTAGE' | 'FREE_SHIPPING';

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  fixedDiscountAmount?: MoneyVnd | bigint | number | null;
  percentageRate?: number | null;
  maxDiscount?: MoneyVnd | bigint | number | null;
  minOrderAmount?: MoneyVnd | bigint | number | null;
  usageLimit?: number | null;
  usedCount: number;
  perUserLimit?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku?: string | null;
  title: string;
  color?: string | null;
  size?: string | null;
  price: MoneyVnd | number | bigint;
  stock: number;
  image?: string | null;
  isActive: boolean;
  optionValues?: unknown;
  optionHash?: string | null;
  specOverrides?: unknown;
  images?: unknown;
  warrantyConfig?: unknown;
  serializationRequired?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId?: string | null;
  rating: number;
  comment?: string | null;
  images: string[];
  reply?: string | null;
  isApproved: boolean;
  createdAt: Date | string;
  user?: {
    id: string;
    name: string | null;
    avatar?: string | null;
  };
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  product?: Product;
  createdAt: Date | string;
}

export type CarrierName = 'GHN' | 'GHTK' | 'VIETTEL_POST';

export type ShipmentStatus =
  | 'READY_TO_PICK'
  | 'PICKING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED';

export interface Shipment {
  id: string;
  orderId: string;
  carrier: CarrierName;
  trackingCode: string;
  shippingFee: MoneyVnd | number | bigint;
  codAmount: MoneyVnd | number | bigint;
  status: ShipmentStatus;
  estimatedArrival?: Date | string | null;
  shippingLogs?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type WalletTxType = 'REFUND' | 'PURCHASE_PAYMENT' | 'TOPUP';

export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: MoneyVnd | number | bigint;
  type: WalletTxType;
  orderId?: string | null;
  description: string;
  createdAt: Date | string;
}

export interface UserWallet {
  id: string;
  userId: string;
  balance: MoneyVnd | number | bigint;
  transactions?: WalletTransaction[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

import type { StaffPermission } from '@shared/constants/permissions';

export {
  STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  isStaffPermission,
  type StaffPermission,
} from '@shared/constants/permissions';

export interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  address: string | null;
  role: UserRole;
  permissions?: StaffPermission[];
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: string;
  orderCount?: number;
  paidOrderCount?: number;
  totalSpent?: MoneyVnd | number | bigint;
  recentOrders?: Array<{
    id: string;
    orderCode: string;
    totalAmount: MoneyVnd | number | bigint;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
}

// ==========================================
// DTOs & APPLICATION LEVEL TYPES
// ==========================================

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
  price: MoneyVnd | number | bigint;
}

export interface CheckoutTotals {
  subtotal: MoneyVnd | number | bigint;
  shippingFee: MoneyVnd | number | bigint;
  discountAmount: MoneyVnd | number | bigint;
  totalAmount: MoneyVnd | number | bigint;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: Coupon;
  discountAmount: MoneyVnd | number | bigint;
  message?: string;
}

export interface ReconcileInput {
  orderId?: string;
  orderCode?: string;
  amount: MoneyVnd | number | bigint;
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
    amount: MoneyVnd | number | bigint;
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
  totalAmount: MoneyVnd | number | bigint;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'VIETQR' | 'COD' | 'WALLET';
  createdAt: string;
  itemsSummary: string;
}

export interface TopProductDto {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  price: MoneyVnd | number | bigint;
  soldQuantity: number;
  revenue: MoneyVnd | number | bigint;
}

export interface PaymentMethodDistribution {
  vietqr: number;
  cod: number;
  wallet: number;
}

export interface RevenueTrendItem {
  label: string;
  revenue: MoneyVnd | number | bigint;
}

export interface AdminAnalyticsSummary {
  todayRevenue: MoneyVnd | number | bigint;
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

export interface SerializedShipmentLog {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
  rawGhnStatus?: string;
}

export interface SerializedShipment {
  id: string;
  carrier: string;
  trackingCode: string;
  shippingFee: MoneyVnd | number | bigint;
  codAmount: MoneyVnd | number | bigint;
  status: string;
  estimatedArrival?: string | null;
  shippingLogs?: SerializedShipmentLog[];
  createdAt: string;
}

export interface SerializedOrderItem {
  id: string;
  quantity: number;
  price: MoneyVnd | number | bigint;
  product: {
    name: string;
    image?: string | null;
  };
  variantTitle?: string | null;
}

export interface SerializedOrder {
  id: string;
  orderCode: string;
  totalAmount: MoneyVnd | number | bigint;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: SerializedOrderItem[];
  shipment?: SerializedShipment | null;
}

export interface ProductVariantInput {
  id?: string;
  sku: string;
  title: string;
  price: MoneyVnd | number | bigint;
  stock?: number;
  color?: string | null;
  size?: string | null;
  image?: string | null;
  isActive?: boolean;
}

export interface CreateProductDto {
  name: string;
  description?: string | null;
  price: MoneyVnd | number | bigint;
  image?: string | null;
  category?: string | null;
  stock?: number;
  isActive?: boolean;
  variants?: ProductVariantInput[];
}

export interface UpdateProductDto {
  id: string;
  name?: string;
  description?: string | null;
  price?: MoneyVnd | number | bigint;
  image?: string | null;
  category?: string | null;
  stock?: number;
  isActive?: boolean;
  variants?: ProductVariantInput[];
}

export interface WalletTopupRequest {
  amount: MoneyVnd | number | bigint;
}

export interface WalletTopupResponse {
  topupCode: string;
  amount: MoneyVnd | number | bigint;
  qrUrl?: string;
  bankInfo?: {
    bankName: string;
    bankId: string;
    accountNo: string;
    accountName: string;
  };
  idempotencyToken?: string;
}

export interface WalletTopupSession {
  topupCode: string;
  userId: string;
  amount: MoneyVnd | number | bigint;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  idempotencyToken: string;
  createdAt: string;
  completedAt?: string;
  bankTransId?: string;
}

export * from './money';
export * from './catalog';
export * from './catalog-query';
export * from './product-detail';
