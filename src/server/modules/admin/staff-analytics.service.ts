import { prisma } from '../../database/prisma.ts';
import type { StaffPermission } from '../../../shared/constants/permissions.ts';
import {
  type UrgentAction,
  type RecentOrderDto,
  formatItemsSummary,
} from './admin-analytics.service.ts';

export interface StaffDashboardMetrics {
  totalOrders?: number;
  todayOrders?: number;
  pendingOrdersCount?: number;
  processingOrdersCount?: number;
  ordersByStatus?: Record<string, number>;
  activeShipmentsCount?: number;
  deliveredShipmentsCount?: number;
  totalShipmentsCount?: number;
  lowStockCount?: number;
  recentOrders?: RecentOrderDto[];
  urgentActions?: UrgentAction[];
}

/**
 * Loại bỏ 100% các trường tài chính nhạy cảm và chỉ giữ lại dữ liệu vận hành phù hợp quyền
 */
export function sanitizeStaffAnalytics(
  rawMetrics: Record<string, unknown>,
  permissions: (StaffPermission | string)[]
): StaffDashboardMetrics {
  const hasOrders = permissions.includes('orders');
  const hasShipments = permissions.includes('shipments');
  const hasProducts = permissions.includes('products');

  const sanitized: StaffDashboardMetrics = {};

  if (hasOrders) {
    if (typeof rawMetrics.totalOrders === 'number') sanitized.totalOrders = rawMetrics.totalOrders;
    if (typeof rawMetrics.todayOrders === 'number') sanitized.todayOrders = rawMetrics.todayOrders;
    if (typeof rawMetrics.pendingOrdersCount === 'number') sanitized.pendingOrdersCount = rawMetrics.pendingOrdersCount;
    if (typeof rawMetrics.processingOrdersCount === 'number') sanitized.processingOrdersCount = rawMetrics.processingOrdersCount;
    if (rawMetrics.ordersByStatus && typeof rawMetrics.ordersByStatus === 'object') {
      sanitized.ordersByStatus = rawMetrics.ordersByStatus as Record<string, number>;
    }
    if (Array.isArray(rawMetrics.recentOrders)) {
      sanitized.recentOrders = rawMetrics.recentOrders as RecentOrderDto[];
    }
  }

  if (hasShipments) {
    if (typeof rawMetrics.activeShipmentsCount === 'number') sanitized.activeShipmentsCount = rawMetrics.activeShipmentsCount;
    if (typeof rawMetrics.deliveredShipmentsCount === 'number') sanitized.deliveredShipmentsCount = rawMetrics.deliveredShipmentsCount;
    if (typeof rawMetrics.totalShipmentsCount === 'number') sanitized.totalShipmentsCount = rawMetrics.totalShipmentsCount;
  }

  if (hasProducts) {
    if (typeof rawMetrics.lowStockCount === 'number') sanitized.lowStockCount = rawMetrics.lowStockCount;
  }

  // Urgent actions: Chỉ giữ cảnh báo nghiệp vụ liên quan đến đơn, kho hoặc vận chuyển
  if (Array.isArray(rawMetrics.urgentActions)) {
    sanitized.urgentActions = (rawMetrics.urgentActions as UrgentAction[]).filter((action) => {
      if (action.type === 'TRANSACTION_MISMATCH') return false;
      if (action.type === 'LOW_STOCK' && !hasProducts) return false;
      if (action.type === 'NEW_ORDER' && !hasOrders) return false;
      if (action.type === 'SHIPMENT_ISSUE' && !hasShipments) return false;
      return true;
    });
  }

  return sanitized;
}

/**
 * Query trực tiếp từ DB các chỉ số vận hành dành riêng cho STAFF
 */
export async function getStaffDashboardData(
  permissions: (StaffPermission | string)[]
): Promise<StaffDashboardMetrics> {
  const hasOrders = permissions.includes('orders');
  const hasShipments = permissions.includes('shipments');
  const hasProducts = permissions.includes('products');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const [
    totalOrders,
    todayOrders,
    pendingOrdersCount,
    processingOrdersCount,
    ordersByStatusRaw,
    rawRecentOrders,
    activeShipmentsCount,
    deliveredShipmentsCount,
    totalShipmentsCount,
    lowStockCount,
  ] = await Promise.all([
    hasOrders ? prisma.order.count() : Promise.resolve(0),
    hasOrders ? prisma.order.count({ where: { createdAt: { gte: startOfToday } } }) : Promise.resolve(0),
    hasOrders ? prisma.order.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    hasOrders ? prisma.order.count({ where: { status: 'PROCESSING' } }) : Promise.resolve(0),
    hasOrders ? prisma.order.groupBy({ by: ['status'], _count: { id: true } }) : Promise.resolve([]),
    hasOrders
      ? prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { items: { include: { product: true } } },
        })
      : Promise.resolve([]),
    hasShipments ? prisma.shipment.count({ where: { status: 'DELIVERING' } }) : Promise.resolve(0),
    hasShipments ? prisma.shipment.count({ where: { status: 'DELIVERED' } }) : Promise.resolve(0),
    hasShipments ? prisma.shipment.count() : Promise.resolve(0),
    hasProducts ? prisma.product.count({ where: { isActive: true, stock: { lte: 5 } } }) : Promise.resolve(0),
  ]);

  const ordersByStatus: Record<string, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    PROCESSING: 0,
    SHIPPING: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const item of ordersByStatusRaw) {
    ordersByStatus[item.status] = item._count.id;
  }

  const recentOrders = rawRecentOrders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    itemsSummary: formatItemsSummary(order.items),
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  }));

  const urgentActions: UrgentAction[] = [];
  if (hasOrders && pendingOrdersCount > 0) {
    urgentActions.push({
      id: 'urgent-pending-orders',
      type: 'NEW_ORDER',
      title: `${pendingOrdersCount} đơn hàng mới cần xác nhận`,
      description: 'Khách hàng đang chờ duyệt và đóng gói sản phẩm',
      link: '/admin/orders?status=PENDING',
    });
  }
  if (hasProducts && lowStockCount > 0) {
    urgentActions.push({
      id: 'urgent-low-stock',
      type: 'LOW_STOCK',
      title: `${lowStockCount} sản phẩm sắp hết hàng`,
      description: 'Tồn kho còn dưới 5 sản phẩm, cần bổ sung hàng',
      link: '/admin/products',
    });
  }

  return sanitizeStaffAnalytics(
    {
      totalOrders,
      todayOrders,
      pendingOrdersCount,
      processingOrdersCount,
      ordersByStatus,
      recentOrders,
      activeShipmentsCount,
      deliveredShipmentsCount,
      totalShipmentsCount,
      lowStockCount,
      urgentActions,
    },
    permissions
  );
}
