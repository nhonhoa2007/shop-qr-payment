import { prisma } from '../../database/prisma.ts';
import {
  isStaffPermission,
  type StaffPermission,
} from '../../../shared/constants/permissions.ts';

export type { StaffPermission };

export interface SetStaffPermissionsParams {
  userId: string;
  permissions: unknown[];
  grantedBy: string;
}

/**
 * Lọc và loại bỏ quyền trùng lặp hoặc không hợp lệ từ mảng đầu vào
 */
export function filterValidPermissions(input: unknown[]): StaffPermission[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter(isStaffPermission);
  return Array.from(new Set(valid));
}

/**
 * Kiểm tra nhanh quyền trong bộ nhớ (dựa trên mảng string permissions sẵn có)
 */
export function hasStaffPermissionInMemory(
  permissions: string[] | readonly string[] | undefined | null,
  target: StaffPermission
): boolean {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.includes(target);
}

/**
 * Lấy toàn bộ danh sách permissions của một tài khoản STAFF từ Database
 */
export async function getStaffPermissions(
  userId: string,
  db = prisma
): Promise<StaffPermission[]> {
  if (!userId) return [];

  const records = await db.staffPermission.findMany({
    where: { userId },
    select: { permission: true },
    orderBy: { permission: 'asc' },
  });

  return records
    .map((r) => r.permission)
    .filter(isStaffPermission);
}

/**
 * Kiểm tra xem STAFF có sở hữu một quyền cụ thể trong Database hay không
 */
export async function hasPermission(
  userId: string,
  permission: StaffPermission,
  db = prisma
): Promise<boolean> {
  if (!userId || !isStaffPermission(permission)) return false;

  const record = await db.staffPermission.findUnique({
    where: {
      userId_permission: {
        userId,
        permission,
      },
    },
    select: { id: true },
  });

  return Boolean(record);
}

/**
 * Cấp và cập nhật danh sách permissions cho nhân viên STAFF
 */
export async function setStaffPermissions(
  params: SetStaffPermissionsParams,
  db = prisma
): Promise<StaffPermission[]> {
  const { userId, permissions, grantedBy } = params;
  const validPerms = filterValidPermissions(permissions);

  return await db.$transaction(async (tx) => {
    // 1. Xóa các quyền hiện có của user
    await tx.staffPermission.deleteMany({
      where: { userId },
    });

    // 2. Thêm các quyền mới
    if (validPerms.length > 0) {
      await tx.staffPermission.createMany({
        data: validPerms.map((permission) => ({
          userId,
          permission,
          grantedBy,
        })),
      });
    }

    return validPerms;
  });
}

/**
 * Thu hồi sạch sẽ toàn bộ permissions của user (dùng khi hạ role sang CUSTOMER)
 */
export async function clearStaffPermissions(
  userId: string,
  db = prisma
): Promise<void> {
  if (!userId) return;

  await db.staffPermission.deleteMany({
    where: { userId },
  });
}
