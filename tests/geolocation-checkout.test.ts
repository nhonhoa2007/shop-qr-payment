import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reverseGeocodeCoordinates, resolveLocationByIp } from '@server/modules/shipping/geocoding.service';
import { classifyLocationAccuracy, isBetterLocationSample } from '@client/lib/geolocation';

describe('Geolocation reverse geocoding', () => {
  it('maps Ho Chi Minh coordinates through the full GHN hierarchy', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        address: {
          house_number: '1', road: 'Công xã Paris', suburb: 'Phường Bến Nghé',
          city_district: 'Quận 1', city: 'Thành phố Hồ Chí Minh', state: 'Thành phố Hồ Chí Minh',
        },
        display_name: '1, Công xã Paris, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
      }),
    }) as Response;

    try {
      const result = await reverseGeocodeCoordinates(10.779785, 106.699018);
      assert.equal(result.matchLevel, 'WARD');
      assert.equal(result.isMatched, true);
      assert.equal(result.provinceId, 'hcm');
      assert.equal(result.districtId, 1442);
      assert.equal(result.wardCode, '20101');
      assert.match(result.specificAddress, /Công xã Paris/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('maps Hanoi coordinates accurately', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        address: {
          house_number: '123', road: 'Đường Xuân Thủy', suburb: 'Phường Dịch Vọng Hậu',
          district: 'Quận Cầu Giấy', city: 'Hà Nội', state: 'Hà Nội',
        },
        display_name: '123, Đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội, Việt Nam',
      }),
    }) as Response;

    try {
      const result = await reverseGeocodeCoordinates(21.0366, 105.7825);
      assert.equal(result.matchLevel, 'WARD');
      assert.equal(result.provinceId, 'hn');
      assert.equal(result.districtId, 1485);
      assert.equal(result.wardCode, '1A0602');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not invent a default ward when provider ward is unknown', async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({
            address: { city: 'Thành phố Hồ Chí Minh', city_district: 'Quận 1', ward: 'Phường không tồn tại' },
            display_name: 'Phường không tồn tại, Quận 1, Thành phố Hồ Chí Minh',
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    };

    try {
      const result = await reverseGeocodeCoordinates(10.77, 106.70);
      assert.equal(result.matchLevel, 'DISTRICT');
      assert.equal(result.isMatched, false);
      assert.equal(result.districtId, 1442);
      assert.equal(result.wardCode, null);
      assert.equal(result.specificAddress, '');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not infer a district when the same ward name exists more than once in a province', async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({
            address: { state: 'Hòa Bình', ward: 'Xã Thanh Sơn' },
            display_name: 'Xã Thanh Sơn, Hòa Bình, Việt Nam',
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    };

    try {
      const result = await reverseGeocodeCoordinates(20.8, 105.3);
      assert.equal(result.matchLevel, 'PROVINCE');
      assert.equal(result.isMatched, false);
      assert.equal(result.districtId, null);
      assert.equal(result.wardCode, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('tries BigDataCloud when Nominatim returns an unmappable administrative result', async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({ address: { state: 'Unknown province' }, display_name: 'Unknown' }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          city: 'Hồ Chí Minh', principalSubdivision: 'Thành phố Hồ Chí Minh', locality: 'Phường Bến Nghé',
          localityInfo: { administrative: [{ adminLevel: 6, name: 'Quận 1' }] },
        }),
      } as Response;
    };

    try {
      const result = await reverseGeocodeCoordinates(10.77, 106.70);
      assert.equal(calls, 2);
      assert.equal(result.provider, 'BIGDATACLOUD');
      assert.equal(result.matchLevel, 'WARD');
      assert.equal(result.wardCode, '20101');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns empty unmatched data when all providers fail', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Network error'); };

    try {
      const result = await reverseGeocodeCoordinates(0, 0);
      assert.equal(result.matchLevel, 'NONE');
      assert.equal(result.providerResponded, false);
      assert.equal(result.isMatched, false);
      assert.equal(result.provinceId, null);
      assert.equal(result.districtId, null);
      assert.equal(result.wardCode, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('IP lookup only suggests province and never invents district or ward', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'success', countryCode: 'VN', region: 'SG', regionName: 'Ho Chi Minh', city: 'Ho Chi Minh City',
        lat: 10.7769, lon: 106.7009,
      }),
    }) as Response;

    try {
      const result = await resolveLocationByIp('113.161.72.10');
      assert.ok(result);
      assert.equal(result.matchLevel, 'PROVINCE');
      assert.equal(result.isMatched, false);
      assert.equal(result.provinceId, 'hcm');
      assert.equal(result.districtId, null);
      assert.equal(result.wardCode, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Client location sample policy', () => {
  it('classifies accuracy into precise, approximate and unreliable', () => {
    assert.equal(classifyLocationAccuracy(200), 'PRECISE');
    assert.equal(classifyLocationAccuracy(500), 'APPROXIMATE');
    assert.equal(classifyLocationAccuracy(1001), 'UNRELIABLE');
  });

  it('keeps a more accurate sample instead of blindly taking the latest one', () => {
    const current = { latitude: 10, longitude: 106, accuracy: 100, timestamp: 1000 };
    const worse = { latitude: 10.1, longitude: 106.1, accuracy: 800, timestamp: 2000 };
    const better = { latitude: 10.01, longitude: 106.01, accuracy: 50, timestamp: 3000 };
    assert.equal(isBetterLocationSample(worse, current), false);
    assert.equal(isBetterLocationSample(better, current), true);
  });
});
