interface OrderListSource {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string;
  totalAmount: { toString(): string } | number;
  status: string;
  paymentStatus: string;
  note: string | null;
  createdAt: Date;
  items: ReadonlyArray<{
    id: string;
    quantity: number;
    price: { toString(): string } | number;
    product: { name: string; image: string | null };
  }>;
}

export function toAdminOrderListItem(order: OrderListSource) {
  return {
    id: order.id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail || undefined,
    customerAddress: order.customerAddress,
    totalAmount: Number(order.totalAmount),
    status: order.status,
    paymentStatus: order.paymentStatus,
    note: order.note || undefined,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: Number(item.price),
      product: { name: item.product.name, image: item.product.image || undefined },
    })),
  };
}
