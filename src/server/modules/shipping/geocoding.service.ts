import { VIETNAM_LOCATIONS, type Province, type District, type Ward } from '../../../shared/constants/vietnam-locations.ts';
import { removeVietnameseTones } from '../../../shared/utils/product-variants.ts';

export interface ReverseGeocodeResult {
  provinceId: string;
  provinceName: string;
  districtId: number;
  districtName: string;
  wardCode: string;
  wardName: string;
  specificAddress: string;
  fullDisplayName: string;
  isMatched: boolean;
}

/**
 * Chuẩn hóa tên đơn vị hành chính để so khớp (bỏ dấu, chuyển chữ thường, loại bỏ tiền tố hành chính)
 *
 * Lưu ý: chỉ strip tiền tố ở ĐẦU chuỗi ("Tỉnh Hà Tĩnh" → "hatinh") — nếu strip mọi
 * từ "tinh/quan/xa" thì "Hà Tĩnh" còn "ha" và false-positive với mọi tên chứa "ha".
 */
function normalizeLocationName(name: string): string {
  if (!name) return '';
  return removeVietnameseTones(name)
    .toLowerCase()
    .replace(/^(thanh pho|tinh|thi xa|quan|huyen|phuong|xa|thi tran|tp|q|p)\b\.?\s*/, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * So khớp gần đúng an toàn: contains chỉ khi cả hai phía đủ dài (≥4 ký tự),
 * tránh false positive của tên rút gọn (vd. 'ha' ⊂ 'nguhanhson').
 */
function looselyMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Tìm kiếm Tỉnh/Thành phố khớp nhất từ danh sách cấu hình
 */
function findMatchingProvince(rawProvince: string, rawCity: string, rawState: string): Province | null {
  const candidates = [rawProvince, rawCity, rawState].filter(Boolean);

  for (const cand of candidates) {
    const norm = normalizeLocationName(cand);

    // Xử lý các tỉnh thành trọng điểm
    if (norm.includes('hochiminh') || norm.includes('saigon') || norm === 'hcm') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'hcm') || null;
    }
    if (norm.includes('hanoi') || norm === 'hn') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'hn') || null;
    }
    if (norm.includes('danang') || norm === 'dn') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'dn') || null;
    }
    if (norm.includes('cantho') || norm === 'ct') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'ct') || null;
    }
    if (norm.includes('haiphong') || norm === 'hp') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'hp') || null;
    }
    if (norm.includes('binhduong') || norm === 'bd') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'bd') || null;
    }
    if (norm.includes('dongnai') || norm === 'dnai') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'dnai') || null;
    }
    if (norm.includes('vungtau') || norm.includes('baria') || norm === 'vt') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'vt') || null;
    }
    if (norm.includes('khanhhoa') || norm.includes('nhatrang') || norm === 'kh') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'kh') || null;
    }
    if (norm.includes('lamdong') || norm.includes('dalat') || norm === 'ld') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'ld') || null;
    }
    if (norm.includes('hue') || norm.includes('thuathienhue')) {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'hue') || null;
    }
    if (norm.includes('quangninh') || norm.includes('halong') || norm === 'qn') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'qn') || null;
    }
    if (norm.includes('bacninh') || norm === 'bn') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'bn') || null;
    }
    if (norm.includes('nghean') || norm.includes('vinh') || norm === 'na') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'na') || null;
    }
    if (norm.includes('thanhhoa') || norm === 'th') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'th') || null;
    }
    if (norm.includes('tiengiang') || norm.includes('mytho') || norm === 'tg') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'tg') || null;
    }
    if (norm.includes('kiengiang') || norm.includes('phuquoc') || norm.includes('rachgia') || norm === 'kg') {
      return VIETNAM_LOCATIONS.find((p) => p.id === 'kg') || null;
    }

    for (const prov of VIETNAM_LOCATIONS) {
      const provNorm = normalizeLocationName(prov.name);
      if (looselyMatches(norm, provNorm)) {
        return prov;
      }
    }
  }

  return null;
}

/**
 * Tìm kiếm Quận/Huyện khớp trong Tỉnh/Thành phố
 */
function findMatchingDistrict(
  province: Province,
  rawDistrict: string,
  rawCounty: string,
  rawCityDistrict: string
): District | null {
  const candidates = [rawDistrict, rawCounty, rawCityDistrict].filter(Boolean);

  // Bước 1: Ưu tiên so khớp chính xác 100%
  for (const cand of candidates) {
    const norm = normalizeLocationName(cand);
    if (!norm) continue;

    for (const dist of province.districts) {
      const distNorm = normalizeLocationName(dist.name);
      if (norm === distNorm) {
        return dist;
      }
    }
  }

  // Bước 2: So khớp gần đúng (looselyMatches — contains với ngưỡng độ dài an toàn)
  for (const cand of candidates) {
    const norm = normalizeLocationName(cand);
    if (!norm) continue;

    for (const dist of province.districts) {
      const distNorm = normalizeLocationName(dist.name);
      if (looselyMatches(norm, distNorm)) {
        return dist;
      }
    }
  }

  return null;
}

/**
 * Tìm kiếm Phường/Xã khớp trong Quận/Huyện
 */
function findMatchingWard(
  district: District,
  rawWard: string,
  rawSuburb: string,
  rawQuarter: string
): Ward | null {
  const candidates = [rawWard, rawSuburb, rawQuarter].filter(Boolean);

  // Bước 1: Ưu tiên so khớp chính xác 100%
  for (const cand of candidates) {
    const norm = normalizeLocationName(cand);
    if (!norm) continue;

    for (const ward of district.wards) {
      const wardNorm = normalizeLocationName(ward.name);
      if (norm === wardNorm) {
        return ward;
      }
    }
  }

  // Bước 2: So khớp gần đúng (looselyMatches — contains với ngưỡng độ dài an toàn)
  for (const cand of candidates) {
    const norm = normalizeLocationName(cand);
    if (!norm) continue;

    for (const ward of district.wards) {
      const wardNorm = normalizeLocationName(ward.name);
      if (looselyMatches(norm, wardNorm)) {
        return ward;
      }
    }
  }

  return null;
}

/**
 * Giải mã tọa độ GPS (Latitude, Longitude) thành địa chỉ hành chính Việt Nam & mapping với GHN
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  const defaultFallback: ReverseGeocodeResult = {
    provinceId: 'hcm',
    provinceName: 'TP. Hồ Chí Minh',
    districtId: 1442,
    districtName: 'Quận 1',
    wardCode: '20101',
    wardName: 'Phường Bến Nghé',
    specificAddress: '',
    fullDisplayName: '',
    isMatched: false,
  };

  try {
    let rawProvince = '';
    let rawCity = '';
    let rawState = '';
    let rawDistrict = '';
    let rawCounty = '';
    let rawCityDistrict = '';
    let rawWard = '';
    let rawSuburb = '';
    let rawQuarter = '';
    let houseNumber = '';
    let road = '';
    let building = '';
    let fullDisplayName = '';

    // Provider 1: OpenStreetMap Nominatim
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&accept-language=vi`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ShopQRPayment/1.0 (nhonhoa.developer@gmail.com)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        fullDisplayName = data.display_name || '';

        rawProvince = addr.province || '';
        rawCity = addr.city || '';
        rawState = addr.state || '';
        rawDistrict = addr.district || '';
        rawCounty = addr.county || '';
        rawCityDistrict = addr.city_district || '';
        rawWard = addr.ward || '';
        rawSuburb = addr.suburb || '';
        rawQuarter = addr.quarter || addr.neighbourhood || '';
        houseNumber = addr.house_number || '';
        road = addr.road || addr.street || '';
        building = addr.building || addr.amenity || '';
      }
    } catch (nomErr) {
      console.warn('[GeocodingService] Nominatim fetch error or timeout, trying secondary provider:', nomErr);
    }

    // Provider 2: BigDataCloud Reverse Geocode (Nhanh và không bị giới hạn)
    if (!rawProvince && !rawCity && !rawState) {
      try {
        const bdcController = new AbortController();
        const bdcTimeout = setTimeout(() => bdcController.abort(), 3500);

        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
          lat
        )}&longitude=${encodeURIComponent(lon)}&localityLanguage=vi`;

        const bdcRes = await fetch(bdcUrl, { signal: bdcController.signal });
        clearTimeout(bdcTimeout);

        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          rawCity = bdcData.city || '';
          rawState = bdcData.principalSubdivision || '';
          rawWard = bdcData.locality || '';
          // BDC có thể trả NHIỀU đơn vị hành chính cấp 6/7 (ví dụ vùng giáp ranh
          // Đà Nẵng/Quảng Nam trả cả "Dien Ban Dong" lẫn "Ngũ Hành Sơn") — đưa
          // tất cả vào các slot ứng viên để bộ so khớp thử lần lượt, thay vì chỉ
          // lấy entry đầu tiên gây khớp trượt quận.
          const adminNames = (bdcData.localityInfo?.administrative || [])
            .filter((a: { adminLevel?: number }) => a.adminLevel === 6 || a.adminLevel === 7)
            .map((a: { name?: string }) => a.name || '');
          rawDistrict = adminNames[0] || '';
          rawCounty = adminNames[1] || '';
          rawCityDistrict = adminNames[2] || '';
          fullDisplayName = [bdcData.locality, bdcData.city, bdcData.principalSubdivision]
            .filter(Boolean)
            .join(', ');
        }
      } catch (bdcErr) {
        console.warn('[GeocodingService] BigDataCloud fallback failed:', bdcErr);
      }
    }

    // Xây dựng địa chỉ cụ thể (số nhà, tên đường, tên tòa nhà)
    let specificAddress = '';
    if (building) {
      specificAddress = building;
      if (houseNumber || road) {
        specificAddress += `, ${[houseNumber, road].filter(Boolean).join(' ')}`;
      }
    } else if (houseNumber || road) {
      specificAddress = [houseNumber, road].filter(Boolean).join(' ');
    } else if (fullDisplayName) {
      const segments = fullDisplayName.split(',').map((s: string) => s.trim());
      specificAddress = segments.slice(0, 2).join(', ');
    }

    // So khớp Tỉnh / Thành phố
    const matchedProvince = findMatchingProvince(rawProvince, rawCity, rawState);
    if (!matchedProvince) {
      return {
        ...defaultFallback,
        specificAddress: specificAddress || fullDisplayName,
        fullDisplayName,
        isMatched: false,
      };
    }

    // So khớp Quận / Huyện trực tiếp từ candidates
    let matchedDistrict = findMatchingDistrict(
      matchedProvince,
      rawDistrict,
      rawCounty,
      rawCityDistrict
    );
    let matchedWard: Ward | null = null;

    // Suy luận ngược từ Phường/Xã: dữ liệu admin cấp thấp của BDC cho Việt Nam
    // thường là TÊN PHƯỜNG (vd. "Hòa Cường") chứ không phải quận — tra phường
    // trước rồi lấy quận cha, chính xác hơn nhiều so với khớp quận trực tiếp.
    if (!matchedDistrict) {
      const wardCandidates = [rawWard, rawSuburb, rawQuarter, rawDistrict, rawCounty, rawCityDistrict];
      for (const cand of wardCandidates) {
        const norm = normalizeLocationName(cand);
        if (!norm) continue;
        for (const dist of matchedProvince.districts) {
          const wardHit = dist.wards.find((w) =>
            looselyMatches(norm, normalizeLocationName(w.name))
          );
          if (wardHit) {
            matchedDistrict = dist;
            matchedWard = wardHit;
            break;
          }
        }
        if (matchedDistrict) break;
      }
    }

    // Không khớp được quận nào → trả isMatched:false trung thực (route sẽ tự
    // fallback qua IP). Tuyệt đối không đoán mù districts[0] — với dataset đầy
    // đủ, phần tử đầu có thể là huyện đảo cách cả trăm km (vd. Hoàng Sa).
    if (!matchedDistrict) {
      return {
        ...defaultFallback,
        specificAddress: specificAddress || fullDisplayName,
        fullDisplayName,
        isMatched: false,
      };
    }

    // So khớp Phường / Xã trong quận (nếu chưa suy luận được từ bước trên)
    if (!matchedWard) {
      matchedWard = findMatchingWard(matchedDistrict, rawWard, rawSuburb, rawQuarter);
    }
    matchedWard = matchedWard || matchedDistrict.wards[0] || null;

    const compositeDisplay =
      fullDisplayName ||
      [specificAddress, matchedWard?.name, matchedDistrict.name, matchedProvince.name]
        .filter(Boolean)
        .join(', ');

    return {
      provinceId: matchedProvince.id,
      provinceName: matchedProvince.name,
      districtId: matchedDistrict.id,
      districtName: matchedDistrict.name,
      wardCode: matchedWard ? matchedWard.code : '',
      wardName: matchedWard ? matchedWard.name : '',
      specificAddress,
      fullDisplayName: compositeDisplay,
      isMatched: true,
    };
  } catch (error) {
    console.warn('[GeocodingService] Reverse geocode exception:', error);
    return defaultFallback;
  }
}

/**
 * Tự động định vị dựa trên địa chỉ IP của client (Fallback khi thiết bị không có GPS hoặc người dùng chặn quyền)
 */
export async function resolveLocationByIp(clientIp?: string): Promise<ReverseGeocodeResult | null> {
  try {
    const isLocalIp =
      !clientIp ||
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === 'localhost' ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('10.');

    const queryUrl = isLocalIp
      ? 'http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,lat,lon'
      : `http://ip-api.com/json/${encodeURIComponent(
          clientIp
        )}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(queryUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 'success' && typeof data.lat === 'number' && typeof data.lon === 'number') {
      return reverseGeocodeCoordinates(data.lat, data.lon);
    }
    return null;
  } catch (err) {
    console.warn('[GeocodingService] IP Geolocation lookup failed:', err);
    return null;
  }
}
