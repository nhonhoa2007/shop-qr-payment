import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    // 1. Total revenue & orders count
    const paidOrders = await prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalRevenue = paidOrders._sum.totalAmount || 0;
    const totalPaidOrders = paidOrders._count.id || 0;
    const totalOrders = await prisma.order.count();

    // 2. Count by Order Status
    const ordersByStatusRaw = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const ordersByStatus: Record<string, number> = {};
    for (const item of ordersByStatusRaw) {
      ordersByStatus[item.status] = item._count.id;
    }

    // 3. Low stock products (stock <= 5)
    const lowStockCount = await prisma.product.count({
      where: { isActive: true, stock: { lte: 5 } },
    });

    // 4. Total registered customers
    const totalCustomers = await prisma.user.count({
      where: { role: 'CUSTOMER' },
    });

    // 5. Recent 7-day revenue trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentPaidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    // Build 7-day map (YYYY-MM-DD)
    const dailyRevenueMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyRevenueMap.set(dateKey, 0);
    }

    for (const order of recentPaidOrders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const current = dailyRevenueMap.get(dateKey) || 0;
      dailyRevenueMap.set(dateKey, current + order.totalAmount);
    }

    const revenueTrend = Array.from(dailyRevenueMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    // 6. Top 5 Best-selling products
    const topOrderItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { paymentStatus: 'PAID' },
      },
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: 5,
    });

    const topProductIds = topOrderItems.map((item) => item.productId);
    const topProductsInfo = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, price: true, image: true, category: true },
    });
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

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalPaidOrders,
        totalOrders,
        lowStockCount,
        totalCustomers,
      },
      ordersByStatus,
      revenueTrend,
      topProducts,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Lỗi tải dữ liệu thống kê' }, { status: 500 });
  }
}
