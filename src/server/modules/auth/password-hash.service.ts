import { hash, verify } from '@node-rs/argon2';

/**
 * Cấu hình Argon2id theo khuyến nghị OWASP / RFC 9106
 */
export const ARGON2_DEFAULT_CONFIG = {
  algorithm: 2, // Algorithm.Argon2id = 2 (tránh lỗi TS2748 khi isolatedModules được bật)
  memoryCost: 19456, // 19 MiB
  timeCost: 2, // 2 iterations
  parallelism: 1, // 1 thread
  outputLen: 32, // 32 bytes digest
} as const;

/**
 * Hash mật khẩu bằng thuật toán Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: ARGON2_DEFAULT_CONFIG.algorithm,
    memoryCost: ARGON2_DEFAULT_CONFIG.memoryCost,
    timeCost: ARGON2_DEFAULT_CONFIG.timeCost,
    parallelism: ARGON2_DEFAULT_CONFIG.parallelism,
    outputLen: ARGON2_DEFAULT_CONFIG.outputLen,
  });
}

/**
 * Xác thực mật khẩu với chuỗi hash Argon2id
 */
export async function verifyPassword(password: string, hashString: string): Promise<boolean> {
  if (!password || !hashString) return false;
  // Cắt đứt hoàn toàn bcrypt cũ theo chính sách cut-over
  if (!hashString.startsWith('$argon2id$')) return false;

  try {
    return await verify(hashString, password);
  } catch {
    return false;
  }
}

/**
 * Hash mã OTP (6 số) bằng Argon2id
 */
export async function hashOtp(otp: string): Promise<string> {
  return hash(otp, {
    algorithm: ARGON2_DEFAULT_CONFIG.algorithm,
    memoryCost: ARGON2_DEFAULT_CONFIG.memoryCost,
    timeCost: ARGON2_DEFAULT_CONFIG.timeCost,
    parallelism: ARGON2_DEFAULT_CONFIG.parallelism,
    outputLen: ARGON2_DEFAULT_CONFIG.outputLen,
  });
}

/**
 * Xác thực mã OTP với chuỗi hash Argon2id
 */
export async function verifyOtp(otp: string, hashString: string): Promise<boolean> {
  if (!otp || !hashString) return false;
  if (!hashString.startsWith('$argon2id$')) return false;

  try {
    return await verify(hashString, otp);
  } catch {
    return false;
  }
}
