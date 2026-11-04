import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { AdminProductsView } from '@client/views/admin/AdminProductsView';
import { canAccessAdminPage, canUseAdminOnlyAction } from '@shared/admin-page-access';
import { initialAdminSearchQuery } from '@client/lib/admin-search';
import type { Product } from '@/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý sản phẩm | Quản trị viên Shop QR',
};

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ search?: string | string[] }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canAccessAdminPage(session.user, '/admin/products')) {
    redirect('/');
  }

  const products = await AdminService.getAdminProducts();
  const initialQuery = initialAdminSearchQuery(await searchParams);

  return <AdminProductsView key={initialQuery} initialProducts={products as unknown as Product[]} initialQuery={initialQuery} canDelete={canUseAdminOnlyAction(session.user.role)} />;
}
