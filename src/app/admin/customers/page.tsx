import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CustomerManager } from './customer-manager';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
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

  const customers = users.map((u) => {
    const paidOrders = u.orders.filter((o) => o.paymentStatus === 'PAID');
    const totalSpent = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      avatar: u.avatar,
      isVerified: u.isVerified,
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <CustomerManager initialCustomers={customers} />
    </div>
  );
}
