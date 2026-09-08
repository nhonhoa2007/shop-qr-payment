import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCronAuth } from '../src/lib/cron-auth.ts';

describe('Cron Auth Verification', () => {
  const secret = 'super-secret-cron-key';

  it('should return true if no CRON_SECRET is configured', () => {
    const req = new Request('http://localhost:3000/api/cron/expire-orders');
    assert.equal(verifyCronAuth(req, undefined), true);
    assert.equal(verifyCronAuth(req, ''), true);
  });

  it('should authorize with valid Bearer token in Authorization header', () => {
    const req = new Request('http://localhost:3000/api/cron/expire-orders', {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });
    assert.equal(verifyCronAuth(req, secret), true);
  });

  it('should authorize with valid secret query parameter', () => {
    const req = new Request(`http://localhost:3000/api/cron/expire-orders?secret=${secret}`);
    assert.equal(verifyCronAuth(req, secret), true);
  });

  it('should authorize if either Bearer token or secret query param is valid', () => {
    const req = new Request(`http://localhost:3000/api/cron/expire-orders?secret=${secret}`, {
      headers: {
        Authorization: 'Bearer wrong-secret',
      },
    });
    assert.equal(verifyCronAuth(req, secret), true);
  });

  it('should reject when Authorization header has wrong token', () => {
    const req = new Request('http://localhost:3000/api/cron/expire-orders', {
      headers: {
        Authorization: 'Bearer wrong-token',
      },
    });
    assert.equal(verifyCronAuth(req, secret), false);
  });

  it('should reject when query param has wrong secret', () => {
    const req = new Request('http://localhost:3000/api/cron/expire-orders?secret=wrong');
    assert.equal(verifyCronAuth(req, secret), false);
  });

  it('should reject when neither header nor query param is provided', () => {
    const req = new Request('http://localhost:3000/api/cron/expire-orders');
    assert.equal(verifyCronAuth(req, secret), false);
  });
});
