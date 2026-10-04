import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { AdminAppShell } from '@client/components/admin/layout/AdminAppShell';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bảng điều khiển Quản trị | shop.',
  description: 'Trung tâm quản trị vận hành sàn thương mại điện tử shop.',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')
  ) {
    redirect('/login?callbackUrl=/admin&reason=permission');
  }

  return <AdminAppShell user={session.user}>{children}</AdminAppShell>;
}
