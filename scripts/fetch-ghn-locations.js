/**
 * Import dữ liệu hành chính đầy đủ (63 tỉnh / quận-huyện / phường-xã) từ GHN Master-Data
 * và sinh lại file src/shared/constants/vietnam-locations.ts
 *
 * Cần GHN_TOKEN trong .env (xem .env.example). Chạy: npm run ghn:import
 *
 * Lý do: dataset thủ công trong vietnam-locations.ts chỉ là bản "lite" (17 tỉnh,
 * mỗi tỉnh vài quận) nên tính năng định vị GPS chỉ khớp được đúng khu vực nếu
 * khu vực đó nằm trong danh sách. Dữ liệu GHN gốc là nguồn chính thức mà app
 * dùng để tính phí ship, bảo đảm mapping GPS → GHN luôn khớp.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const GHN_BASE = process.env.GHN_API_BASE_URL || 'https://dev-online-gateway.ghn.vn/shiip/public-api/';
const TOKEN = process.env.GHN_TOKEN || '';
const OUT_FILE = path.resolve(__dirname, '../src/shared/constants/vietnam-locations.ts');

// Ghép id ngắn dùng trong app theo TÊN tỉnh (GHN có renumber ProvinceID giữa các
// giai đoạn nên không thể ghép theo số — tên tỉnh thì ổn định qua các đợt sáp nhập/đổi mã)
function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/^(thanh pho|tinh|thi xa|tp)\.?\s*/, '')
    .replace(/[^a-z0-9]/g, '');
}

const LEGACY_ID_BY_NAME = {
  hochiminh: 'hcm',
  hanoi: 'hn',
  danang: 'dn',
  cantho: 'ct',
  haiphong: 'hp',
  binhduong: 'bd',
  dongnai: 'dnai',
  bariavungtau: 'vt',
  khanhhoa: 'kh',
  lamdong: 'ld',
  thuathienhue: 'hue',
  quangninh: 'qn',
  bacninh: 'bn',
  nghean: 'na',
  thanhhoa: 'th',
  tiengiang: 'tg',
  kiengiang: 'kg',
};

async function ghnFetch(pathname, options = {}) {
  const res = await fetch(`${GHN_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Token: TOKEN,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.code !== 200) {
    throw new Error(`GHN ${pathname} failed: HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.data;
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function main() {
  if (!TOKEN) {
    console.error('❌ Chưa có GHN_TOKEN trong .env. Thêm token (xem .env.example) rồi chạy lại: npm run ghn:import');
    process.exit(1);
  }

  console.log('⏳ Đang tải danh sách tỉnh/thành từ GHN Master-Data...');
  // Gateway production chỉ có endpoint số ít `master-data/province`;
  // gateway dev dùng số nhiều — thử lần lượt để chạy được với cả hai loại token.
  let provinces;
  try {
    provinces = await ghnFetch('master-data/province');
  } catch {
    provinces = await ghnFetch('master-data/provinces');
  }
  console.log(`   → ${provinces.length} tỉnh/thành`);

  console.log('⏳ Đang tải danh sách quận/huyện...');
  const districts = await ghnFetch('master-data/district');
  console.log(`   → ${districts.length} quận/huyện`);

  const districtsByProvince = new Map();
  for (const d of districts) {
    if (!districtsByProvince.has(d.ProvinceID)) districtsByProvince.set(d.ProvinceID, []);
    districtsByProvince.get(d.ProvinceID).push(d);
  }

  console.log('⏳ Đang tải phường/xã theo từng quận (chạy 5 luồng song song)...');
  const wardsByDistrict = new Map();
  let done = 0;
  const districtList = [...districts];
  const CONCURRENCY = 5;

  async function worker() {
    while (districtList.length > 0) {
      const d = districtList.shift();
      if (!d) break;
      try {
        const data = await ghnFetch('master-data/ward', {
          method: 'POST',
          body: JSON.stringify({ district_id: d.DistrictID }),
        });
        wardsByDistrict.set(d.DistrictID, data || []);
      } catch (err) {
        console.warn(`   ⚠️ Bỏ qua quận ${d.DistrictID} (${d.DistrictName}): ${err.message}`);
        wardsByDistrict.set(d.DistrictID, []);
      }
      done += 1;
      if (done % 50 === 0) console.log(`   ... ${done}/${districts.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log('⏳ Đang sinh file vietnam-locations.ts...');
  const lines = [];
  lines.push('// ⚠️ FILE TỰ SINH bởi `npm run ghn:import` (scripts/fetch-ghn-locations.js) — KHÔNG sửa tay.');
  lines.push(`// Nguồn: GHN Master-Data, xuất lúc ${new Date().toISOString()}`);
  lines.push('');
  lines.push('export interface Ward {');
  lines.push('  code: string;');
  lines.push('  name: string;');
  lines.push('}');
  lines.push('');
  lines.push('export interface District {');
  lines.push('  id: number;');
  lines.push('  name: string;');
  lines.push('  wards: Ward[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface Province {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  districts: District[];');
  lines.push('}');
  lines.push('');
  lines.push('export const VIETNAM_LOCATIONS: Province[] = [');
  // Đảm bảo id ngắn không trùng: nếu hai tỉnh cùng khớp một key (trường hợp hiếm)
  // thì tỉnh sau rơi về p{ProvinceID}
  const usedShortIds = new Set();
  const resolveShortId = (p) => {
    const byName = LEGACY_ID_BY_NAME[normalizeName(p.ProvinceName)];
    const candidate = byName || `p${p.ProvinceID}`;
    if (usedShortIds.has(candidate)) return `p${p.ProvinceID}`;
    usedShortIds.add(candidate);
    return candidate;
  };
  for (const p of provinces) {
    const shortId = resolveShortId(p);
    lines.push('  {');
    lines.push(`    id: '${shortId}',`);
    // Gateway production trả NameExtension dạng mảng — dùng trường tên chính
    lines.push(`    name: '${esc(p.ProvinceName || (Array.isArray(p.NameExtension) ? p.NameExtension[0] : p.ProvinceName))}',`);
    lines.push('    districts: [');
    for (const d of districtsByProvince.get(p.ProvinceID) || []) {
      const wards = wardsByDistrict.get(d.DistrictID) || [];
      lines.push('      {');
      lines.push(`        id: ${d.DistrictID},`);
      lines.push(`        name: '${esc(d.DistrictName || (Array.isArray(d.NameExtension) ? d.NameExtension[0] : d.DistrictName))}',`);
      lines.push('        wards: [');
      for (const w of wards) {
        lines.push(`          { code: '${esc(w.WardCode)}', name: '${esc(w.WardName || (Array.isArray(w.NameExtension) ? w.NameExtension[0] : w.WardName))}' },`);
      }
      lines.push('        ],');
      lines.push('      },');
    }
    lines.push('    ],');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');

  const totalWards = [...wardsByDistrict.values()].reduce((s, w) => s + w.length, 0);
  console.log(`✅ Đã ghi ${OUT_FILE}`);
  console.log(`   ${provinces.length} tỉnh · ${districts.length} quận · ${totalWards} phường/xã`);
  console.log('ℹ️  Khởi động lại dev server để nạp dữ liệu mới.');
}

main().catch((err) => {
  console.error('❌ Import thất bại:', err.message);
  process.exit(1);
});
