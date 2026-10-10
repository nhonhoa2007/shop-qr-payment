import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { getStaffPermissions } from '@server/modules/admin/permission.service';
import { getStaffDashboardData } from '@server/modules/admin/staff-analytics.service';
import type { StaffPermission } from '@shared/constants/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'STAFF' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    let permissions = (session.user as { permissions?: StaffPermission[] }).permissions;
    if (!permissions || permissions.length === 0) {
      if (session.user.role === 'ADMIN') {
        permissions = ['orders', 'products', 'shipments', 'chat', 'reviews'];
      } else {
        permissions = await getStaffPermissions(session.user.id);
      }
    }

    const data = await getStaffDashboardData(permissions);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Fetch staff analytics error:', error);
    return NextResponse.json({ error: 'Lỗi tải dữ liệu báo cáo vận hành' }, { status: 500 });
  }
}
