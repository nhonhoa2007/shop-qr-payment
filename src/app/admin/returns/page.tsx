import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import { bigIntJsonReplacer } from '@server/modules/money/money-serialization';
import { AdminReturnsView } from '@client/views/admin/AdminReturnsView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản lý đổi trả | Quản trị viên Shop QR',
};

export default async function AdminReturnsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'warranties')) {
    redirect('/');
  }

  const returns = await (prisma as any).returnRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          orderCode: true,
          status: true,
        },
      },
    },
    take: 50,
  });

  const safeReturns = JSON.parse(JSON.stringify(returns, bigIntJsonReplacer));
  return <AdminReturnsView initialReturns={safeReturns} />;
}
