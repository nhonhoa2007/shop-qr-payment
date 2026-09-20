import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { AdminShipmentsView } from '@client/views/admin/AdminShipmentsView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý Vận đơn GHN - Admin Shop QR',
  description: 'Theo dõi lộ trình giao nhận bưu phẩm và quản lý vận đơn GHN',
};

export default async function AdminShipmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const shipments = await AdminService.getAdminShipments();

  return <AdminShipmentsView initialShipments={shipments} />;
}
