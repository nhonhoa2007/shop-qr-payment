// next/server, next-auth và authOptions được nạp động bên trong các hàm guard HTTP
// để module thuần (resolveOperatorAccess) có thể được unit test độc lập với Next.js.
import type { NextResponse } from 'next/server';
import {
  hasStaffPermissionInMemory,
  getStaffPermissions,
} from './permission.service.ts';
import type { StaffPermission } from '../../../shared/constants/permissions.ts';

export interface GuardUser {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
  permissions?: StaffPermission[];
  isBlocked?: boolean;
}

export type GuardResult =
  | {
      authorized: true;
      user: GuardUser;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

/**
 * Kiểm tra quyền của operator trong bộ nhớ dựa trên object user và quyền yêu cầu
 */
export function resolveOperatorAccess(
  user: { role?: string; permissions?: string[] | readonly string[] } | null | undefined,
  permission: StaffPermission
): boolean {
  if (!user || !user.role) return false;

  // 1. ADMIN luôn sở hữu toàn quyền (Bypass check)
  if (user.role === 'ADMIN') return true;

  // 2. STAFF cần sở hữu permission được cấp
  if (user.role === 'STAFF') {
    return hasStaffPermissionInMemory(user.permissions, permission);
  }

  // 3. Các vai trò khác (CUSTOMER, guest) đều bị từ chối
  return false;
}

/**
 * Guard bảo vệ API Route: Yêu cầu quyền Operator tương ứng
 */
export async function requireOperatorPermission(
  permission: StaffPermission
): Promise<GuardResult> {
  const { NextResponse: Res } = await import('next/server');
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('../auth/auth-options.ts');

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      response: Res.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const user = session.user as GuardUser;

  // 1. ADMIN bypass
  if (user.role === 'ADMIN') {
    return { authorized: true, user };
  }

  // 2. STAFF kiểm tra permissions (nếu session chưa có permissions thì query DB fallback)
  if (user.role === 'STAFF') {
    let permissions = user.permissions;
    if (!permissions || permissions.length === 0) {
      permissions = await getStaffPermissions(user.id);
      user.permissions = permissions;
    }

    if (hasStaffPermissionInMemory(permissions, permission)) {
      return { authorized: true, user };
    }
  }

  return {
    authorized: false,
    response: Res.json(
      { error: 'Bạn không có quyền thực hiện chức năng này' },
      { status: 403 }
    ),
  };
}

/**
 * Guard bảo vệ API Route: Độc quyền cho ADMIN (Doanh thu, Phân quyền, Xóa vĩnh viễn)
 */
export async function requireAdmin(): Promise<GuardResult> {
  const { NextResponse: Res } = await import('next/server');
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('../auth/auth-options.ts');

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      response: Res.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (session.user.role !== 'ADMIN') {
    return {
      authorized: false,
      response: Res.json(
        { error: 'Chức năng này chỉ dành riêng cho Quản trị viên cấp cao' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user: session.user as GuardUser };
}
