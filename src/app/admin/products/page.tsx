import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { AdminProductManager as AdminProductsView } from '@/client/views/admin/AdminProductsView';
import type { Product } from '@/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý sản phẩm | Quản trị viên Shop QR',
};

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const products = await AdminService.getAdminProducts();

  return <AdminProductsView initialProducts={products as unknown as Product[]} />;
}
