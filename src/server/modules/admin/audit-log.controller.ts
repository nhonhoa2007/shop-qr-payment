import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { listAdminAuditLogs } from './audit-log.service';

export async function listAuditLogsHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền xem nhật ký kiểm toán' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || undefined;
  const entityId = searchParams.get('entityId') || undefined;
  const actorId = searchParams.get('actorId') || undefined;
  const action = searchParams.get('action') || undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;
  const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : 0;

  const result = await listAdminAuditLogs(prisma as any, {
    entityType,
    entityId,
    actorId,
    action,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
