import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, checkDistributedRateLimit, getClientIp } from '../src/lib/rate-limit.ts';

describe('Rate Limiting Logic - Synchronous In-Memory', () => {
  it('should allow requests within limit', () => {
    const key = `test-ip-${Date.now()}-1`;
    const res1 = checkRateLimit(key, 3, 1000);
    assert.equal(res1.allowed, true);
    assert.equal(res1.remaining, 2);

    const res2 = checkRateLimit(key, 3, 1000);
    assert.equal(res2.allowed, true);
    assert.equal(res2.remaining, 1);

    const res3 = checkRateLimit(key, 3, 1000);
    assert.equal(res3.allowed, true);
    assert.equal(res3.remaining, 0);
  });

  it('should block requests exceeding limit', () => {
    const key = `test-ip-${Date.now()}-2`;
    checkRateLimit(key, 2, 1000);
    checkRateLimit(key, 2, 1000);

    const blocked = checkRateLimit(key, 2, 1000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
  });

  it('should extract client ip from x-forwarded-for header', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
    });
    assert.equal(getClientIp(req), '203.0.113.195');
  });

  it('should fallback to x-real-ip or 127.0.0.1', () => {
    const reqWithRealIp = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '198.51.100.1' },
    });
    assert.equal(getClientIp(reqWithRealIp), '198.51.100.1');

    const reqEmpty = new Request('http://localhost/api/test');
    assert.equal(getClientIp(reqEmpty), '127.0.0.1');
  });
});

describe('Distributed Rate Limiting Logic - checkDistributedRateLimit', () => {
  it('should allow requests within limit and track remaining count', async () => {
    const key = `dist-ip-${Date.now()}-1`;
    const r1 = await checkDistributedRateLimit(key, 2, 2000);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);

    const r2 = await checkDistributedRateLimit(key, 2, 2000);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);

    const r3 = await checkDistributedRateLimit(key, 2, 2000);
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
  });
});
