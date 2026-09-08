import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminOrderManager, type AdminOrder } from './order-manager';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const orders = await prisma.order.findMany({
    include: {
      items: { include: { product: true } },
      transaction: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const serializedOrders: AdminOrder[] = orders.map((order) => ({
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <AdminOrderManager initialOrders={serializedOrders} />
    </div>
  );
}
