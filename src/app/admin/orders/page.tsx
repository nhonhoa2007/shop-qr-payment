import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { AdminOrdersView } from '@client/views/admin/AdminOrdersView';
import { initialOrderQuery, initialOrderStatus } from '@client/lib/admin-order-filter';
import { canAccessAdminPage } from '@shared/admin-page-access';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý đơn hàng | Quản trị viên Shop QR',
};

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; search?: string | string[]; status?: string | string[] }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccessAdminPage(session.user, '/admin/orders')) {
    redirect('/');
  }

  const serializedOrders = await AdminService.getAdminOrders();
  const params = await searchParams;
  const initialQuery = initialOrderQuery(params);
  const initialStatus = initialOrderStatus(params);

  return <AdminOrdersView key={`${initialQuery}:${initialStatus}`} initialOrders={serializedOrders} initialQuery={initialQuery} initialStatus={initialStatus} />;
}
