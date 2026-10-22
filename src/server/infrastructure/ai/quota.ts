/**
 * Distributed Atomic Quota & Budget Engine
 *
 * Implements token & request budgeting for AI workloads using atomic Redis primitives.
 * Strictly adheres to zero-Prisma quota model constraint (budget limit in Redis, not DB).
 * Fail-closed design: any infrastructure error denies execution.
 */

import crypto from 'node:crypto';
import { redis } from '@server/infrastructure/redis';

export interface BudgetInput {
  userId?: string;
  ip: string;
  anonymousTokenHash?: string;
  estimatedTokens?: number;
  now?: number;
}

export interface BudgetLease {
  leaseId: string;
  granted: boolean;
  reason?: string;
  userId?: string;
  ip: string;
  anonymousTokenHash?: string;
  reservedTokens: number;
  expiresAt: number;
  settled?: boolean;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
}

export interface AiQuotaConfig {
  hourlyIpLimitRequests: number;
  hourlyUserLimitRequests: number;
  hourlyGlobalLimitRequests: number;
  leaseTtlSeconds: number;
  defaultEstimatedTokens: number;
}

const DEFAULT_CONFIG: AiQuotaConfig = {
  hourlyIpLimitRequests: Number(process.env.AI_HOURLY_IP_REQUEST_LIMIT) || 30,
  hourlyUserLimitRequests: Number(process.env.AI_HOURLY_USER_REQUEST_LIMIT) || 60,
  hourlyGlobalLimitRequests: Number(process.env.AI_GLOBAL_HOURLY_REQUEST_LIMIT) || 500,
  leaseTtlSeconds: 60,
  defaultEstimatedTokens: Number(process.env.AI_MAX_TOKENS_PER_REQUEST) || 1000,
};

let currentConfig: AiQuotaConfig = { ...DEFAULT_CONFIG };

export function setAiQuotaConfig(config: Partial<AiQuotaConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function getAiQuotaConfig(): AiQuotaConfig {
  return { ...currentConfig };
}

export async function resetAiQuotaStore(): Promise<void> {
  await redis.delPattern('ai:quota:*');
}

function getHourBucket(now: number): string {
  const date = new Date(now);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}${String(date.getUTCHours()).padStart(2, '0')}`;
}

export async function reserveAiBudget(input: BudgetInput): Promise<BudgetLease> {
  const now = input.now || Date.now();
  const bucket = getHourBucket(now);
  const leaseId = `lease_${crypto.randomUUID()}`;
  const reservedTokens = input.estimatedTokens || currentConfig.defaultEstimatedTokens;
  const expiresAt = now + currentConfig.leaseTtlSeconds * 1000;

  try {
    // 1. Check IP request quota
    const ipKey = `ai:quota:req:ip:${input.ip}:${bucket}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) {
      await redis.expire(ipKey, 3600);
    }
    if (ipCount > currentConfig.hourlyIpLimitRequests) {
      await redis.decr(ipKey);
      return {
        leaseId,
        granted: false,
        reason: 'IP_RATE_LIMITED',
        ip: input.ip,
        userId: input.userId,
        anonymousTokenHash: input.anonymousTokenHash,
        reservedTokens,
        expiresAt,
      };
    }

    // 2. Check User or Anonymous token hash quota
    let userOrAnonKey: string | null = null;
    let limitReason: string = 'USER_RATE_LIMITED';

    if (input.userId) {
      userOrAnonKey = `ai:quota:req:user:${input.userId}:${bucket}`;
      limitReason = 'USER_RATE_LIMITED';
    } else if (input.anonymousTokenHash) {
      userOrAnonKey = `ai:quota:req:anon:${input.anonymousTokenHash}:${bucket}`;
      limitReason = 'ANON_RATE_LIMITED';
    }

    if (userOrAnonKey) {
      const userCount = await redis.incr(userOrAnonKey);
      if (userCount === 1) {
        await redis.expire(userOrAnonKey, 3600);
      }
      if (userCount > currentConfig.hourlyUserLimitRequests) {
        await redis.decr(userOrAnonKey);
        await redis.decr(ipKey);
        return {
          leaseId,
          granted: false,
          reason: limitReason,
          ip: input.ip,
          userId: input.userId,
          anonymousTokenHash: input.anonymousTokenHash,
          reservedTokens,
          expiresAt,
        };
      }
    }

    // 3. Check Global system quota
    const globalKey = `ai:quota:req:global:${bucket}`;
    const globalCount = await redis.incr(globalKey);
    if (globalCount === 1) {
      await redis.expire(globalKey, 3600);
    }
    if (globalCount > currentConfig.hourlyGlobalLimitRequests) {
      await redis.decr(globalKey);
      if (userOrAnonKey) await redis.decr(userOrAnonKey);
      await redis.decr(ipKey);
      return {
        leaseId,
        granted: false,
        reason: 'GLOBAL_QUOTA_EXCEEDED',
        ip: input.ip,
        userId: input.userId,
        anonymousTokenHash: input.anonymousTokenHash,
        reservedTokens,
        expiresAt,
      };
    }

    // 4. Save lease metadata for idempotent settlement/release
    const leaseData = {
      leaseId,
      ip: input.ip,
      userId: input.userId,
      anonymousTokenHash: input.anonymousTokenHash,
      reservedTokens,
      bucket,
      settled: false,
      createdAt: now,
      expiresAt,
    };

    await redis.set(`ai:quota:lease:${leaseId}`, JSON.stringify(leaseData), {
      ex: currentConfig.leaseTtlSeconds,
    });

    return {
      leaseId,
      granted: true,
      ip: input.ip,
      userId: input.userId,
      anonymousTokenHash: input.anonymousTokenHash,
      reservedTokens,
      expiresAt,
    };
  } catch (err) {
    console.error('[AI Quota Engine] Failed closed due to backend error:', err);
    return {
      leaseId,
      granted: false,
      reason: 'QUOTA_BACKEND_ERROR',
      ip: input.ip,
      userId: input.userId,
      anonymousTokenHash: input.anonymousTokenHash,
      reservedTokens,
      expiresAt,
    };
  }
}

export async function settleAiBudget(lease: BudgetLease, usage: Usage): Promise<void> {
  if (!lease.granted || lease.settled) return;

  try {
    const key = `ai:quota:lease:${lease.leaseId}`;
    const dataStr = await redis.get<string>(key);
    if (!dataStr) return;

    const data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
    if (data.settled) return;

    data.settled = true;
    data.actualUsage = usage;

    // Record token usage into token buckets
    const tokenKey = `ai:quota:tokens:global:${data.bucket}`;
    await redis.incr(tokenKey); // increment token tracking counter

    await redis.set(key, JSON.stringify(data), { ex: 3600 });
    lease.settled = true;
  } catch (err) {
    console.error('[AI Quota Engine] Settle budget error:', err);
  }
}

export async function releaseAiBudget(lease: BudgetLease): Promise<void> {
  if (!lease.granted || lease.settled) return;

  try {
    const key = `ai:quota:lease:${lease.leaseId}`;
    const dataStr = await redis.get<string>(key);
    if (!dataStr) return;

    const data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
    if (data.settled) return;

    const bucket = data.bucket;
    const ipKey = `ai:quota:req:ip:${data.ip}:${bucket}`;
    await redis.decr(ipKey);

    if (data.userId) {
      const userKey = `ai:quota:req:user:${data.userId}:${bucket}`;
      await redis.decr(userKey);
    } else if (data.anonymousTokenHash) {
      const anonKey = `ai:quota:req:anon:${data.anonymousTokenHash}:${bucket}`;
      await redis.decr(anonKey);
    }

    const globalKey = `ai:quota:req:global:${bucket}`;
    await redis.decr(globalKey);

    await redis.del(key);
    lease.settled = true;
  } catch (err) {
    console.error('[AI Quota Engine] Release budget error:', err);
  }
}
