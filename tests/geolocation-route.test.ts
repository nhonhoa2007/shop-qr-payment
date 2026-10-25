import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '@/app/api/shipping/geocode/reverse/route';
import { redis } from '@server/infrastructure/redis';

function request(body: unknown): Request {
  return new Request('http://localhost/api/shipping/geocode/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': '203.0.113.42' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/shipping/geocode/reverse', () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it('rejects missing coordinates instead of silently falling back to IP', async () => {
    const response = await POST(request({}));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Tọa độ/);
  });

  it('rejects coordinates outside valid ranges', async () => {
    const response = await POST(request({ latitude: 91, longitude: 181 }));
    assert.equal(response.status, 400);
  });

  it('rejects string coordinate coercion', async () => {
    const response = await POST(request({ latitude: '10.77', longitude: '106.70' }));
    assert.equal(response.status, 400);
  });

  it('requires an explicit boolean for IP estimation', async () => {
    const response = await POST(request({ useIp: 'true' }));
    assert.equal(response.status, 400);
  });

  it('does not allow mixed device and IP methods', async () => {
    const response = await POST(request({ useIp: true, latitude: 10.77, longitude: 106.70 }));
    assert.equal(response.status, 400);
  });

  it('does not cache a transient provider failure', async () => {
    const originalFetch = globalThis.fetch;
    let providerCalls = 0;
    globalThis.fetch = async () => {
      providerCalls += 1;
      throw new Error('provider unavailable');
    };

    try {
      const first = await POST(request({ latitude: 10.1234567, longitude: 106.7654321, accuracy: 50 }));
      const second = await POST(request({ latitude: 10.1234567, longitude: 106.7654321, accuracy: 50 }));
      assert.equal(first.status, 503);
      assert.equal(second.status, 503);
      assert.equal(providerCalls, 4);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not share a house-level cache result across nearby coordinates', async () => {
    const originalFetch = globalThis.fetch;
    let providerCalls = 0;
    globalThis.fetch = async () => {
      providerCalls += 1;
      return {
        ok: true,
        json: async () => ({
          address: {
            house_number: String(providerCalls), road: 'Công xã Paris', suburb: 'Phường Bến Nghé',
            city_district: 'Quận 1', city: 'Thành phố Hồ Chí Minh', state: 'Thành phố Hồ Chí Minh',
          },
          display_name: `${providerCalls}, Công xã Paris, Quận 1, Thành phố Hồ Chí Minh`,
        }),
      } as Response;
    };

    try {
      const first = await POST(request({ latitude: 10.7797851, longitude: 106.6990181, accuracy: 20 }));
      const second = await POST(request({ latitude: 10.7797861, longitude: 106.6990191, accuracy: 20 }));
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(providerCalls, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
