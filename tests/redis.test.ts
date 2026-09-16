import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  RedisClient,
  buildProductCacheKey,
  getCachedProductList,
  setCachedProductList,
  invalidateProductCache,
  redis,
} from '../src/lib/redis.ts';

describe('Distributed Redis Client - In-memory and Operations', () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it('should set and get values correctly', async () => {
    const client = new RedisClient();
    await client.set('test:key1', { name: 'Áo thun', price: 150000 });

    const retrieved = await client.get<{ name: string; price: number }>('test:key1');
    assert.deepEqual(retrieved, { name: 'Áo thun', price: 150000 });
  });

  it('should return null for non-existent key', async () => {
    const client = new RedisClient();
    const res = await client.get('test:missing');
    assert.equal(res, null);
  });

  it('should delete keys successfully', async () => {
    const client = new RedisClient();
    await client.set('test:k1', 'val1');
    await client.set('test:k2', 'val2');

    const deleted = await client.del('test:k1', 'test:k2');
    assert.equal(deleted, 2);

    assert.equal(await client.get('test:k1'), null);
    assert.equal(await client.get('test:k2'), null);
  });

  it('should delete keys matching wildcard pattern', async () => {
    const client = new RedisClient();
    await client.set('cache:products:ao:none', [{ id: 1 }]);
    await client.set('cache:products:quan:none', [{ id: 2 }]);
    await client.set('cache:users:u1', { name: 'Nam' });

    const deleted = await client.delPattern('cache:products:*');
    assert.equal(deleted, 2);

    assert.equal(await client.get('cache:products:ao:none'), null);
    assert.equal(await client.get('cache:products:quan:none'), null);
    assert.notEqual(await client.get('cache:users:u1'), null);
  });

  it('should respect TTL expiration', async () => {
    const client = new RedisClient();
    // Set với TTL 1 giây
    await client.set('test:expiring', 'hello', { ex: 1 });
    assert.equal(await client.get('test:expiring'), 'hello');

    // Giả lập vượt mốc thời gian bằng cách can thiệp TTL nhỏ hơn 0 hoặc chờ
    await client.set('test:expired_now', 'bye', { ex: -1 });
    assert.equal(await client.get('test:expired_now'), null);
  });
});

describe('Product Catalogue Query Caching Helpers', () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it('should format cache keys deterministically', () => {
    assert.equal(buildProductCacheKey(), 'cache:products:all:none');
    assert.equal(buildProductCacheKey('Thời trang', 'Áo'), 'cache:products:Thời trang:áo');
    assert.equal(buildProductCacheKey(null, '  Sneaker  '), 'cache:products:all:sneaker');
  });

  it('should cache and retrieve product list properly', async () => {
    const key = buildProductCacheKey('Tech', null);
    const mockList = [{ id: 'p1', name: 'Smartwatch', price: 900000 }];

    await setCachedProductList(key, mockList, 60);

    const cached = await getCachedProductList<typeof mockList>(key);
    assert.deepEqual(cached, mockList);
  });

  it('should invalidate all product catalogue caches', async () => {
    const key1 = buildProductCacheKey('Thời trang', null);
    const key2 = buildProductCacheKey('Công nghệ', 'chuột');

    await setCachedProductList(key1, [{ id: '1' }]);
    await setCachedProductList(key2, [{ id: '2' }]);

    const count = await invalidateProductCache();
    assert.equal(count, 2);

    assert.equal(await getCachedProductList(key1), null);
    assert.equal(await getCachedProductList(key2), null);
  });
});
