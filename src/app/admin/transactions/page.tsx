import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { AdminService } from '@/server/modules/admin/admin.service';
import { AdminTransactionsView } from '@client/views/admin/AdminTransactionsView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Đối soát giao dịch | Quản trị viên Shop QR',
};

export default async function AdminTransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const transactions = await AdminService.getAdminTransactions();

  return <AdminTransactionsView initialTransactions={transactions} />;
}
