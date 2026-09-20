export type UrgentActionType =
  | 'TRANSACTION_MISMATCH'
  | 'LOW_STOCK'
  | 'NEW_ORDER'
  | 'SHIPMENT_ISSUE';

export interface UrgentAction {
  id: string;
  type: UrgentActionType;
  title: string;
  description: string;
  link: string;
}

export interface RecentOrderDto {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  itemsSummary: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

export interface TopProductDto {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  category: string | null;
  totalSold: number;
}

export interface PaymentMethodDistribution {
  payosQrPercentage: number;
  walletPercentage: number;
  codPercentage: number;
}

export interface RevenueTrendItem {
  date: string;
  label: string;
  revenue: number;
}

export interface AdminAnalyticsSummary {
  totalRevenue: number;
  todayRevenue: number;
  todayRevenueGrowth: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrdersCount: number;
  processingOrdersCount: number;
  lowStockCount: number;
  totalCustomers: number;
  qrMatchRate: number;
  unmatchedTransactionsCount: number;
  activeShipmentsCount: number;
  totalPaidOrders?: number;
  periodRevenue?: number;
  totalTransactions?: number;
  matchedTransactionsCount?: number;
  deliveredShipmentsCount?: number;
  totalShipmentsCount?: number;
}

export type AnalyticsRange = 'today' | '7days' | 'month';

export interface AdminAnalyticsResponse {
  summary: AdminAnalyticsSummary;
  ordersByStatus: Record<string, number>;
  revenueTrend: RevenueTrendItem[];
  paymentMethodDistribution: PaymentMethodDistribution;
  urgentActions: UrgentAction[];
  recentOrders: RecentOrderDto[];
  topProducts: TopProductDto[];
  range?: AnalyticsRange;
}

/**
 * Tính % tăng trưởng doanh thu so với ngày hôm trước
 */
export function calculateRevenueGrowth(todayRevenue: number, yesterdayRevenue: number): number {
  if (yesterdayRevenue > 0) {
    return Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1));
  }
  if (todayRevenue > 0) {
    return 100;
  }
  return 0;
}

/**
 * Tính tỷ lệ % khớp giao dịch tự động VietQR
 */
export function calculateQrMatchRate(matchedCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 100;
  }
  const safeMatched = Math.max(0, Math.min(matchedCount, totalCount));
  return Number(((safeMatched / totalCount) * 100).toFixed(1));
}

/**
 * Phân bổ kênh thanh toán cho các đơn hàng đã thanh toán
 */
export function calculatePaymentMethodDistribution(
  orders: Array<{
    transaction?: { bankName: string | null } | null;
    shipment?: { codAmount: number } | null;
  }>
): PaymentMethodDistribution {
  const total = orders.length;
  if (total === 0) {
    return {
      payosQrPercentage: 0,
      walletPercentage: 0,
      codPercentage: 0,
    };
  }

  let walletCount = 0;
  let payosQrCount = 0;
  let codCount = 0;

  for (const order of orders) {
    if (order.transaction?.bankName === 'SHOP_WALLET') {
      walletCount++;
    } else if (order.shipment && order.shipment.codAmount > 0 && !order.transaction) {
      codCount++;
    } else if (order.transaction) {
      payosQrCount++;
    } else {
      codCount++;
    }
  }

  return {
    payosQrPercentage: Number(((payosQrCount / total) * 100).toFixed(1)),
    walletPercentage: Number(((walletCount / total) * 100).toFixed(1)),
    codPercentage: Number(((codCount / total) * 100).toFixed(1)),
  };
}

/**
 * Tạo danh sách cảnh báo việc cần xử lý ngay
 */
export function buildUrgentActions(params: {
  unmatchedTransactionsCount: number;
  criticalStockCount: number;
  pendingOrdersCount?: number;
}): UrgentAction[] {
  const { unmatchedTransactionsCount, criticalStockCount, pendingOrdersCount = 0 } = params;
  const actions: UrgentAction[] = [];

  if (unmatchedTransactionsCount > 0) {
    actions.push({
      id: 'action-unmatched-tx',
      type: 'TRANSACTION_MISMATCH',
      title: `${unmatchedTransactionsCount} giao dịch chưa khớp đối soát`,
      description: `Có ${unmatchedTransactionsCount} giao dịch chuyển khoản ngân hàng chưa được khớp tự động với đơn hàng. Cần kiểm tra đối soát ngay.`,
      link: '/admin/transactions',
    });
  }

  if (criticalStockCount > 0) {
    actions.push({
      id: 'action-low-stock',
      type: 'LOW_STOCK',
      title: `${criticalStockCount} sản phẩm sắp hết hàng`,
      description: `Có ${criticalStockCount} sản phẩm có lượng tồn kho còn từ 3 sản phẩm trở xuống. Cần bổ sung nguồn hàng.`,
      link: '/admin/products',
    });
  }

  if (pendingOrdersCount > 0) {
    actions.push({
      id: 'action-pending-orders',
      type: 'NEW_ORDER',
      title: `${pendingOrdersCount} đơn hàng mới chờ duyệt`,
      description: `Có ${pendingOrdersCount} đơn hàng mới đang chờ duyệt và đóng gói gửi đơn vị vận chuyển.`,
      link: '/admin/orders',
    });
  }

  return actions;
}

/**
 * Tóm tắt danh sách sản phẩm trong đơn hàng dạng "Áo Thun x 2, Quần Jean x 1"
 */
export function formatItemsSummary(
  items: Array<{
    product?: { name: string } | null;
    quantity: number;
  }>
): string {
  if (!items || items.length === 0) {
    return 'Không có sản phẩm';
  }

  return items
    .map((item) => `${item.product?.name || 'Sản phẩm'} x ${item.quantity}`)
    .join(', ');
}

/**
 * Định dạng Date thành YYYY-MM-DD an toàn theo múi giờ địa phương
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const VIETNAMESE_WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Lấy nhãn ngày trong tuần kiểu Việt Nam: CN, T2, T3, T4, T5, T6, T7
 */
export function getVietnameseDayLabel(date: Date): string {
  return VIETNAMESE_WEEKDAY_LABELS[date.getDay()] || 'T2';
}

/**
 * Tạo xu hướng doanh thu theo khoảng thời gian:
 * - 'today': 24 giờ trong ngày (00h - 23h)
 * - '7days': 7 ngày gần nhất tính đến hôm nay
 * - 'month': 30 ngày gần nhất tính đến hôm nay
 */
export function buildRevenueTrend(
  referenceDate: Date,
  paidOrders: Array<{ totalAmount: number; createdAt: Date }>,
  range: AnalyticsRange = '7days'
): RevenueTrendItem[] {
  if (range === 'today') {
    return buildHourlyRevenueTrend(referenceDate, paidOrders);
  }

  if (range === 'month') {
    return buildMonthlyRevenueTrend(referenceDate, paidOrders);
  }

  const dailyRevenueMap = new Map<string, { label: string; revenue: number }>();

  for (let i = 0; i < 7; i++) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + i);
    const dateKey = formatDateKey(d);
    const label = getVietnameseDayLabel(d);
    dailyRevenueMap.set(dateKey, { label, revenue: 0 });
  }

  for (const order of paidOrders) {
    const dateKey = formatDateKey(new Date(order.createdAt));
    const item = dailyRevenueMap.get(dateKey);
    if (item) {
      item.revenue += order.totalAmount;
    }
  }

  return Array.from(dailyRevenueMap.entries()).map(([date, item]) => ({
    date,
    label: item.label,
    revenue: item.revenue,
  }));
}

/**
 * Tạo xu hướng doanh thu 24 giờ trong ngày (00h - 23h) cho bộ lọc 'today'
 */
export function buildHourlyRevenueTrend(
  todayDate: Date,
  paidOrders: Array<{ totalAmount: number; createdAt: Date }>
): RevenueTrendItem[] {
  const hourlyMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, 0);
  }

  const baseYear = todayDate.getFullYear();
  const baseMonth = todayDate.getMonth();
  const baseDay = todayDate.getDate();

  for (const order of paidOrders) {
    const d = new Date(order.createdAt);
    if (d.getFullYear() === baseYear && d.getMonth() === baseMonth && d.getDate() === baseDay) {
      const h = d.getHours();
      hourlyMap.set(h, (hourlyMap.get(h) || 0) + order.totalAmount);
    }
  }

  const datePrefix = formatDateKey(todayDate);
  return Array.from(hourlyMap.entries()).map(([hour, revenue]) => {
    const hourStr = String(hour).padStart(2, '0');
    return {
      date: `${datePrefix}T${hourStr}:00:00`,
      label: `${hourStr}h`,
      revenue,
    };
  });
}

/**
 * Tạo xu hướng doanh thu 30 ngày gần nhất cho bộ lọc 'month'
 */
export function buildMonthlyRevenueTrend(
  startDate: Date,
  paidOrders: Array<{ totalAmount: number; createdAt: Date }>
): RevenueTrendItem[] {
  const dailyRevenueMap = new Map<string, { label: string; revenue: number }>();

  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateKey = formatDateKey(d);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = `${day}/${month}`;
    dailyRevenueMap.set(dateKey, { label, revenue: 0 });
  }

  for (const order of paidOrders) {
    const dateKey = formatDateKey(new Date(order.createdAt));
    const item = dailyRevenueMap.get(dateKey);
    if (item) {
      item.revenue += order.totalAmount;
    }
  }

  return Array.from(dailyRevenueMap.entries()).map(([date, item]) => ({
    date,
    label: item.label,
    revenue: item.revenue,
  }));
}

