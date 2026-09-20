/**
 * Distributed Cache & Redis Client
 * Native HTTP REST-based client compatible with Upstash Redis and Serverless/Edge runtimes.
 * Includes zero-config in-memory fallback for local development and offline testing.
 */


export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
export const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

interface InMemoryEntry {
  value: unknown;
  expiresAt: number | null;
}

// In-memory fallback store for offline tests and development without Upstash credentials
const inMemoryCache = new Map<string, InMemoryEntry>();

export class RedisClient {
  private url: string;
  private token: string;

  constructor(url = UPSTASH_REDIS_REST_URL, token = UPSTASH_REDIS_REST_TOKEN) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  public isRemoteConfigured(): boolean {
    return Boolean(this.url && this.token);
  }

  /**
   * Execute raw Upstash REST Command
   */
  private async executeCommand<T>(command: (string | number)[]): Promise<T | null> {
    if (!this.isRemoteConfigured()) {
      return null;
    }

    try {
      const res = await fetch(`${this.url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!res.ok) {
        console.warn(`[Redis REST] Request failed with status ${res.status}`);
        return null;
      }

      const json = await res.json();
      return (json.result as T) ?? null;
    } catch (err) {
      console.warn('[Redis REST] Connection error, falling back to local store:', err);
      return null;
    }
  }

  /**
   * GET key
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isRemoteConfigured()) {
      const remoteRes = await this.executeCommand<string | T>(['GET', key]);
      if (remoteRes !== null && remoteRes !== undefined) {
        if (typeof remoteRes === 'string') {
          try {
            return JSON.parse(remoteRes) as T;
          } catch {
            return remoteRes as unknown as T;
          }
        }
        return remoteRes as T;
      }
      return null;
    }

    // In-memory fallback
    const entry = inMemoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * SET key value [EX seconds]
   */
  async set(key: string, value: unknown, options?: { ex?: number }): Promise<boolean> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (this.isRemoteConfigured()) {
      const cmd: (string | number)[] = ['SET', key, serialized];
      if (options?.ex && options.ex > 0) {
        cmd.push('EX', options.ex);
      }
      const res = await this.executeCommand<string>(cmd);
      return res === 'OK';
    }

    // In-memory fallback
    const expiresAt =
      options?.ex !== undefined ? Date.now() + options.ex * 1000 : null;
    inMemoryCache.set(key, { value, expiresAt });
    return true;
  }

  /**
   * DEL key ...
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    if (this.isRemoteConfigured()) {
      const res = await this.executeCommand<number>(['DEL', ...keys]);
      return Number(res || 0);
    }

    // In-memory fallback
    let deletedCount = 0;
    for (const key of keys) {
      if (inMemoryCache.delete(key)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Wildcard deletion (chỉ định tiền tố e.g. "cache:products:*")
   */
  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

    if (this.isRemoteConfigured()) {
      const keys = await this.executeCommand<string[]>(['KEYS', pattern]);
      if (Array.isArray(keys) && keys.length > 0) {
        return await this.del(...keys);
      }
      return 0;
    }

    let deletedCount = 0;
    for (const key of inMemoryCache.keys()) {
      if (regex.test(key)) {
        inMemoryCache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Flush all keys (chủ yếu phục vụ unit test)
   */
  async flushall(): Promise<boolean> {
    inMemoryCache.clear();
    if (this.isRemoteConfigured()) {
      const res = await this.executeCommand<string>(['FLUSHALL']);
      return res === 'OK';
    }
    return true;
  }
}

export const redis = new RedisClient();

// ============================================
// PRODUCT QUERY CACHING HELPERS
// ============================================

export const PRODUCT_CACHE_PREFIX = 'cache:products:';
export const PRODUCT_CACHE_TTL_SECONDS = 60; // 60s TTL

export function buildProductCacheKey(category?: string | null, search?: string | null): string {
  const cat = category?.trim() || 'all';
  const q = search?.trim().toLowerCase() || 'none';
  return `${PRODUCT_CACHE_PREFIX}${cat}:${q}`;
}

export async function getCachedProductList<T>(cacheKey: string): Promise<T | null> {
  return await redis.get<T>(cacheKey);
}

export async function setCachedProductList(
  cacheKey: string,
  data: unknown,
  ttlSeconds = PRODUCT_CACHE_TTL_SECONDS
): Promise<void> {
  await redis.set(cacheKey, data, { ex: ttlSeconds });
}

export async function invalidateProductCache(): Promise<number> {
  return await redis.delPattern(`${PRODUCT_CACHE_PREFIX}*`);
}
