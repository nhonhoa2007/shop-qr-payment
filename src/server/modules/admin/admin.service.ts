import { prisma } from '@/server/database/prisma';
import { Role } from '@prisma/client';
import { updateUserRbac } from '@/lib/admin-rbac';

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
}
