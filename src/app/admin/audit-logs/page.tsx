import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@server/database/prisma';
import { listAdminAuditLogs } from '@server/modules/admin/audit-log.service';
import { AdminAuditLogsView } from '@client/views/admin/AdminAuditLogsView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nhật ký kiểm toán | Quản trị viên Shop QR',
};

export default async function AdminAuditLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const { logs, total } = await listAdminAuditLogs(prisma as any, {
    limit: 50,
  });

  return (
    <AdminAuditLogsView
      initialLogs={logs as any}
      total={total}
    />
  );
}
