import { VIETNAM_LOCATIONS, type Province, type District, type Ward } from '@shared/constants/vietnam-locations';
import { removeVietnameseTones } from '@shared/utils/product-variants';

export type LocationMatchLevel = 'NONE' | 'PROVINCE' | 'DISTRICT' | 'WARD';
export type GeocodingProvider = 'NOMINATIM' | 'BIGDATACLOUD' | 'IP';

export interface ReverseGeocodeResult {
  provinceId: string | null;
  provinceName: string | null;
  districtId: number | null;
  districtName: string | null;
  wardCode: string | null;
  wardName: string | null;
  specificAddress: string;
  fullDisplayName: string;
  matchLevel: LocationMatchLevel;
  isMatched: boolean;
  provider: GeocodingProvider | null;
  providerResponded: boolean;
}

interface RawLocation {
  provinceCandidates: string[];
  districtCandidates: string[];
  wardCandidates: string[];
  houseNumber: string;
  road: string;
  building: string;
  fullDisplayName: string;
  provider: Exclude<GeocodingProvider, 'IP'>;
}

function emptyResult(provider: GeocodingProvider | null = null): ReverseGeocodeResult {
  return {
    provinceId: null,
    provinceName: null,
    districtId: null,
    districtName: null,
    wardCode: null,
    wardName: null,
    specificAddress: '',
    fullDisplayName: '',
    matchLevel: 'NONE',
    isMatched: false,
    provider,
    providerResponded: false,
  };
}

/**
 * Chuẩn hóa tên đơn vị hành chính. Chỉ bỏ tiền tố ở đầu chuỗi để tránh
 * false-positive như "Hà Tĩnh" bị rút thành "Hà".
 */
function normalizeLocationName(name: string): string {
  if (!name) return '';
  return removeVietnameseTones(name)
    .toLowerCase()
    .replace(/^(thanh pho|tinh|thi xa|quan|huyen|phuong|xa|thi tran|tp|q|p)\b\.?\s*/, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function looselyMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

function uniqueNames(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim()))];
}

function findMatchingProvince(...rawNames: string[]): Province | null {
  const exactAliases: Record<string, string> = {
    hcm: 'hcm', hn: 'hn', dn: 'dn', ct: 'ct', hp: 'hp', bd: 'bd', dnai: 'dnai',
    vt: 'vt', kh: 'kh', ld: 'ld', qn: 'qn', bn: 'bn', na: 'na', th: 'th', tg: 'tg', kg: 'kg',
  };
  const longAliases: Record<string, string> = {
    hochiminh: 'hcm', saigon: 'hcm', hanoi: 'hn', danang: 'dn', cantho: 'ct',
    haiphong: 'hp', binhduong: 'bd', dongnai: 'dnai', vungtau: 'vt', baria: 'vt',
    khanhhoa: 'kh', nhatrang: 'kh', lamdong: 'ld', dalat: 'ld', hue: 'hue',
    thuathienhue: 'hue', quangninh: 'qn', halong: 'qn', bacninh: 'bn', nghean: 'na',
    thanhhoa: 'th', tiengiang: 'tg', mytho: 'tg', kiengiang: 'kg', phuquoc: 'kg', rachgia: 'kg',
  };

  for (const candidate of uniqueNames(rawNames)) {
    const normalized = normalizeLocationName(candidate);
    const aliasId = exactAliases[normalized]
      ?? Object.entries(longAliases).find(([name]) => normalized === name || normalized.includes(name))?.[1];
    if (aliasId) return VIETNAM_LOCATIONS.find((province) => province.id === aliasId) ?? null;

    const exact = VIETNAM_LOCATIONS.find((province) => normalizeLocationName(province.name) === normalized);
    if (exact) return exact;
  }

  for (const candidate of uniqueNames(rawNames)) {
    const normalized = normalizeLocationName(candidate);
    const matches = VIETNAM_LOCATIONS.filter((province) => looselyMatches(normalized, normalizeLocationName(province.name)));
    if (matches.length === 1) return matches[0];
  }

  return null;
}

function findUniqueMatch<T extends { name: string }>(items: T[], rawNames: string[]): T | null {
  for (const candidate of uniqueNames(rawNames)) {
    const normalized = normalizeLocationName(candidate);
    const exact = items.filter((item) => normalizeLocationName(item.name) === normalized);
    if (exact.length === 1) return exact[0];
  }

  for (const candidate of uniqueNames(rawNames)) {
    const normalized = normalizeLocationName(candidate);
    const loose = items.filter((item) => looselyMatches(normalized, normalizeLocationName(item.name)));
    if (loose.length === 1) return loose[0];
  }

  return null;
}

function findMatchingDistrict(province: Province, candidates: string[]): District | null {
  return findUniqueMatch(province.districts, candidates);
}

function findMatchingWard(district: District, candidates: string[]): Ward | null {
  return findUniqueMatch(district.wards, candidates);
}

function inferUniqueWardParent(province: Province, candidates: string[]): { district: District; ward: Ward } | null {
  const uniqueCandidates = uniqueNames(candidates);

  // Đếm trên toàn tỉnh thay vì lấy tối đa một kết quả mỗi huyện. Nếu cùng một tên
  // xuất hiện nhiều lần (kể cả trong cùng huyện), không được suy luận cha tự động.
  for (const candidate of uniqueCandidates) {
    const normalized = normalizeLocationName(candidate);
    const exactHits = province.districts.flatMap((district) =>
      district.wards
        .filter((ward) => normalizeLocationName(ward.name) === normalized)
        .map((ward) => ({ district, ward }))
    );
    if (exactHits.length === 1) return exactHits[0];
  }

  for (const candidate of uniqueCandidates) {
    const normalized = normalizeLocationName(candidate);
    const looseHits = province.districts.flatMap((district) =>
      district.wards
        .filter((ward) => looselyMatches(normalized, normalizeLocationName(ward.name)))
        .map((ward) => ({ district, ward }))
    );
    if (looseHits.length === 1) return looseHits[0];
  }

  return null;
}

function specificAddressFrom(raw: RawLocation): string {
  const street = [raw.houseNumber, raw.road].filter(Boolean).join(' ').trim();
  if (raw.building && street) return `${raw.building}, ${street}`;
  return raw.building || street;
}

function mapRawLocation(raw: RawLocation): ReverseGeocodeResult {
  const base = emptyResult(raw.provider);
  base.providerResponded = true;
  base.fullDisplayName = raw.fullDisplayName;
  base.specificAddress = specificAddressFrom(raw);

  const province = findMatchingProvince(...raw.provinceCandidates);
  if (!province) return base;

  base.provinceId = province.id;
  base.provinceName = province.name;
  base.matchLevel = 'PROVINCE';

  let district = findMatchingDistrict(province, raw.districtCandidates);
  let ward: Ward | null = null;

  if (!district) {
    const inferred = inferUniqueWardParent(province, [...raw.wardCandidates, ...raw.districtCandidates]);
    if (inferred) {
      district = inferred.district;
      ward = inferred.ward;
    }
  }

  if (!district) return base;

  base.districtId = district.id;
  base.districtName = district.name;
  base.matchLevel = 'DISTRICT';

  ward ??= findMatchingWard(district, raw.wardCandidates);
  if (!ward) return base;

  base.wardCode = ward.code;
  base.wardName = ward.name;
  base.matchLevel = 'WARD';
  base.isMatched = true;
  return base;
}

async function fetchNominatim(lat: number, lon: number): Promise<RawLocation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&accept-language=vi`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ShopQRPayment/1.0 (nhonhoa.developer@gmail.com)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = await response.json();
    const address = data.address ?? {};
    return {
      provinceCandidates: uniqueNames([address.province, address.city, address.state]),
      districtCandidates: uniqueNames([address.district, address.county, address.city_district]),
      wardCandidates: uniqueNames([address.ward, address.suburb, address.quarter, address.neighbourhood]),
      houseNumber: typeof address.house_number === 'string' ? address.house_number : '',
      road: typeof (address.road ?? address.street) === 'string' ? (address.road ?? address.street) : '',
      building: typeof (address.building ?? address.amenity) === 'string' ? (address.building ?? address.amenity) : '',
      fullDisplayName: typeof data.display_name === 'string' ? data.display_name : '',
      provider: 'NOMINATIM',
    };
  } catch (error) {
    console.warn('[GeocodingService] Nominatim unavailable:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBigDataCloud(lat: number, lon: number): Promise<RawLocation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    const administrative = Array.isArray(data.localityInfo?.administrative)
      ? data.localityInfo.administrative
          .filter((entry: { adminLevel?: number }) => entry.adminLevel === 6 || entry.adminLevel === 7 || entry.adminLevel === 8)
          .map((entry: { name?: unknown }) => entry.name)
      : [];

    return {
      provinceCandidates: uniqueNames([data.principalSubdivision, data.city]),
      districtCandidates: uniqueNames(administrative),
      wardCandidates: uniqueNames([data.locality, ...administrative]),
      houseNumber: '',
      road: '',
      building: '',
      fullDisplayName: uniqueNames([data.locality, data.city, data.principalSubdivision]).join(', '),
      provider: 'BIGDATACLOUD',
    };
  } catch (error) {
    console.warn('[GeocodingService] BigDataCloud unavailable:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function rankMatch(level: LocationMatchLevel): number {
  return { NONE: 0, PROVINCE: 1, DISTRICT: 2, WARD: 3 }[level];
}

/**
 * Reverse geocode tọa độ thành gợi ý địa chỉ và mã địa giới GHN.
 * Không bao giờ tự chọn tỉnh/quận/phường mặc định khi provider không khớp.
 */
export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const nominatimRaw = await fetchNominatim(lat, lon);
  const nominatim = nominatimRaw ? mapRawLocation(nominatimRaw) : emptyResult('NOMINATIM');
  if (nominatim.matchLevel === 'WARD') return nominatim;

  const bigDataCloudRaw = await fetchBigDataCloud(lat, lon);
  const bigDataCloud = bigDataCloudRaw ? mapRawLocation(bigDataCloudRaw) : emptyResult('BIGDATACLOUD');
  return rankMatch(bigDataCloud.matchLevel) > rankMatch(nominatim.matchLevel) ? bigDataCloud : nominatim;
}

function isPrivateOrLocalIp(ip?: string): boolean {
  if (!ip) return true;
  const normalized = ip.replace(/^::ffff:/, '');
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') return true;
  if (normalized.startsWith('10.') || normalized.startsWith('192.168.')) return true;
  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  return Boolean(match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31);
}

/**
 * IP chỉ được dùng để gợi ý tỉnh/thành. Không suy diễn quận, phường hoặc địa chỉ đường.
 */
export async function resolveLocationByIp(clientIp?: string): Promise<ReverseGeocodeResult | null> {
  const queryUrl = isPrivateOrLocalIp(clientIp)
    ? 'http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,lat,lon'
    : `http://ip-api.com/json/${encodeURIComponent(clientIp!)}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(queryUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'success' || data.countryCode !== 'VN') return null;

    const province = findMatchingProvince(data.regionName ?? '', data.city ?? '', data.region ?? '');
    if (!province) return null;

    return {
      ...emptyResult('IP'),
      provinceId: province.id,
      provinceName: province.name,
      fullDisplayName: province.name,
      matchLevel: 'PROVINCE',
      providerResponded: true,
    };
  } catch (error) {
    console.warn('[GeocodingService] IP geolocation unavailable:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
