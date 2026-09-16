import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  validateForgotPasswordInput,
  validateResetPasswordInput,
  sendOtpCore,
  verifyOtpCore,
  hashPassword,
  verifyPassword,
  executePasswordReset,
  type OtpCodeRecord,
  type OtpPrismaDelegate,
  type UserResetDbRecord,
  type UserResetPrismaDelegate,
} from '../src/lib/password-reset.ts';

// ─── Helpers: In-memory mock delegates ──────────────────────────────────────

function createMockOtpPrisma() {
  const records: OtpCodeRecord[] = [];
  let idCounter = 1;

  const delegate: OtpPrismaDelegate = {
    async deleteMany({ where }) {
      const initialCount = records.length;
      const now = new Date();
      for (let i = records.length - 1; i >= 0; i--) {
        const item = records[i];
        const matchEmail = !where.email || item.email === where.email;
        if (!matchEmail) continue;
        const expired = item.expiresAt < now;
        const used = item.used;
        if (expired || used) {
          records.splice(i, 1);
        }
      }
      return { count: initialCount - records.length };
    },
    async findFirst({ where, orderBy }) {
      const filtered = records.filter((r) => {
        if (where.email && r.email !== where.email) return false;
        if (where.type && r.type !== where.type) return false;
        if (where.used !== undefined && r.used !== where.used) return false;
        if (where.expiresAt?.gt && !(r.expiresAt > where.expiresAt.gt)) return false;
        return true;
      });
      if (orderBy?.createdAt === 'desc') {
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return filtered[0] || null;
    },
    async create({ data }) {
      const record: OtpCodeRecord = {
        id: `otp_${idCounter++}`,
        email: data.email,
        code: data.code,
        type: data.type,
        used: false,
        attempts: 0,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt ?? new Date(),
      };
      records.push(record);
      return record;
    },
    async update({ where, data }) {
      const record = records.find((r) => r.id === where.id);
      if (!record) throw new Error('Record not found');
      if (data.used !== undefined) record.used = data.used;
      if (data.attempts?.increment) record.attempts += data.attempts.increment;
      return record;
    },
  };

  return { delegate, records };
}

function createMockUserPrisma(initialUsers: Record<string, UserResetDbRecord> = {}) {
  const users: Record<string, UserResetDbRecord> = { ...initialUsers };

  const delegate: UserResetPrismaDelegate = {
    async findUnique({ where }) {
      return users[where.email] || null;
    },
    async update({ where, data }) {
      const user = users[where.email];
      if (!user) throw new Error('User not found');
      if (data.passwordHash !== undefined) user.passwordHash = data.passwordHash;
      if (data.isVerified !== undefined) user.isVerified = data.isVerified;
      return user;
    },
  };

  return { delegate, users };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('Password Reset - Input Validation', () => {
  it('should reject missing or non-string email for forgot password', () => {
    assert.equal(validateForgotPasswordInput(null).valid, false);
    assert.equal(validateForgotPasswordInput({}).valid, false);
    assert.equal(validateForgotPasswordInput({ email: '' }).valid, false);
    assert.equal(validateForgotPasswordInput({ email: '   ' }).valid, false);
    assert.equal(validateForgotPasswordInput({ email: 12345 }).valid, false);
  });

  it('should reject invalid email format without @ or domain dot', () => {
    assert.equal(validateForgotPasswordInput({ email: 'invalidemail' }).valid, false);
    assert.equal(validateForgotPasswordInput({ email: 'invalid@domain' }).valid, false);
    assert.equal(validateForgotPasswordInput({ email: '@nodomain.com' }).valid, true); // contains @ and .
  });

  it('should normalize valid email with uppercase letters and spaces', () => {
    const res = validateForgotPasswordInput({ email: '  User.Test@Example.COM ' });
    assert.equal(res.valid, true);
    assert.equal(res.email, 'user.test@example.com');
  });

  it('should reject missing fields for reset password', () => {
    assert.equal(validateResetPasswordInput(null).valid, false);
    assert.equal(validateResetPasswordInput({}).valid, false);
    assert.equal(validateResetPasswordInput({ email: 'user@test.com', otp: '123456' }).valid, false);
    assert.equal(validateResetPasswordInput({ email: 'user@test.com', newPassword: 'password123' }).valid, false);
    assert.equal(validateResetPasswordInput({ otp: '123456', newPassword: 'password123' }).valid, false);
    assert.equal(validateResetPasswordInput({ email: 'user@test.com', otp: '123456', newPassword: '' }).valid, false);
  });

  it('should reject new password shorter than 6 characters', () => {
    const shortPasswords = ['1', '12', '123', '1234', '12345', 'abcde'];
    for (const pwd of shortPasswords) {
      const res = validateResetPasswordInput({
        email: 'user@example.com',
        otp: '123456',
        newPassword: pwd,
      });
      assert.equal(res.valid, false);
      assert.match(res.error || '', /ít nhất 6 ký tự/);
    }
  });

  it('should accept valid new password with 6 or more characters', () => {
    const validPasswords = ['123456', 'secure_pass', 'P@ssw0rd2026!#$', 'mật khẩu tiếng việt'];
    for (const pwd of validPasswords) {
      const res = validateResetPasswordInput({
        email: 'user@example.com',
        otp: '654321',
        newPassword: pwd,
      });
      assert.equal(res.valid, true);
      assert.equal(res.data?.newPassword, pwd);
      assert.equal(res.data?.otp, '654321');
      assert.equal(res.data?.email, 'user@example.com');
    }
  });
});

describe('Password Reset - sendOtp Core Logic (PASSWORD_RESET)', () => {
  it('should create OtpCode record with type PASSWORD_RESET and 5-minute TTL', async () => {
    const { delegate, records } = createMockOtpPrisma();
    const fixedNow = new Date('2026-09-16T10:00:00.000Z');

    const result = await sendOtpCore({
      rawEmail: 'Reset.User@Shop.VN',
      name: 'Nguyen Van A',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: fixedNow,
    });

    assert.equal(result.success, true);
    assert.ok(result.otp);
    assert.equal(result.otp.length, 6);
    assert.equal(records.length, 1);

    const record = records[0];
    assert.equal(record.email, 'reset.user@shop.vn');
    assert.equal(record.type, 'PASSWORD_RESET');
    assert.equal(record.used, false);
    assert.equal(record.attempts, 0);

    // TTL check: 5 minutes = 300,000ms
    assert.equal(record.expiresAt.getTime() - fixedNow.getTime(), 5 * 60 * 1000);

    // Verify stored code is a valid bcrypt hash
    const isCodeHashed = await bcrypt.compare(result.otp, record.code);
    assert.equal(isCodeHashed, true);
  });

  it('should enforce 60s cooldown and reject send requests within 60s', async () => {
    const { delegate } = createMockOtpPrisma();
    const startTime = new Date('2026-09-16T10:00:00.000Z');

    // First send: success
    const firstRes = await sendOtpCore({
      rawEmail: 'user@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: startTime,
    });
    assert.equal(firstRes.success, true);

    // Attempt to resend after 30 seconds: should be blocked by 60s cooldown
    const earlyTime = new Date(startTime.getTime() + 30_000);
    const earlyRes = await sendOtpCore({
      rawEmail: 'user@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: earlyTime,
    });
    assert.equal(earlyRes.success, false);
    assert.match(earlyRes.error || '', /đợi 60 giây/i);

    // Attempt to resend after 59 seconds: still blocked
    const almostTime = new Date(startTime.getTime() + 59_000);
    const almostRes = await sendOtpCore({
      rawEmail: 'user@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: almostTime,
    });
    assert.equal(almostRes.success, false);

    // Attempt to resend after 61 seconds: allowed
    const validTime = new Date(startTime.getTime() + 61_000);
    const validRes = await sendOtpCore({
      rawEmail: 'user@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: validTime,
    });
    assert.equal(validRes.success, true);
  });

  it('should not block cooldown if previous OTP was for a different type (REGISTRATION vs PASSWORD_RESET)', async () => {
    const { delegate } = createMockOtpPrisma();
    const startTime = new Date('2026-09-16T10:00:00.000Z');

    // Send REGISTRATION OTP
    await sendOtpCore({
      rawEmail: 'user@shop.vn',
      type: 'REGISTRATION',
      prismaOtp: delegate,
      now: startTime,
    });

    // Send PASSWORD_RESET OTP 10 seconds later: should succeed because type is different
    const tenSecLater = new Date(startTime.getTime() + 10_000);
    const resetRes = await sendOtpCore({
      rawEmail: 'user@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: tenSecLater,
    });
    assert.equal(resetRes.success, true);
  });

  it('should invoke email sender callback with generated OTP', async () => {
    const { delegate } = createMockOtpPrisma();
    let emailSentWith: { otp: string; email: string; name: string } | null = null;

    const res = await sendOtpCore({
      rawEmail: 'customer@gmail.com',
      name: 'Tran B',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      sendEmailFn: async (otp, email, name) => {
        emailSentWith = { otp, email, name };
        return { success: true };
      },
    });

    assert.equal(res.success, true);
    assert.ok(emailSentWith);
    assert.equal(emailSentWith?.email, 'customer@gmail.com');
    assert.equal(emailSentWith?.name, 'Tran B');
    assert.equal(emailSentWith?.otp, res.otp);
  });
});

describe('Password Reset - verifyOtp Core Logic (PASSWORD_RESET)', () => {
  it('should return true and mark used = true when OTP is correct', async () => {
    const { delegate, records } = createMockOtpPrisma();
    const sendTime = new Date('2026-09-16T10:00:00.000Z');

    const sendRes = await sendOtpCore({
      rawEmail: 'verify@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: sendTime,
    });
    const generatedOtp = sendRes.otp!;

    const verifyTime = new Date(sendTime.getTime() + 10_000);
    const isSuccess = await verifyOtpCore({
      rawEmail: 'verify@shop.vn',
      inputOtp: generatedOtp,
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: verifyTime,
    });

    assert.equal(isSuccess, true);
    assert.equal(records[0].used, true);
    assert.equal(records[0].attempts, 0);
  });

  it('should return false and increment attempts when OTP is incorrect', async () => {
    const { delegate, records } = createMockOtpPrisma();
    const sendTime = new Date('2026-09-16T10:00:00.000Z');

    await sendOtpCore({
      rawEmail: 'verify@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: sendTime,
    });

    const isSuccess = await verifyOtpCore({
      rawEmail: 'verify@shop.vn',
      inputOtp: '000000', // incorrect OTP
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: new Date(sendTime.getTime() + 5_000),
    });

    assert.equal(isSuccess, false);
    assert.equal(records[0].used, false);
    assert.equal(records[0].attempts, 1);
  });

  it('should lock out and reject after reaching MAX_OTP_ATTEMPTS (5 attempts)', async () => {
    const { delegate, records } = createMockOtpPrisma();
    const sendTime = new Date('2026-09-16T10:00:00.000Z');

    const sendRes = await sendOtpCore({
      rawEmail: 'lockout@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: sendTime,
    });
    const correctOtp = sendRes.otp!;

    // Perform 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await verifyOtpCore({
        rawEmail: 'lockout@shop.vn',
        inputOtp: `wrong${i}`,
        type: 'PASSWORD_RESET',
        prismaOtp: delegate,
        now: new Date(sendTime.getTime() + i * 1000),
      });
      assert.equal(res, false);
      assert.equal(records[0].attempts, i);
    }

    // 5th failed attempt: reaches max attempts (5)
    const fifthRes = await verifyOtpCore({
      rawEmail: 'lockout@shop.vn',
      inputOtp: 'wrong5',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: new Date(sendTime.getTime() + 5000),
    });
    assert.equal(fifthRes, false);
    assert.equal(records[0].attempts, 5);

    // 6th attempt with the CORRECT OTP: must still be rejected due to lockout
    const correctRes = await verifyOtpCore({
      rawEmail: 'lockout@shop.vn',
      inputOtp: correctOtp,
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: new Date(sendTime.getTime() + 6000),
    });
    assert.equal(correctRes, false, 'Should reject correct OTP when max attempts exceeded');
    assert.equal(records[0].used, false);
  });

  it('should reject expired OTP (> 5 minutes)', async () => {
    const { delegate } = createMockOtpPrisma();
    const sendTime = new Date('2026-09-16T10:00:00.000Z');

    const sendRes = await sendOtpCore({
      rawEmail: 'expired@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: sendTime,
    });
    const correctOtp = sendRes.otp!;

    // 5 minutes + 1 second later
    const expiredTime = new Date(sendTime.getTime() + 5 * 60 * 1000 + 1000);
    const isSuccess = await verifyOtpCore({
      rawEmail: 'expired@shop.vn',
      inputOtp: correctOtp,
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: expiredTime,
    });

    assert.equal(isSuccess, false);
  });

  it('should reject already used OTP to prevent replay attacks', async () => {
    const { delegate } = createMockOtpPrisma();
    const sendTime = new Date('2026-09-16T10:00:00.000Z');

    const sendRes = await sendOtpCore({
      rawEmail: 'replay@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: sendTime,
    });
    const correctOtp = sendRes.otp!;

    // 1st verify: success
    const firstVerify = await verifyOtpCore({
      rawEmail: 'replay@shop.vn',
      inputOtp: correctOtp,
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: new Date(sendTime.getTime() + 10_000),
    });
    assert.equal(firstVerify, true);

    // 2nd verify with same OTP: rejected
    const replayVerify = await verifyOtpCore({
      rawEmail: 'replay@shop.vn',
      inputOtp: correctOtp,
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: new Date(sendTime.getTime() + 15_000),
    });
    assert.equal(replayVerify, false);
  });

  it('should reject OTP if type does not match (REGISTRATION vs PASSWORD_RESET)', async () => {
    const { delegate } = createMockOtpPrisma();
    const sendTime = new Date('2026-09-16T10:00:00.000Z');

    // Send REGISTRATION OTP
    const sendRes = await sendOtpCore({
      rawEmail: 'mismatch@shop.vn',
      type: 'REGISTRATION',
      prismaOtp: delegate,
      now: sendTime,
    });

    // Try to verify as PASSWORD_RESET
    const isSuccess = await verifyOtpCore({
      rawEmail: 'mismatch@shop.vn',
      inputOtp: sendRes.otp!,
      type: 'PASSWORD_RESET',
      prismaOtp: delegate,
      now: new Date(sendTime.getTime() + 5_000),
    });
    assert.equal(isSuccess, false);
  });
});

describe('Password Reset - Bcryptjs Hashing & Security', () => {
  it('should generate valid bcrypt hash with salt prefix $2a$ or $2b$', async () => {
    const rawPassword = 'SecretPassword123!';
    const hash = await hashPassword(rawPassword);

    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
    assert.notEqual(hash, rawPassword);
    assert.equal(hash.length, 60);
  });

  it('should generate different hashes for the same password due to random salt', async () => {
    const password = 'IdenticalPassword2026';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    assert.notEqual(hash1, hash2);
    assert.equal(await verifyPassword(password, hash1), true);
    assert.equal(await verifyPassword(password, hash2), true);
  });

  it('should return true for matching password and false for wrong password', async () => {
    const hash = await hashPassword('MyCorrectPassword');
    assert.equal(await verifyPassword('MyCorrectPassword', hash), true);
    assert.equal(await verifyPassword('WrongPassword', hash), false);
    assert.equal(await verifyPassword('mycorrectpassword', hash), false); // Case-sensitive
  });
});

describe('Password Reset - Full End-to-End Workflow', () => {
  it('should execute full password reset cycle and update database', async () => {
    const { delegate: otpDelegate } = createMockOtpPrisma();
    const oldPasswordHash = await hashPassword('OldSecret123');

    const { delegate: userDelegate, users } = createMockUserPrisma({
      'customer@shop.vn': {
        id: 'u_1',
        email: 'customer@shop.vn',
        name: 'Nguyen Van C',
        passwordHash: oldPasswordHash,
        isVerified: true,
        isBlocked: false,
      },
    });

    const now = new Date('2026-09-16T10:00:00.000Z');

    // 1. User requests password reset OTP
    const sendRes = await sendOtpCore({
      rawEmail: 'customer@shop.vn',
      type: 'PASSWORD_RESET',
      prismaOtp: otpDelegate,
      now,
    });
    assert.equal(sendRes.success, true);
    const otp = sendRes.otp!;

    // 2. User attempts with invalid OTP
    const failedAttempt = await executePasswordReset({
      email: 'customer@shop.vn',
      otp: '999999',
      newPassword: 'BrandNewPassword2026',
      prismaUser: userDelegate,
      prismaOtp: otpDelegate,
      now: new Date(now.getTime() + 10_000),
    });
    assert.equal(failedAttempt.success, false);
    assert.equal(failedAttempt.statusCode, 400);

    // Verify password hash in DB is unchanged
    assert.equal(users['customer@shop.vn'].passwordHash, oldPasswordHash);

    // 3. User submits correct OTP with new password
    const successReset = await executePasswordReset({
      email: 'customer@shop.vn',
      otp,
      newPassword: 'BrandNewPassword2026',
      prismaUser: userDelegate,
      prismaOtp: otpDelegate,
      now: new Date(now.getTime() + 20_000),
    });
    assert.equal(successReset.success, true);

    // 4. Verify password was updated in DB
    const updatedUser = users['customer@shop.vn'];
    assert.notEqual(updatedUser.passwordHash, oldPasswordHash);
    assert.equal(await verifyPassword('BrandNewPassword2026', updatedUser.passwordHash), true);
    assert.equal(await verifyPassword('OldSecret123', updatedUser.passwordHash), false);

    // 5. Replay attempt with same OTP must be rejected
    const replayReset = await executePasswordReset({
      email: 'customer@shop.vn',
      otp,
      newPassword: 'AnotherPassword',
      prismaUser: userDelegate,
      prismaOtp: otpDelegate,
      now: new Date(now.getTime() + 30_000),
    });
    assert.equal(replayReset.success, false);
  });

  it('should reject password reset when user does not exist (404)', async () => {
    const { delegate: otpDelegate } = createMockOtpPrisma();
    const { delegate: userDelegate } = createMockUserPrisma();

    const res = await executePasswordReset({
      email: 'nonexistent@shop.vn',
      otp: '123456',
      newPassword: 'NewPassword123',
      prismaUser: userDelegate,
      prismaOtp: otpDelegate,
    });

    assert.equal(res.success, false);
    assert.equal(res.statusCode, 404);
    assert.match(res.error || '', /không tồn tại/i);
  });

  it('should reject password reset when user is blocked (403)', async () => {
    const { delegate: otpDelegate } = createMockOtpPrisma();
    const { delegate: userDelegate } = createMockUserPrisma({
      'blocked@shop.vn': {
        id: 'u_blocked',
        email: 'blocked@shop.vn',
        name: 'Blocked User',
        passwordHash: 'hash',
        isVerified: true,
        isBlocked: true, // BLOCKED
      },
    });

    const res = await executePasswordReset({
      email: 'blocked@shop.vn',
      otp: '123456',
      newPassword: 'NewPassword123',
      prismaUser: userDelegate,
      prismaOtp: otpDelegate,
    });

    assert.equal(res.success, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.error || '', /đã bị khóa/i);
  });
});
