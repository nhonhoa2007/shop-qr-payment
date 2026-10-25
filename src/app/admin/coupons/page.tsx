import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { AdminCouponsView } from '@client/views/admin/AdminCouponsView';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/');

  return <AdminCouponsView />;
}
