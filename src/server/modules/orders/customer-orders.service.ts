import { prisma } from '@server/database/prisma';
import type { SerializedOrder, SerializedShipmentLog } from '@shared/types';

export class CustomerOrderService {
  /**
   * Lấy lịch sử đơn hàng của người dùng (hoặc toàn bộ nếu là ADMIN)
   * Kèm thông tin vận đơn GHN Logistics và lộ trình giao hàng trực tiếp
   */
  static async getCustomerOrders(userId: string, role?: string): Promise<SerializedOrder[]> {
    const orders = await prisma.order.findMany({
      where: role === 'ADMIN' ? {} : { userId },
      include: {
        items: { include: { product: true } },
        shipment: true,
      },
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
          image: item.product.image,
        },
        variantTitle: item.variantTitle,
      })),
      shipment: order.shipment
        ? {
            id: order.shipment.id,
            carrier: order.shipment.carrier,
            trackingCode: order.shipment.trackingCode,
            shippingFee: order.shipment.shippingFee,
            codAmount: order.shipment.codAmount,
            status: order.shipment.status,
            estimatedArrival: order.shipment.estimatedArrival
              ? order.shipment.estimatedArrival.toISOString()
              : null,
            shippingLogs: Array.isArray(order.shipment.shippingLogs)
              ? (order.shipment.shippingLogs as unknown as SerializedShipmentLog[])
              : [],
            createdAt: order.shipment.createdAt.toISOString(),
          }
        : null,
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
