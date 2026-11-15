import type { EvidenceCitation } from '@shared/types/assistant';
import type { AssistantCommerce, AssistantProductCard, AssistantProductRef, AssistantSearchQuery, AssistantComparison } from '@shared/types/assistant-commerce';
import { asRecord, normalizeVietnamese } from '@shared/utils/product-specs';
import { searchAssistantProducts, loadCommerceProducts, toAssistantCard, type CommerceDb } from './commerce-search.service';

export interface CommerceContext {
  kind: AssistantCommerce['kind'];
  refs: AssistantProductRef[];
  query?: AssistantSearchQuery;
}
export interface CommerceInput { content: string; comparison?: AssistantProductRef[]; productIds?: string[] }
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
export function validateComparisonRefs(raw: unknown): AssistantProductRef[] {
  if (!Array.isArray(raw) || raw.length !== 2) throw new Error('Yêu cầu chọn đúng 2 sản phẩm để so sánh');
  const refs = raw.map(item => {
    const value = asRecord(item);
    if (typeof value.productId !== 'string' || !ID_PATTERN.test(value.productId) ||
        (value.variantId !== undefined && (typeof value.variantId !== 'string' || !ID_PATTERN.test(value.variantId)))) throw new Error('Mã sản phẩm hoặc biến thể không hợp lệ');
    return { productId: value.productId, ...(typeof value.variantId === 'string' ? { variantId: value.variantId } : {}) };
  });
  if (new Set(refs.map(r => `${r.productId}:${r.variantId || ''}`)).size !== 2) throw new Error('Không được chọn trùng sản phẩm hoặc phiên bản');
  return refs;
}
export function commerceCitations(commerce: AssistantCommerce): EvidenceCitation[] {
  const citations: EvidenceCitation[] = commerce.products.map((p, position) => ({
    id: `shop_product_${p.productId}_${p.variantId || 'base'}`, type: 'LIVE_PRICE_STOCK',
    title: `${p.name}${p.variantName ? ` — ${p.variantName}` : ''} — thông tin tại shop`, publisher: 'Shop QR',
    productRef: { version: 1, kind: commerce.kind, position, productId: p.productId, ...(p.variantId ? { variantId: p.variantId } : {}) },
  }));
  citations.push({ id: 'shop_commerce_context', type: 'LIVE_PRICE_STOCK', title: 'Kết quả tra cứu tại shop', publisher: 'Shop QR',
    commerceContext: { version: 1, kind: commerce.kind, ...(commerce.query ? { query: commerce.query } : {}) } });
  return citations;
}
export function readCommerceContext(raw: unknown): CommerceContext | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries = raw.slice(0, 24).map(asRecord);
  const meta = entries.map(c => asRecord(c.commerceContext)).find(m => m.version === 1 && ['search', 'comparison', 'clarification'].includes(String(m.kind)));
  if (!meta) return undefined;
  const refs = entries.map(c => asRecord(c.productRef)).filter(r => r.version === 1 && typeof r.productId === 'string' && ID_PATTERN.test(r.productId))
    .sort((a, b) => Number(a.position) - Number(b.position)).slice(0, 5)
    .map(r => ({ productId: String(r.productId), ...(typeof r.variantId === 'string' && ID_PATTERN.test(r.variantId) ? { variantId: r.variantId } : {}) }));
  const query = asRecord(meta.query);
  return { kind: meta.kind as CommerceContext['kind'], refs,
    ...(Array.isArray(query.terms) && query.specs && typeof query.specs === 'object' ? { query: query as unknown as AssistantSearchQuery } : {}) };
}
async function cardsForRefs(refs: AssistantProductRef[], db: CommerceDb): Promise<AssistantProductCard[]> {
  const products = await loadCommerceProducts(db, refs);
  return refs.flatMap(ref => {
    const product = products.find(p => p.id === ref.productId);
    if (!product) return [];
    const variant = ref.variantId ? product.variants?.find(v => v.id === ref.variantId && v.isActive !== false) : undefined;
    if (ref.variantId && !variant) return [];
    return [toAssistantCard(product, variant)];
  });
}
function formatPrice(card: AssistantProductCard): string {
  const format = (amount: string) => `${BigInt(amount).toLocaleString('vi-VN')}đ`;
  return card.price.min === card.price.max ? format(card.price.min) : `${format(card.price.min)} – ${format(card.price.max)}`;
}
export function buildAssistantComparison(cards: [AssistantProductCard, AssistantProductCard]): AssistantComparison {
  const rows: AssistantComparison['rows'] = [
    { code: 'price', label: 'Giá hiện tại', values: cards.map(formatPrice) as [string, string] },
    { code: 'configuration', label: 'Phiên bản', values: cards.map(c => c.variantName || (c.price.min !== c.price.max ? 'Nhiều cấu hình — khoảng giá' : 'Thông số niêm yết của sản phẩm')) as [string, string] },
    { code: 'stock', label: 'Tình trạng', values: cards.map(c => c.stock > 0 ? 'Còn hàng' : 'Hết hàng') as [string, string] },
  ];
  const codes = [...new Set(cards.flatMap(c => c.specs.map(s => s.code)))];
  for (const code of codes) {
    const cells = cards.map(c => c.specs.find(s => s.code === code));
    rows.push({ code, label: cells[0]?.label || cells[1]?.label || code, values: cells.map(c => c?.formatted || 'Chưa có dữ liệu') as [string, string] });
  }
  rows.push({ code: 'warranty', label: 'Bảo hành', values: cards.map(c => c.warranty) as [string, string] });
  const summary: string[] = [];
  if (cards.every(c => c.price.min === c.price.max)) {
    const difference = BigInt(cards[0].price.min) - BigInt(cards[1].price.min);
    if (difference) summary.push(`${cards[difference < 0n ? 0 : 1].name} có giá thấp hơn ${(difference < 0n ? -difference : difference).toLocaleString('vi-VN')}đ.`);
  }
  for (const [code, description] of [['ram_capacity_gb', 'dung lượng RAM'], ['storage_capacity_gb', 'dung lượng lưu trữ']] as const) {
    const [a, b] = cards.map(c => c.specs.find(s => s.code === code));
    if (a?.state === 'KNOWN' && b?.state === 'KNOWN' && typeof a.value === 'number' && typeof b.value === 'number' && a.value !== b.value) {
      summary.push(`${cards[a.value > b.value ? 0 : 1].name} có ${description} lớn hơn (${Math.max(a.value, b.value)} ${a.unit || 'GB'} so với ${Math.min(a.value, b.value)} ${b.unit || 'GB'}).`);
    }
  }
  if (!summary.length) summary.push('Bạn có thể đối chiếu các thông số đã có trong bảng; dữ liệu hiện tại chưa đủ để kết luận sản phẩm nào phù hợp hơn.');
  return { products: cards, rows, summary };
}
function comparisonCommerce(cards: AssistantProductCard[]): { commerce: AssistantCommerce; answer: string } {
  if (cards.length !== 2) return { commerce: { kind: 'clarification', products: cards, total: cards.length }, answer: 'Một sản phẩm hoặc phiên bản không còn được bán. Bạn hãy chọn lại hai sản phẩm đang có trên shop.' };
  if (cards[0].productId === cards[1].productId && cards[0].variantId === cards[1].variantId) return {
    commerce: { kind: 'clarification', products: [cards[0]], total: 1 }, answer: 'Bạn đang chọn trùng một sản phẩm. Hãy chọn hai sản phẩm hoặc hai cấu hình khác nhau để so sánh.' };
  if (!cards[0].categoryId || cards[0].categoryId !== cards[1].categoryId) return {
    commerce: { kind: 'clarification', products: cards, total: cards.length }, answer: 'Bạn hãy chọn hai sản phẩm cùng danh mục để so sánh các thông số phù hợp.' };
  const comparison = buildAssistantComparison(cards as [AssistantProductCard, AssistantProductCard]);
  return { commerce: { kind: 'comparison', products: cards, total: 2, comparison }, answer: `Đây là bảng so sánh ${cards[0].name} và ${cards[1].name} theo dữ liệu hiện có trên shop.\n${comparison.summary.join('\n')}` };
}
export async function hydrateAssistantCommerce(raw: unknown, db: CommerceDb): Promise<AssistantCommerce | undefined> {
  const context = readCommerceContext(raw);
  if (!context) return undefined;
  const products = await cardsForRefs(context.refs, db);
  const lost = products.length !== context.refs.length;
  const commerce = context.kind === 'comparison' && products.length === 2 ? comparisonCommerce(products).commerce
    : { kind: lost ? 'clarification' as const : context.kind, products, total: products.length };
  return { ...commerce, query: context.query, refreshed: true,
    ...(lost ? { notice: 'Một số sản phẩm hoặc phiên bản không còn được bán; dữ liệu bên dưới là thông tin hiện tại.' } : {}) };
}
export async function resolveAssistantCommerce(input: CommerceInput, context: CommerceContext | undefined, db: CommerceDb): Promise<{ commerce: AssistantCommerce; answer: string } | undefined> {
  const normalized = normalizeVietnamese(input.content);
  const compare = Boolean(input.comparison) || /\b(so sanh|versus|vs)\b/.test(normalized);
  if (input.comparison) return comparisonCommerce(await cardsForRefs(validateComparisonRefs(input.comparison), db));
  if (compare) {
    if (/\b(dau tien|dau|1 va 2|thu nhat.*thu hai)\b/.test(normalized)) {
      if ((context?.refs.length || 0) >= 2) return comparisonCommerce(await cardsForRefs(context!.refs.slice(0, 2), db));
      return { commerce: { kind: 'clarification', products: [], total: 0 }, answer: 'Bạn hãy tìm sản phẩm trước, hoặc cho mình tên hai sản phẩm cần so sánh.' };
    }
    const names = input.content.replace(/^.*?(?:so sánh|so sanh|compare)\s*/i, '').split(/\s+(?:và|va|với|voi|vs\.?|versus)\s+|\s*&\s*/i);
    if (names.length === 2 && names.every(name => name.trim())) {
      const searches = await Promise.all(names.map(name => searchAssistantProducts(name.trim(), db)));
      if (searches.every(s => s.total === 1)) return comparisonCommerce(searches.map(s => s.products[0]));
      const candidates = [...new Map(searches.flatMap(s => s.products).map(p => [`${p.productId}:${p.variantId || ''}`, p])).values()].slice(0, 5);
      return { commerce: { kind: 'clarification', products: candidates, total: candidates.length }, answer: 'Tên sản phẩm chưa đủ rõ hoặc có nhiều kết quả. Bạn chọn đúng hai sản phẩm trên các thẻ bên dưới nhé.' };
    }
    if (input.productIds?.length === 2) return comparisonCommerce(await cardsForRefs(input.productIds.map(productId => ({ productId })), db));
    return { commerce: { kind: 'clarification', products: context ? await cardsForRefs(context.refs, db) : [], total: context?.refs.length || 0 }, answer: 'Bạn chọn hai sản phẩm bằng nút “Chọn so sánh”, hoặc nhập “So sánh [tên sản phẩm A] và [tên sản phẩm B]”.' };
  }
  if (input.productIds?.length) return undefined;
  if (/^(hi|hello|hey|chao|xin chao|chao shop|ban la ai)[!.?\s]*$/.test(normalized)) return undefined;
  const ordinal = /\b(thu hai|thu 2|chiec thu hai|san pham thu hai)\b/.test(normalized) ? 1
    : /\b(thu nhat|dau tien|thu 1)\b/.test(normalized) ? 0 : -1;
  if (ordinal >= 0) {
    const ref = context?.refs[ordinal];
    const cards = ref ? await cardsForRefs([ref], db) : [];
    return { commerce: { kind: 'search', products: cards, total: cards.length }, answer: cards.length ? `Thông tin hiện tại của ${cards[0].name} có ở thẻ bên dưới.` : 'Mình chưa xác định được sản phẩm bạn nhắc tới. Bạn tìm hoặc chọn lại sản phẩm nhé.' };
  }
  const commerce = await searchAssistantProducts(input.content, db, context?.query);
  const answer = commerce.total ? `Mình tìm được ${commerce.total} sản phẩm phù hợp trên shop${commerce.total > 5 ? ', hiển thị 5 kết quả đầu tiên' : ''}. Bạn bấm vào sản phẩm để xem chi tiết hoặc chọn hai sản phẩm để so sánh.`
    : 'Chưa tìm thấy sản phẩm nào trên shop khớp yêu cầu này. Bạn có thể đổi tên model, khoảng giá hoặc thông số cần tìm.';
  return { commerce, answer };
}
