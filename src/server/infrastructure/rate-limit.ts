/**
 * Rate Limiting Utility
 * Provides distributed sliding window rate limiter backed by Redis (Upstash)
 * with transparent in-memory fallback for local development and unit tests.
 */

import { redis } from './redis.ts';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Synchronous in-memory rate limiting check (backward compatible with all existing modules)
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

/**
 * Distributed Sliding Window Rate Limiter
 * Tương thích Serverless Next.js, lưu trữ phiên gọi qua Redis HTTP
 */
export async function checkDistributedRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number; resetAt: number; source: 'REDIS' | 'IN_MEMORY' }> {
  const now = Date.now();
  const redisKey = `ratelimit:${key}`;

  if (redis.isRemoteConfigured()) {
    try {
      const record = await redis.get<RateLimitRecord>(redisKey);
      if (!record || now > record.resetAt) {
        const resetAt = now + windowMs;
        const ttlSeconds = Math.ceil(windowMs / 1000);
        await redis.set(redisKey, { count: 1, resetAt }, { ex: ttlSeconds });
        return { allowed: true, remaining: limit - 1, resetAt, source: 'REDIS' };
      }

      if (record.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: record.resetAt, source: 'REDIS' };
      }

      const updatedCount = record.count + 1;
      const ttlRemaining = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      await redis.set(
        redisKey,
        { count: updatedCount, resetAt: record.resetAt },
        { ex: ttlRemaining }
      );

      return {
        allowed: true,
        remaining: limit - updatedCount,
        resetAt: record.resetAt,
        source: 'REDIS',
      };
    } catch (err) {
      console.warn('[Distributed RateLimit] Redis error, fallback to in-memory:', err);
    }
  }

  const syncResult = checkRateLimit(key, limit, windowMs);
  return { ...syncResult, source: 'IN_MEMORY' };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
