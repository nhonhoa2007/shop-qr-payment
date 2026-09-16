import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { CustomerManager as AdminCustomersView } from '@/client/views/admin/AdminCustomersView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý Người dùng & Phân quyền | Quản trị viên Shop QR',
};

export default async function AdminCustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const customers = await AdminService.getAdminCustomers();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <AdminCustomersView initialCustomers={customers} />
    </div>
  );
}
