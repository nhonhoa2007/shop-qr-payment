import { prisma } from '@server/database/prisma';
import type { SerializedOrder } from '@/client/views/OrdersView';

export class CustomerOrderService {
  /**
   * Lấy lịch sử đơn hàng của người dùng (hoặc toàn bộ nếu là ADMIN)
   */
  static async getCustomerOrders(userId: string, role?: string): Promise<SerializedOrder[]> {
    const orders = await prisma.order.findMany({
      where: role === 'ADMIN' ? {} : { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        product: {
          name: item.product.name,
        },
      })),
    }));
  }

  /**
   * Lấy chi tiết đơn hàng để thực hiện thanh toán QR
   */
  static async getOrderForPayment(orderId: string) {
    return await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        transaction: true,
      },
    });
  }
}
