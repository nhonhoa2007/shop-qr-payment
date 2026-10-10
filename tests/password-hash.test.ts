import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  hashOtp,
  verifyOtp,
  ARGON2_DEFAULT_CONFIG,
} from '@server/modules/auth/password-hash.service';

describe('Password & OTP Hashing with Argon2id', () => {
  describe('hashPassword', () => {
    it('should generate valid argon2id hash with $argon2id$ prefix', async () => {
      const rawPassword = 'StrongPassword2026!';
      const hash = await hashPassword(rawPassword);

      assert.ok(hash.startsWith('$argon2id$'), `Hash should start with $argon2id$, got: ${hash}`);
      assert.notEqual(hash, rawPassword);
      assert.match(hash, /\$m=\d+,t=\d+,p=\d+\$/);
    });

    it('should generate different hashes for the same password due to random salt', async () => {
      const password = 'ConsistentPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      assert.notEqual(hash1, hash2);
      assert.equal(await verifyPassword(password, hash1), true);
      assert.equal(await verifyPassword(password, hash2), true);
    });

    it('should handle complex unicode passwords properly', async () => {
      const unicodePassword = 'MậtKhẩuKháDài@2026#TiếngViệt🔑';
      const hash = await hashPassword(unicodePassword);

      assert.equal(await verifyPassword(unicodePassword, hash), true);
      assert.equal(await verifyPassword('MatKhauKhaDai@2026#TiengViet', hash), false);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password and false for wrong password', async () => {
      const hash = await hashPassword('CorrectPassword123');

      assert.equal(await verifyPassword('CorrectPassword123', hash), true);
      assert.equal(await verifyPassword('WrongPassword456', hash), false);
      assert.equal(await verifyPassword('correctpassword123', hash), false); // Case-sensitivity
    });

    it('should return false for malformed or empty hash without throwing error', async () => {
      assert.equal(await verifyPassword('AnyPassword', ''), false);
      assert.equal(await verifyPassword('AnyPassword', 'invalid-hash-format'), false);
      assert.equal(await verifyPassword('AnyPassword', '$argon2id$broken$parameters'), false);
    });

    it('should reject legacy bcrypt hash gracefully (cut-over policy)', async () => {
      const legacyBcryptHash = '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm';
      assert.equal(await verifyPassword('AnyPassword', legacyBcryptHash), false);
    });
  });

  describe('hashOtp and verifyOtp', () => {
    it('should hash 6-digit OTP and verify correctly', async () => {
      const otp = '849201';
      const hashedOtp = await hashOtp(otp);

      assert.ok(hashedOtp.startsWith('$argon2id$'));
      assert.equal(await verifyOtp(otp, hashedOtp), true);
      assert.equal(await verifyOtp('123456', hashedOtp), false);
    });

    it('should return false when verifying with malformed OTP hash', async () => {
      assert.equal(await verifyOtp('123456', ''), false);
      assert.equal(await verifyOtp('123456', 'malformed_hash'), false);
    });
  });

  describe('Configuration constants', () => {
    it('should export OWASP / RFC 9106 recommended Argon2id parameters', () => {
      assert.equal(ARGON2_DEFAULT_CONFIG.algorithm, 2); // Argon2id
      assert.equal(ARGON2_DEFAULT_CONFIG.memoryCost, 19456); // 19 MiB
      assert.equal(ARGON2_DEFAULT_CONFIG.timeCost, 2);
      assert.equal(ARGON2_DEFAULT_CONFIG.parallelism, 1);
      assert.equal(ARGON2_DEFAULT_CONFIG.outputLen, 32);
    });
  });
});
