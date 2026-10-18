import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import { AdminWarrantiesView } from '@client/views/admin/AdminWarrantiesView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý bảo hành | Quản trị viên Shop QR',
};

export default async function AdminWarrantiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'warranties')) {
    redirect('/');
  }

  const claims = await (prisma as any).warrantyClaim.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          orderCode: true,
          status: true,
        },
      },
      orderItem: {
        select: {
          productName: true,
          quantity: true,
        },
      },
    },
    take: 50,
  });

  return <AdminWarrantiesView initialClaims={claims} />;
}
