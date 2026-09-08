import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, generateOtp } from '../src/lib/otp-utils.ts';

describe('OTP Helper Logic', () => {
  it('should normalize email strings correctly', () => {
    assert.equal(normalizeEmail('  Test.User@Example.COM '), 'test.user@example.com');
    assert.equal(normalizeEmail('USER@DOMAIN.VN'), 'user@domain.vn');
  });

  it('should generate a 6-digit OTP code string', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOtp();
      assert.equal(otp.length, 6);
      assert.match(otp, /^[0-9]{6}$/);
      const num = parseInt(otp, 10);
      assert.ok(num >= 100000 && num <= 999999);
    }
  });
});
