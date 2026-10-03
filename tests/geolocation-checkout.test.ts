import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reverseGeocodeCoordinates, resolveLocationByIp } from '../src/server/modules/shipping/geocoding.service.ts';

describe('Geolocation & Fast Address Reverse Geocoding', () => {
  it('should map Ho Chi Minh coordinates accurately to province and district', async () => {
    // Tọa độ tượng trưng Nhà thờ Đức Bà, Quận 1, TP.HCM
    const lat = 10.779785;
    const lon = 106.699018;

    // Giả lập fetch response trả về cấu trúc của OpenStreetMap
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          address: {
            house_number: '1',
            road: 'Công xã Paris',
            suburb: 'Phường Bến Nghé',
            city_district: 'Quận 1',
            city: 'Thành phố Hồ Chí Minh',
            state: 'Thành phố Hồ Chí Minh',
            country: 'Việt Nam',
          },
          display_name: '1, Công xã Paris, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, 71006, Việt Nam',
        }),
      } as unknown as Response;
    };

    try {
      const result = await reverseGeocodeCoordinates(lat, lon);
      assert.equal(result.isMatched, true);
      assert.equal(result.provinceId, 'hcm');
      assert.equal(result.districtId, 1442); // Quận 1
      assert.equal(result.wardCode, '20101'); // Phường Bến Nghé
      assert.match(result.specificAddress, /Công xã Paris/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should map Hanoi coordinates accurately to province and district', async () => {
    // Tọa độ Cầu Giấy, Hà Nội
    const lat = 21.0366;
    const lon = 105.7825;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          address: {
            house_number: '123',
            road: 'Đường Xuân Thủy',
            suburb: 'Phường Dịch Vọng Hậu',
            district: 'Quận Cầu Giấy',
            city: 'Hà Nội',
            state: 'Hà Nội',
            country: 'Việt Nam',
          },
          display_name: '123, Đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội, Việt Nam',
        }),
      } as unknown as Response;
    };

    try {
      const result = await reverseGeocodeCoordinates(lat, lon);
      assert.equal(result.isMatched, true);
      assert.equal(result.provinceId, 'hn');
      assert.equal(result.districtId, 1485); // Quận Cầu Giấy (ID theo GHN Master-Data thật)
      assert.equal(result.wardCode, '1A0602'); // Phường Dịch Vọng Hậu
      assert.match(result.specificAddress, /Xuân Thủy/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should resolve location by IP fallback when coordinates are missing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('ip-api.com')) {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            country: 'Vietnam',
            regionName: 'Ho Chi Minh',
            city: 'Ho Chi Minh City',
            lat: 10.7769,
            lon: 106.7009,
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          address: {
            city: 'Thành phố Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường Bến Nghé',
          },
          display_name: 'Quận 1, Thành phố Hồ Chí Minh, Việt Nam',
        }),
      } as unknown as Response;
    };

    try {
      const result = await resolveLocationByIp('113.161.72.10');
      assert.ok(result);
      assert.equal(result.isMatched, true);
      assert.equal(result.provinceId, 'hcm');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return safe fallback when geocoding service encounters network error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Network error or timeout');
    };

    try {
      const result = await reverseGeocodeCoordinates(0, 0);
      assert.equal(result.isMatched, false);
      assert.equal(result.provinceId, 'hcm'); // Fallback an toàn
      assert.ok(result.districtId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
