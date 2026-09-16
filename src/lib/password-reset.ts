import bcrypt from 'bcryptjs';
import { normalizeEmail, generateOtp } from './otp-utils.ts';

export { normalizeEmail, generateOtp };

export type OtpType = 'REGISTRATION' | 'PASSWORD_RESET';

export const OTP_COOLDOWN_MS = 60_000;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

export interface OtpCodeRecord {
  id: string;
  email: string;
  code: string;
  type: OtpType;
  used: boolean;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface OtpPrismaDelegate {
  deleteMany(args: {
    where: {
      email?: string;
      OR?: Array<{ expiresAt?: { lt: Date } } | { used?: boolean }>;
    };
  }): Promise<{ count: number }>;

  findFirst(args: {
    where: {
      email: string;
      type?: OtpType;
      used?: boolean;
      expiresAt?: { gt: Date };
    };
    orderBy?: { createdAt: 'asc' | 'desc' };
  }): Promise<OtpCodeRecord | null>;

  create(args: {
    data: {
      email: string;
      code: string;
      type: OtpType;
      expiresAt: Date;
      createdAt?: Date;
    };
  }): Promise<OtpCodeRecord>;

  update(args: {
    where: { id: string };
    data: {
      used?: boolean;
      attempts?: { increment: number };
    };
  }): Promise<OtpCodeRecord>;
}

export interface UserResetDbRecord {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  isVerified: boolean;
  isBlocked: boolean;
}

export interface UserResetPrismaDelegate {
  findUnique(args: { where: { email: string } }): Promise<UserResetDbRecord | null>;
  update(args: {
    where: { email: string };
    data: {
      passwordHash?: string;
      isVerified?: boolean;
    };
  }): Promise<UserResetDbRecord>;
}

/**
 * Validation functions for password reset requests
 */
export function validateForgotPasswordInput(body: unknown): {
  valid: boolean;
  error?: string;
  email?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' };
  }
  const { email } = body as { email?: unknown };
  if (typeof email !== 'string' || !email.trim()) {
    return { valid: false, error: 'Email không được để trống' };
  }
  const trimmed = email.trim();
  if (!trimmed.includes('@') || !trimmed.includes('.')) {
    return { valid: false, error: 'Email không hợp lệ' };
  }
  return { valid: true, email: normalizeEmail(trimmed) };
}

export function validateResetPasswordInput(body: unknown): {
  valid: boolean;
  error?: string;
  data?: {
    email: string;
    otp: string;
    newPassword: string;
  };
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' };
  }
  const { email, otp, newPassword } = body as {
    email?: unknown;
    otp?: unknown;
    newPassword?: unknown;
  };

  const rawEmail = typeof email === 'string' ? email.trim() : '';
  const rawOtp = typeof otp === 'string' ? otp.trim() : '';
  const rawPassword = typeof newPassword === 'string' ? newPassword : '';

  if (!rawEmail || !rawOtp || !rawPassword) {
    return { valid: false, error: 'Vui lòng cung cấp đầy đủ thông tin' };
  }

  if (!rawEmail.includes('@') || !rawEmail.includes('.')) {
    return { valid: false, error: 'Email không hợp lệ' };
  }

  if (rawPassword.length < 6) {
    return { valid: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' };
  }

  return {
    valid: true,
    data: {
      email: normalizeEmail(rawEmail),
      otp: rawOtp,
      newPassword: rawPassword,
    },
  };
}

/**
 * Core sendOtp logic
 */
export async function sendOtpCore({
  rawEmail,
  name = 'Khách hàng',
  type = 'REGISTRATION',
  prismaOtp,
  sendEmailFn,
  now = new Date(),
}: {
  rawEmail: string;
  name?: string;
  type?: OtpType;
  prismaOtp: OtpPrismaDelegate;
  sendEmailFn?: (otp: string, email: string, name: string) => Promise<{ success: boolean; error?: string }>;
  now?: Date;
}): Promise<{ success: boolean; error?: string; otp?: string; record?: OtpCodeRecord }> {
  const email = normalizeEmail(rawEmail);

  await prismaOtp.deleteMany({
    where: {
      email,
      OR: [{ expiresAt: { lt: now } }, { used: true }],
    },
  });

  const lastOtp = await prismaOtp.findFirst({
    where: { email, type },
    orderBy: { createdAt: 'desc' },
  });

  if (lastOtp && now.getTime() - lastOtp.createdAt.getTime() < OTP_COOLDOWN_MS) {
    return { success: false, error: 'Vui lòng đợi 60 giây trước khi gửi lại' };
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  const record = await prismaOtp.create({
    data: {
      email,
      code: hashedOtp,
      type,
      expiresAt,
      createdAt: now,
    },
  });

  if (sendEmailFn) {
    const emailResult = await sendEmailFn(otp, email, name);
    if (!emailResult.success) {
      return { success: false, error: emailResult.error || 'Gửi email thất bại' };
    }
  }

  return { success: true, otp, record };
}

/**
 * Core verifyOtp logic
 */
export async function verifyOtpCore({
  rawEmail,
  inputOtp,
  type = 'REGISTRATION',
  prismaOtp,
  now = new Date(),
}: {
  rawEmail: string;
  inputOtp: string;
  type?: OtpType;
  prismaOtp: OtpPrismaDelegate;
  now?: Date;
}): Promise<boolean> {
  const email = normalizeEmail(rawEmail);

  const otpRecord = await prismaOtp.findFirst({
    where: {
      email,
      type,
      used: false,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord || otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    return false;
  }

  const isValid = await bcrypt.compare(inputOtp, otpRecord.code);
  if (isValid) {
    await prismaOtp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });
    return true;
  }

  await prismaOtp.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  });

  return false;
}

/**
 * Password Hashing Helpers
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * End-to-end reset password execution helper
 */
export async function executePasswordReset({
  email,
  otp,
  newPassword,
  prismaUser,
  prismaOtp,
  now = new Date(),
}: {
  email: string;
  otp: string;
  newPassword: string;
  prismaUser: UserResetPrismaDelegate;
  prismaOtp: OtpPrismaDelegate;
  now?: Date;
}): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  const user = await prismaUser.findUnique({ where: { email } });
  if (!user) {
    return { success: false, error: 'Người dùng không tồn tại', statusCode: 404 };
  }

  if (user.isBlocked) {
    return {
      success: false,
      error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      statusCode: 403,
    };
  }

  const isOtpValid = await verifyOtpCore({
    rawEmail: email,
    inputOtp: otp,
    type: 'PASSWORD_RESET',
    prismaOtp,
    now,
  });

  if (!isOtpValid) {
    return {
      success: false,
      error: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
      statusCode: 400,
    };
  }

  const passwordHash = await hashPassword(newPassword);

  await prismaUser.update({
    where: { email },
    data: {
      passwordHash,
      isVerified: true,
    },
  });

  return { success: true };
}
