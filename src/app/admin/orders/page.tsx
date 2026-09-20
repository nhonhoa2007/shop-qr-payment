import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { AdminOrdersView } from '@client/views/admin/AdminOrdersView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý đơn hàng | Quản trị viên Shop QR',
};

export default async function AdminOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const serializedOrders = await AdminService.getAdminOrders();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <AdminOrdersView initialOrders={serializedOrders} />
    </div>
  );
}
