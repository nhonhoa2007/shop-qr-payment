import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/shipping/geocode/reverse/route.ts';

test('GPS lookup failure never substitutes an unrelated IP location', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('ip-api.com')) {
      return { ok: true, json: async () => ({ status: 'success', lat: 10.779785, lon: 106.699018 }) } as Response;
    }
    if (url.includes('lat=10.779785')) {
      return {
        ok: true,
        json: async () => ({ address: { city: 'Thành phố Hồ Chí Minh', city_district: 'Quận 1', ward: 'Phường Bến Nghé' } }),
      } as Response;
    }
    throw new Error('GPS map provider unavailable');
  };

  try {
    const response = await POST(new Request('http://localhost/api/shipping/geocode/reverse', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '113.161.72.10' },
      body: JSON.stringify({ latitude: 21.0366, longitude: 105.7825 }),
    }));
    const result = await response.json();
    assert.equal(result.method, 'GPS');
    assert.equal(result.data.matchLevel, 'NONE');
    assert.equal(result.data.provinceId, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
