import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { CustomerOrderService } from '@/server/modules/orders/customer-orders.service';
import { OrdersView } from '@client/views/OrdersView';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const orders = await CustomerOrderService.getCustomerOrders(session.user.id, session.user.role);

  return <OrdersView orders={orders} />;
}
