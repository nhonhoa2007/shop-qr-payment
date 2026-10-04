import { prisma } from '@server/database/prisma';
import { Role } from '@prisma/client';
import { updateUserRbac } from './admin-rbac.service.ts';
import { getCachedAnalytics, setCachedAnalytics } from '@server/infrastructure/redis';
import {
  type AdminAnalyticsResponse,
  type AnalyticsRange,
  calculateRevenueGrowth,
  calculateQrMatchRate,
  calculatePaymentMethodDistribution,
  buildUrgentActions,
  formatItemsSummary,
  buildRevenueTrend,
  buildHourlyRevenueTrend,
  buildMonthlyRevenueTrend,
  buildNewCustomersTrend,
} from './admin-analytics.service.ts';

export interface GetAdminCustomersOptions {
  search?: string;
  role?: 'ALL' | 'CUSTOMER' | 'STAFF' | 'ADMIN' | string;
  status?: 'ALL' | 'ACTIVE' | 'BLOCKED' | string;
}

export class AdminService {
  static async getAdminCustomers(options?: GetAdminCustomersOptions) {
    const { search, role, status } = options || {};

    const where: {
      role?: Role;
      isBlocked?: boolean;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
        phone?: { contains: string; mode: 'insensitive' };
        address?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (role && role !== 'ALL') {
      where.role = role as Role;
    }

    if (status === 'ACTIVE') {
      where.isBlocked = false;
    } else if (status === 'BLOCKED') {
      where.isBlocked = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        staffPermissions: {
          select: { permission: true },
        },
        orders: {
          select: {
            id: true,
            orderCode: true,
            totalAmount: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const paidOrders = u.orders.filter((o) => o.paymentStatus === 'PAID');
      const totalSpent = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        avatar: u.avatar,
        role: u.role,
        permissions: (u.staffPermissions || []).map((sp) => sp.permission),
        isVerified: u.isVerified,
        isBlocked: u.isBlocked,
        createdAt: u.createdAt.toISOString(),
        orderCount: u.orders.length,
        paidOrderCount: paidOrders.length,
        totalSpent,
        recentOrders: u.orders.slice(0, 3).map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        })),
      };
    });
  }

  static async updateUser(params: {
    adminId: string;
    userId: string;
    role?: 'CUSTOMER' | 'STAFF' | 'ADMIN';
    permissions?: string[];
    isBlocked?: boolean;
    isVerified?: boolean;
  }) {
    return updateUserRbac(
      params,
      prisma.user as unknown as Parameters<typeof updateUserRbac>[1]
    );
  }

  static async getAdminOrders() {
    const orders = await prisma.order.findMany({
      include: {
        items: { include: { product: true } },
        transaction: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
      ...order,
      customerEmail: order.customerEmail || undefined,
      note: order.note || undefined,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        product: {
          name: item.product.name,
          image: item.product.image || undefined,
        },
      })),
    }));
  }

  static async getAdminProducts() {
    return prisma.product.findMany({
      include: {
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAdminReviews() {
    const reviews = await prisma.review.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            price: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return JSON.parse(JSON.stringify(reviews));
  }

  static async getAdminShipments() {
    const shipments = await prisma.shipment.findMany({
      include: {
        order: {
          select: {
            id: true,
            orderCode: true,
            customerName: true,
            customerPhone: true,
            customerAddress: true,
            totalAmount: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shipments.map((s) => ({
      id: s.id,
      orderId: s.orderId,
      carrier: s.carrier,
      trackingCode: s.trackingCode,
      shippingFee: s.shippingFee,
      codAmount: s.codAmount,
      status: s.status,
      estimatedArrival: s.estimatedArrival ? s.estimatedArrival.toISOString() : null,
      shippingLogs: (s.shippingLogs as unknown as Array<{
        status: string;
        description: string;
        timestamp: string;
        location?: string;
      }>) || null,
      createdAt: s.createdAt.toISOString(),
      order: {
        id: s.order.id,
        orderCode: s.order.orderCode,
        customerName: s.order.customerName,
        customerPhone: s.order.customerPhone,
        customerAddress: s.order.customerAddress,
        totalAmount: s.order.totalAmount,
        status: s.order.status,
        paymentStatus: s.order.paymentStatus,
      },
    }));
  }

  static async getAdminTransactions() {
    const transactions = await prisma.transaction.findMany({
      include: {
        order: {
          select: {
            id: true,
            orderCode: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            totalAmount: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return JSON.parse(JSON.stringify(transactions));
  }

  static async getAdminAnalytics(range: AnalyticsRange = '7days'): Promise<AdminAnalyticsResponse> {
    // 0. Kiểm tra Redis Cache để giảm tải 20+ query đồng thời vào Database
    const cachedData = await getCachedAnalytics<AdminAnalyticsResponse>(range);
    if (cachedData) {
      return cachedData;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const thirtyDaysAgo = new Date(startOfToday);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const trendStartDate = range === 'today' ? startOfToday : range === 'month' ? thirtyDaysAgo : sevenDaysAgo;
    // Đầu tháng cách đây 11 tháng (để trend khách hàng mới đủ 12 bucket tháng)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);

    const [
      paidOrdersAgg,
      totalOrders,
      ordersByStatusRaw,
      lowStockCount,
      criticalStockCount,
      totalCustomers,
      todayPaidAgg,
      yesterdayPaidAgg,
      todayOrders,
      pendingOrdersCount,
      processingOrdersCount,
      activeShipmentsCount,
      deliveredShipmentsCount,
      totalShipmentsCount,
      totalTransactions,
      unmatchedTransactionsCount,
      paidOrdersForDistribution,
      recentPaidOrders,
      topOrderItems,
      rawRecentOrders,
      recentCustomers,
    ] = await Promise.all([
      // 1. Overall paid orders & revenue
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // 2. Total orders
      prisma.order.count(),
      // 3. Orders by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // 4. Low stock products (stock <= 5)
      prisma.product.count({
        where: { isActive: true, stock: { lte: 5 } },
      }),
      // 5. Critical low stock (stock <= 3) for urgent action
      prisma.product.count({
        where: { isActive: true, stock: { lte: 3 } },
      }),
      // 6. Total customers
      prisma.user.count({
        where: { role: 'CUSTOMER' },
      }),
      // 7. Today paid revenue
      prisma.order.aggregate({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: startOfToday },
        },
        _sum: { totalAmount: true },
      }),
      // 8. Yesterday paid revenue
      prisma.order.aggregate({
        where: {
          paymentStatus: 'PAID',
          createdAt: {
            gte: startOfYesterday,
            lt: startOfToday,
          },
        },
        _sum: { totalAmount: true },
      }),
      // 9. Today orders
      prisma.order.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      // 10. Pending orders
      prisma.order.count({
        where: { status: 'PENDING' },
      }),
      // 11. Processing orders
      prisma.order.count({
        where: { status: 'PROCESSING' },
      }),
      // 12. Active shipments (DELIVERING)
      prisma.shipment.count({
        where: { status: 'DELIVERING' },
      }),
      // 13. Delivered shipments
      prisma.shipment.count({
        where: { status: 'DELIVERED' },
      }),
      // 14. Total shipments
      prisma.shipment.count(),
      // 15. Total transactions
      prisma.transaction.count(),
      // 16. Unmatched transactions (verified: false)
      prisma.transaction.count({
        where: { verified: false },
      }),
      // 17. Paid orders for payment distribution (giới hạn 500 đơn gần nhất thay vì load toàn bộ DB)
      prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        select: {
          transaction: { select: { bankName: true } },
          shipment: { select: { codAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      // 18. Paid orders for revenue trend in range
      prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: trendStartDate },
        },
        select: {
          totalAmount: true,
          createdAt: true,
        },
      }),
      // 19. Top selling products
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: { paymentStatus: 'PAID' },
        },
        _sum: { quantity: true },
        orderBy: {
          _sum: { quantity: 'desc' },
        },
        take: 5,
      }),
      // 20. 5 most recent orders with items and products
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: {
            include: { product: true },
          },
        },
      }),
      // 21. Customers registered trong 12 tháng gần nhất (cho trend khách hàng mới)
      prisma.user.findMany({
        where: { role: 'CUSTOMER', createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true },
      }),
    ]);

    const totalRevenue = paidOrdersAgg._sum.totalAmount || 0;
    const totalPaidOrders = paidOrdersAgg._count.id || 0;
    const todayRevenue = todayPaidAgg._sum.totalAmount || 0;
    const yesterdayRevenue = yesterdayPaidAgg._sum.totalAmount || 0;
    const todayRevenueGrowth = calculateRevenueGrowth(todayRevenue, yesterdayRevenue);

    const matchedTransactions = totalTransactions - unmatchedTransactionsCount;
    const qrMatchRate = calculateQrMatchRate(matchedTransactions, totalTransactions);

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

    const revenueTrend = range === 'today'
      ? buildHourlyRevenueTrend(startOfToday, recentPaidOrders)
      : range === 'month'
      ? buildMonthlyRevenueTrend(thirtyDaysAgo, recentPaidOrders)
      : buildRevenueTrend(sevenDaysAgo, recentPaidOrders);

    const periodRevenue = recentPaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const paymentMethodDistribution = calculatePaymentMethodDistribution(paidOrdersForDistribution);
    const urgentActions = buildUrgentActions({
      unmatchedTransactionsCount,
      criticalStockCount,
      pendingOrdersCount,
    });

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

    const topProductIds = topOrderItems.map((item) => item.productId);
    const topProductsInfo = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, price: true, image: true, category: true },
        })
      : [];
    const productInfoMap = new Map(topProductsInfo.map((p) => [p.id, p]));

    const topProducts = topOrderItems.map((item) => {
      const info = productInfoMap.get(item.productId);
      return {
        productId: item.productId,
        name: info?.name || 'Sản phẩm',
        price: info?.price || 0,
        image: info?.image || null,
        category: info?.category || null,
        totalSold: item._sum.quantity || 0,
      };
    });

    const analyticsResponse: AdminAnalyticsResponse = {
      summary: {
        totalRevenue,
        todayRevenue,
        todayRevenueGrowth,
        totalOrders,
        todayOrders,
        pendingOrdersCount,
        processingOrdersCount,
        lowStockCount,
        totalCustomers,
        qrMatchRate,
        unmatchedTransactionsCount,
        activeShipmentsCount,
        deliveredShipmentsCount,
        totalShipmentsCount,
        totalTransactions,
        matchedTransactionsCount: matchedTransactions,
        totalPaidOrders,
        periodRevenue,
      },
      ordersByStatus,
      revenueTrend,
      newCustomersTrend: buildNewCustomersTrend(now, recentCustomers),
      paymentMethodDistribution,
      urgentActions,
      recentOrders,
      topProducts,
      range,
    };

    // Cache kết quả vào Redis trong 60 giây để tối ưu lượt tải trang kế tiếp
    await setCachedAnalytics(range, analyticsResponse, 60);

    return analyticsResponse;
  }
}

export type { AdminAnalyticsResponse };
