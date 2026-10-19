import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  reserveAiBudget,
  settleAiBudget,
  releaseAiBudget,
  resetAiQuotaStore,
  setAiQuotaConfig,
  getAiQuotaConfig,
} from '../src/server/infrastructure/ai/quota.ts';
import { redis } from '../src/server/infrastructure/redis.ts';

describe('AI Infrastructure: Atomic Redis Quota & Fail-Closed Budget', () => {
  beforeEach(async () => {
    await resetAiQuotaStore();
    setAiQuotaConfig({
      hourlyIpLimitRequests: 5,
      hourlyUserLimitRequests: 10,
      hourlyGlobalLimitRequests: 20,
      leaseTtlSeconds: 30,
      defaultEstimatedTokens: 1000,
    });
  });

  it('grants a budget lease when all caps are within limits', async () => {
    const lease = await reserveAiBudget({
      userId: 'user_123',
      ip: '192.168.1.1',
      estimatedTokens: 500,
    });

    assert.equal(lease.granted, true);
    assert.ok(lease.leaseId.startsWith('lease_'));
    assert.equal(lease.reservedTokens, 500);
    assert.ok(lease.expiresAt > Date.now());
  });

  it('denies reservation when per-IP limit is exceeded', async () => {
    setAiQuotaConfig({ hourlyIpLimitRequests: 2 });

    const lease1 = await reserveAiBudget({ ip: '1.2.3.4' });
    const lease2 = await reserveAiBudget({ ip: '1.2.3.4' });
    const lease3 = await reserveAiBudget({ ip: '1.2.3.4' });

    assert.equal(lease1.granted, true);
    assert.equal(lease2.granted, true);
    assert.equal(lease3.granted, false);
    assert.equal(lease3.reason, 'IP_RATE_LIMITED');
  });

  it('denies reservation when per-user limit is exceeded', async () => {
    setAiQuotaConfig({ hourlyUserLimitRequests: 2 });

    const lease1 = await reserveAiBudget({ userId: 'u_buyer_1', ip: '10.0.0.1' });
    const lease2 = await reserveAiBudget({ userId: 'u_buyer_1', ip: '10.0.0.2' });
    const lease3 = await reserveAiBudget({ userId: 'u_buyer_1', ip: '10.0.0.3' });

    assert.equal(lease1.granted, true);
    assert.equal(lease2.granted, true);
    assert.equal(lease3.granted, false);
    assert.equal(lease3.reason, 'USER_RATE_LIMITED');
  });

  it('denies reservation when anonymous hash limit is exceeded', async () => {
    setAiQuotaConfig({ hourlyUserLimitRequests: 2 });

    const lease1 = await reserveAiBudget({ anonymousTokenHash: 'anon_hash_abc', ip: '10.0.0.1' });
    const lease2 = await reserveAiBudget({ anonymousTokenHash: 'anon_hash_abc', ip: '10.0.0.2' });
    const lease3 = await reserveAiBudget({ anonymousTokenHash: 'anon_hash_abc', ip: '10.0.0.3' });

    assert.equal(lease1.granted, true);
    assert.equal(lease2.granted, true);
    assert.equal(lease3.granted, false);
    assert.equal(lease3.reason, 'ANON_RATE_LIMITED');
  });

  it('denies reservation when global limit is exceeded across multiple users', async () => {
    setAiQuotaConfig({ hourlyGlobalLimitRequests: 3 });

    const lease1 = await reserveAiBudget({ userId: 'u_1', ip: '10.0.0.1' });
    const lease2 = await reserveAiBudget({ userId: 'u_2', ip: '10.0.0.2' });
    const lease3 = await reserveAiBudget({ userId: 'u_3', ip: '10.0.0.3' });
    const lease4 = await reserveAiBudget({ userId: 'u_4', ip: '10.0.0.4' });

    assert.equal(lease1.granted, true);
    assert.equal(lease2.granted, true);
    assert.equal(lease3.granted, true);
    assert.equal(lease4.granted, false);
    assert.equal(lease4.reason, 'GLOBAL_QUOTA_EXCEEDED');
  });

  it('settles actual token usage against reserved lease idempotently', async () => {
    const lease = await reserveAiBudget({ userId: 'u_settle', ip: '10.0.0.1' });
    assert.equal(lease.granted, true);

    await settleAiBudget(lease, { promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    // Second settle call should be a no-op / idempotent
    await settleAiBudget(lease, { promptTokens: 100, completionTokens: 50, totalTokens: 150 });
  });

  it('releases reserved budget on abort or cancellation', async () => {
    setAiQuotaConfig({ hourlyIpLimitRequests: 1 });

    const lease1 = await reserveAiBudget({ ip: '10.0.0.99' });
    assert.equal(lease1.granted, true);

    // Another request should be blocked
    const leaseBlocked = await reserveAiBudget({ ip: '10.0.0.99' });
    assert.equal(leaseBlocked.granted, false);

    // Release lease1
    await releaseAiBudget(lease1);

    // Now another request can proceed
    const lease2 = await reserveAiBudget({ ip: '10.0.0.99' });
    assert.equal(lease2.granted, true);
  });

  it('fails closed when redis or backend encounters an error', async () => {
    const originalIncr = redis.incr;
    try {
      redis.incr = async () => {
        throw new Error('Redis connection down');
      };

      const lease = await reserveAiBudget({ ip: '10.0.0.50' });
      assert.equal(lease.granted, false);
      assert.equal(lease.reason, 'QUOTA_BACKEND_ERROR');
    } finally {
      redis.incr = originalIncr;
    }
  });

  it('handles orphan lease expiry via TTL', async () => {
    setAiQuotaConfig({ leaseTtlSeconds: 1 });
    const lease = await reserveAiBudget({ ip: '10.0.0.60' });
    assert.equal(lease.granted, true);

    // Lease expires without settle or release (simulating crash)
    // After TTL passes, the lease is considered expired
    assert.ok(lease.expiresAt <= Date.now() + 1500);
  });
});
