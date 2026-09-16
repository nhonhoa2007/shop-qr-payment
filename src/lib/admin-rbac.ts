import bcrypt from 'bcryptjs';

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface AdminUserRecord {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  avatar?: string | null;
  role: Role;
  isVerified: boolean;
  isBlocked: boolean;
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPrismaRbacDelegate {
  findUnique(args: { where: { id?: string; email?: string } }): Promise<AdminUserRecord | null>;
  count(args: { where: { role: Role } }): Promise<number>;
  update(args: {
    where: { id: string };
    data: {
      role?: Role;
      isBlocked?: boolean;
      isVerified?: boolean;
    };
    select?: unknown;
  }): Promise<AdminUserRecord>;
}

export interface UpdateUserParams {
  adminId: string;
  userId: string;
  role?: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  isBlocked?: boolean;
  isVerified?: boolean;
}

export interface UpdateUserResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  user?: Omit<AdminUserRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
}

export function validateUserUpdatePayload(body: unknown): {
  valid: boolean;
  error?: string;
  data?: {
    userId: string;
    role?: 'CUSTOMER' | 'STAFF' | 'ADMIN';
    isBlocked?: boolean;
    isVerified?: boolean;
  };
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' };
  }

  const { userId, id, role, isBlocked, isVerified } = body as {
    userId?: unknown;
    id?: unknown;
    role?: unknown;
    isBlocked?: unknown;
    isVerified?: unknown;
  };

  const resolvedId =
    (typeof userId === 'string' && userId.trim()) ||
    (typeof id === 'string' && id.trim()) ||
    '';

  if (!resolvedId) {
    return { valid: false, error: 'Thiếu mã người dùng (userId)' };
  }

  if (role !== undefined && !['CUSTOMER', 'STAFF', 'ADMIN'].includes(role as string)) {
    return { valid: false, error: 'Vai trò không hợp lệ' };
  }

  if (
    role === undefined &&
    typeof isBlocked !== 'boolean' &&
    typeof isVerified !== 'boolean'
  ) {
    return { valid: false, error: 'Không có dữ liệu cập nhật' };
  }

  return {
    valid: true,
    data: {
      userId: resolvedId,
      role: role as 'CUSTOMER' | 'STAFF' | 'ADMIN' | undefined,
      isBlocked: typeof isBlocked === 'boolean' ? isBlocked : undefined,
      isVerified: typeof isVerified === 'boolean' ? isVerified : undefined,
    },
  };
}

export async function updateUserRbac(
  params: UpdateUserParams,
  prismaUser: UserPrismaRbacDelegate
): Promise<UpdateUserResult> {
  const { adminId, userId, role, isBlocked, isVerified } = params;

  const targetUser = await prismaUser.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return { success: false, error: 'Người dùng không tồn tại', statusCode: 404 };
  }

  // Quy tắc an toàn 1: Admin không thể tự khóa tài khoản của chính mình
  if (userId === adminId && isBlocked === true) {
    return {
      success: false,
      error: 'Bạn không thể tự khóa tài khoản của chính mình',
      statusCode: 400,
    };
  }

  // Quy tắc an toàn 2: Admin không thể hạ quyền nếu là Admin duy nhất trong hệ thống
  if (targetUser.role === 'ADMIN' && role && role !== 'ADMIN') {
    const adminCount = await prismaUser.count({
      where: { role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      return {
        success: false,
        error: 'Không thể hạ quyền Admin duy nhất trong hệ thống',
        statusCode: 400,
      };
    }
  }

  const updateData: {
    role?: Role;
    isBlocked?: boolean;
    isVerified?: boolean;
  } = {};

  if (role !== undefined) {
    if (!['CUSTOMER', 'STAFF', 'ADMIN'].includes(role)) {
      return { success: false, error: 'Vai trò không hợp lệ', statusCode: 400 };
    }
    updateData.role = role;
  }

  if (typeof isBlocked === 'boolean') {
    updateData.isBlocked = isBlocked;
  }

  if (typeof isVerified === 'boolean') {
    updateData.isVerified = isVerified;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Không có dữ liệu cập nhật', statusCode: 400 };
  }

  const updated = await prismaUser.update({
    where: { id: userId },
    data: updateData,
  });

  return {
    success: true,
    user: {
      ...updated,
      createdAt:
        updated.createdAt instanceof Date
          ? updated.createdAt.toISOString()
          : String(updated.createdAt),
      updatedAt:
        updated.updatedAt instanceof Date
          ? updated.updatedAt.toISOString()
          : String(updated.updatedAt),
    },
  };
}

export async function authorizeCredentialsLogin({
  credentials,
  prismaUser,
  comparePassword = bcrypt.compare,
}: {
  credentials?: { email?: string; password?: string } | null;
  prismaUser: {
    findUnique(args: { where: { email: string } }): Promise<AdminUserRecord | null>;
  };
  comparePassword?: (password: string, hash: string) => Promise<boolean>;
}): Promise<{
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isBlocked: boolean;
} | null> {
  if (!credentials?.email || !credentials?.password) return null;
  const email = credentials.email.trim().toLowerCase();

  const user = await prismaUser.findUnique({ where: { email } });
  if (!user || !user.isVerified) return null;

  if (user.isBlocked) {
    throw new Error('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.');
  }

  const passwordHash = user.passwordHash || '';
  const isValid = await comparePassword(credentials.password, passwordHash);
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isBlocked: user.isBlocked,
  };
}
