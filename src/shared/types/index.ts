// ==========================================
// CORE DOMAIN ENTITIES & INTERFACES
// ==========================================

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  category: string | null;
  stock: number;
  isActive: boolean;
  variants?: ProductVariant[];
  reviews?: Review[];
  avgRating?: number;
  reviewCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  variantId?: string | null;
  variantTitle?: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  variantId?: string | null;
  variantTitle?: string | null;
  quantity: number;
  price: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'EXPIRED' | 'REFUNDED';
export type NotificationType = 'ORDER_CREATED' | 'ORDER_CONFIRMED' | 'PAYMENT_RECEIVED' | 'ORDER_SHIPPING' | 'ORDER_COMPLETED' | 'NEW_MESSAGE' | 'OTP_SENT';
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
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  couponId?: string | null;
  couponCode?: string | null;
  totalAmount: number;
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
  totalAmount: number;
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
  maxDiscount?: number | null;
  minOrderAmount?: number | null;
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
  price: number;
  stock: number;
  image?: string | null;
  isActive: boolean;
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
  shippingFee: number;
  codAmount: number;
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
  amount: number;
  type: WalletTxType;
  orderId?: string | null;
  description: string;
  createdAt: Date | string;
}

export interface UserWallet {
  id: string;
  userId: string;
  balance: number;
  transactions?: WalletTransaction[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  address: string | null;
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: string;
  orderCount?: number;
  paidOrderCount?: number;
  totalSpent?: number;
  recentOrders?: Array<{
    id: string;
    orderCode: string;
    totalAmount: number;
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
  coupon?: Coupon;
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
  status: OrderStatus;
  paymentStatus: PaymentStatus;
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
  shippingFee: number;
  codAmount: number;
  status: string;
  estimatedArrival?: string | null;
  shippingLogs?: SerializedShipmentLog[];
  createdAt: string;
}

export interface SerializedOrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
    image?: string | null;
  };
  variantTitle?: string | null;
}

export interface SerializedOrder {
  id: string;
  orderCode: string;
  totalAmount: number;
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
  price: number;
  stock?: number;
  color?: string | null;
  size?: string | null;
  image?: string | null;
  isActive?: boolean;
}

export interface CreateProductDto {
  name: string;
  description?: string | null;
  price: number;
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
  price?: number;
  image?: string | null;
  category?: string | null;
  stock?: number;
  isActive?: boolean;
  variants?: ProductVariantInput[];
}

export interface WalletTopupRequest {
  amount: number;
}

export interface WalletTopupResponse {
  topupCode: string;
  orderCode: number;
  amount: number;
  checkoutUrl?: string;
  qrCode?: string;
  qrUrl?: string;
  bankInfo?: {
    bankName: string;
    bankId: string;
    accountNo: string;
    accountName: string;
  };
  paymentLinkId?: string;
  idempotencyToken?: string;
}

export interface WalletTopupSession {
  topupCode: string;
  orderCode: number;
  userId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  idempotencyToken: string;
  createdAt: string;
  completedAt?: string;
  bankTransId?: string;
}
