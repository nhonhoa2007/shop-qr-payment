import { prisma } from '@server/database/prisma';
import { normalizeCatalogQuery, resolveProductPricing } from '@server/modules/catalog/catalog-query.service';
import { asRecord, normalizeVietnamese, readProductSpecs, canonicalSpecCode } from '@shared/utils/product-specs';
import type { AssistantProductCard, AssistantProductRef, AssistantSearchQuery, AssistantCommerce } from '@shared/types/assistant-commerce';

export interface CommerceVariant {
  id: string; title: string; price: bigint | number; stock: number; isActive: boolean;
  image?: string | null; specOverrides?: unknown; specs?: unknown; optionValues?: unknown; warrantyConfig?: unknown;
}
export interface CommerceProduct {
  id: string; name: string; description?: string | null; kind?: string; isActive?: boolean;
  price: bigint | number; stock?: number; inventoryMode?: string; image?: string | null; images?: unknown;
  categoryId?: string | null; category?: unknown;
  brand?: { name: string; slug?: string } | null;
  categoryRef?: { id: string; name: string; slug?: string; specSchema?: unknown; warrantyConfig?: unknown } | null;
  specs?: unknown; specValues?: unknown; warrantyConfig?: unknown; variants?: CommerceVariant[]; editorialTags?: unknown;
}
export interface CommerceDb {
  product: { findMany(args: Record<string, unknown>): Promise<CommerceProduct[]> };
}
const BRANDS = ['apple', 'lenovo', 'dell', 'asus', 'acer', 'hp', 'msi', 'samsung', 'xiaomi', 'oppo', 'vivo', 'sony', 'anker', 'ugreen', 'logitech', 'razer', 'jbl', 'belkin', 'huawei'];
const ACCESSORY_NAMES: Record<string, RegExp> = {
  'tai nghe': /\b(tai nghe|headphones?|earbuds?|earphones?|buds\w*|airpods\w*)\b/,
  sac: /\b(sac|chargers?|power adapters?|power banks?)\b/,
  cap: /\b(cap|cables?)\b/,
  chuot: /\b(chuot|mouse|mice)\b/,
  'ban phim': /\b(ban phim|keyboards?)\b/,
};
const MONEY = /(\d+(?:[.,]\d+)?)\s*(trieu|tr|million|nghin|ngan|k|vnd|dong|d)(?![a-z])/g;
const STOP = new Set('tim kiem cho toi minh ban shop cua hang co nhung cac san pham nao gi hay giup xem muon mua mot chiec may voi va hoac la duoc khong nay hien dang ban nhe gia tam khoang tu den toi da duoi tren hon re nhat dat con het hang san hoc lap trinh van phong game gaming can dung de'.split(' '));

function money(value: string, unit: string): string {
  const amount = Number(value.replace(',', '.')) * (['trieu', 'tr', 'million'].includes(unit) ? 1_000_000 : ['nghin', 'ngan', 'k'].includes(unit) ? 1000 : 1);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Mức giá không hợp lệ');
  return String(amount);
}
export function parseCommerceQuery(text: string, previous?: AssistantSearchQuery): AssistantSearchQuery {
  if (text.length > 2000) throw new Error('Câu hỏi quá dài (tối đa 2000 ký tự)');
  let normalized = normalizeVietnamese(text);
  const refining = /\b(re hon|dat hon|con hang|ram|ssd|duoi|tren|tu)\b/.test(normalized) && !/\b(laptop|dien thoai|tai nghe|sac|cap|chuot|ban phim)\b/.test(normalized);
  const query: AssistantSearchQuery = refining && previous ? { ...previous, terms: [...previous.terms], specs: { ...previous.specs } } : { terms: [], specs: {} };
  const categoryPatterns: Array<[RegExp, AssistantSearchQuery['kind'], string?]> = [
    [/\b(laptop|may tinh xach tay|notebook|macbook)\b/, 'LAPTOP'],
    [/\b(dien thoai|smartphone|phone|iphone)\b/, 'PHONE'],
    [/\b(tai nghe|headphones?|earbuds?)\b/, 'ACCESSORY', 'tai nghe'],
    [/\b(sac|charger)\b/, 'ACCESSORY', 'sac'], [/\b(cap|cable)\b/, 'ACCESSORY', 'cap'],
    [/\b(chuot|mouse)\b/, 'ACCESSORY', 'chuot'], [/\b(ban phim|keyboard)\b/, 'ACCESSORY', 'ban phim'],
    [/\b(phu kien|accessories|hub)\b/, 'ACCESSORY'],
  ];
  for (const [pattern, kind, term] of categoryPatterns) {
    if (pattern.test(normalized)) { query.kind = kind; query.categoryTerm = term; normalized = normalized.replace(pattern, ' '); break; }
  }
  if (/\biphone\b/.test(normalizeVietnamese(text))) { query.terms = ['iphone']; }
  if (/\bmacbook\b/.test(normalizeVietnamese(text))) { query.terms = ['macbook']; }
  for (const brand of BRANDS) if (new RegExp(`\\b${brand}\\b`).test(normalized)) {
    query.brand = brand; normalized = normalized.replace(new RegExp(`\\b${brand}\\b`, 'g'), ' '); break;
  }
  normalized = normalized.replace(/\b(ram|ssd|bo nho|dung luong)\s*(\d+)\s*(gb|tb)?\b/g, (_, field: string, amount: string, unit?: string) => {
    const code = field === 'ram' ? 'ram_capacity_gb' : 'storage_capacity_gb';
    query.specs[code] = String(Number(amount) * (unit === 'tb' ? 1024 : 1)); return ' ';
  });
  const prices = [...normalized.matchAll(MONEY)];
  for (let i = 0; i < prices.length; i++) {
    const match = prices[i]; const amount = money(match[1], match[2]);
    const prefix = normalized.slice(Math.max(0, match.index! - 20), match.index).trim();
    if (/\b(duoi|re hon|nho hon)$/.test(prefix)) query.maxPrice = String(Math.max(0, Number(amount) - 1));
    else if (/\b(tren|dat hon|lon hon)$/.test(prefix)) query.minPrice = String(Number(amount) + 1);
    else if (/\b(tu|it nhat)$/.test(prefix)) query.minPrice = amount;
    else query.maxPrice = amount;
  }
  normalized = normalized.replace(MONEY, ' ');
  if (/\bcon hang\b/.test(normalized)) query.inStock = true;
  if (/\b(re nhat|re hon)\b/.test(normalized)) query.sort = 'price-asc';
  if (/\b(dat nhat|dat hon)\b/.test(normalized)) query.sort = 'price-desc';
  const terms = normalized.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(word => word.length >= 2 && !STOP.has(word));
  if (terms.length) query.terms = [...new Set([...query.terms, ...terms])].slice(0, 12);
  normalizeCatalogQuery({ minPrice: query.minPrice, maxPrice: query.maxPrice, specs: Object.fromEntries(Object.entries(query.specs).map(([k, v]) => [k, [v]])) });
  return query;
}

export function productSpecs(product: CommerceProduct, variant?: CommerceVariant) {
  const specs = readProductSpecs(product.specs ?? product.specValues, variant?.specOverrides ?? variant?.specs);
  // Option values only override actual specification keys, never arbitrary marketing metadata.
  for (const [key, value] of Object.entries(asRecord(variant?.optionValues))) {
    const code = canonicalSpecCode(key);
    if (code in specs && ['string', 'number', 'boolean'].includes(typeof value)) Object.assign(specs, readProductSpecs({ [code]: value }));
  }
  return specs;
}
export function toAssistantCard(product: CommerceProduct, variant?: CommerceVariant): AssistantProductCard {
  const pricing = resolveProductPricing(variant ? { ...variant, inventoryMode: 'BASE' } : product);
  const warranty = asRecord(variant?.warrantyConfig ?? product.warrantyConfig ?? product.categoryRef?.warrantyConfig);
  const period = warranty.periodMonths ?? warranty.durationMonths ?? warranty.months;
  const images = Array.isArray(product.images) ? product.images : [];
  const image = variant?.image || product.image || (typeof images[0]?.url === 'string' ? images[0].url : null);
  const resolvedSpecs = productSpecs(product, variant);
  const activeVariants = (product.variants || []).filter(v => v.isActive !== false);
  if (!variant && product.inventoryMode === 'VARIANT' && activeVariants.length) {
    const configurations = activeVariants.map(v => productSpecs(product, v));
    for (const code of new Set(configurations.flatMap(s => Object.keys(s)))) {
      const first = configurations[0][code];
      const uniform = first && configurations.every(s => s[code]?.state === first.state && s[code]?.value === first.value && s[code]?.unit === first.unit);
      if (uniform) resolvedSpecs[code] = first;
      else resolvedSpecs[code] = { ...(first || resolvedSpecs[code]), code, state: 'UNKNOWN', value: undefined, formatted: 'Tùy cấu hình — chọn phiên bản để xem' };
    }
  }
  const specs = Object.values(resolvedSpecs);
  return {
    productId: product.id, ...(variant ? { variantId: variant.id, variantName: variant.title } : {}),
    name: product.name, image, brand: product.brand?.name || null,
    categoryId: product.categoryId || product.categoryRef?.id || null,
    categoryName: product.categoryRef?.name || (typeof product.category === 'string' ? product.category : 'Sản phẩm'),
    href: `/products/${encodeURIComponent(product.id)}`, price: { min: pricing.priceRange.min, max: pricing.priceRange.max },
    stock: pricing.totalStock, specs, isDemo: asRecord(product.editorialTags).origin === 'SYNTHETIC_DEMO',
    warranty: typeof period === 'number' && period > 0 ? `${period} tháng` : 'Chưa có dữ liệu',
  };
}
export async function loadCommerceProducts(db: CommerceDb = prisma as unknown as CommerceDb, refs?: AssistantProductRef[]) {
  const products = await db.product.findMany({
    where: { isActive: true, ...(refs ? { id: { in: [...new Set(refs.map(r => r.productId))] } } : {}) },
    include: { brand: true, categoryRef: true, variants: { where: { isActive: true } } },
    orderBy: { id: 'asc' }, take: refs ? 5 : 501,
  });
  return products.filter(p => p.isActive !== false);
}
export async function searchAssistantProducts(text: string, db: CommerceDb = prisma as unknown as CommerceDb, previous?: AssistantSearchQuery): Promise<AssistantCommerce & { query: AssistantSearchQuery }> {
  const query = parseCommerceQuery(text, previous);
  const raw = await loadCommerceProducts(db);
  const cards: AssistantProductCard[] = [];
  for (const product of raw.slice(0, 500)) {
    if (query.kind && product.kind !== query.kind) continue;
    const haystack = normalizeVietnamese(`${product.name} ${product.brand?.name || ''} ${product.categoryRef?.name || ''} ${typeof product.category === 'string' ? product.category : ''}`);
    if (query.brand && !haystack.includes(query.brand)) continue;
    if (query.categoryTerm && !(ACCESSORY_NAMES[query.categoryTerm]?.test(haystack) ?? haystack.includes(query.categoryTerm))) continue;
    if (!query.terms.every(term => haystack.includes(term))) continue;
    const match = (variant?: CommerceVariant) => {
      const price = BigInt(variant?.price ?? product.price);
      if (query.minPrice && price < BigInt(query.minPrice)) return false;
      if (query.maxPrice && price > BigInt(query.maxPrice)) return false;
      if (query.inStock && (variant?.stock ?? product.stock ?? 0) <= 0) return false;
      const specs = productSpecs(product, variant);
      return Object.entries(query.specs).every(([key, value]) => specs[key]?.state === 'KNOWN' && String(specs[key].value) === value);
    };
    if (product.inventoryMode === 'VARIANT') {
      const active = (product.variants || []).filter(v => v.isActive !== false);
      const matching = active.filter(v => match(v)).sort((a, b) => Number(BigInt(a.price) - BigInt(b.price)));
      if (!matching.length) continue;
      const constrained = Boolean(query.minPrice || query.maxPrice || query.inStock || Object.keys(query.specs).length);
      cards.push(toAssistantCard(product, constrained ? matching[0] : undefined));
    } else if (match()) cards.push(toAssistantCard(product));
  }
  if (query.sort) cards.sort((a, b) => (BigInt(a.price.min) < BigInt(b.price.min) ? -1 : BigInt(a.price.min) > BigInt(b.price.min) ? 1 : 0) * (query.sort === 'price-desc' ? -1 : 1));
  return { kind: 'search', products: cards.slice(0, 5), total: cards.length, query, truncated: raw.length > 500,
    ...(raw.length > 500 ? { notice: 'Đã tìm trong 500 sản phẩm; hãy thêm tên hãng hoặc model để thu hẹp kết quả.' } : {}) };
}
