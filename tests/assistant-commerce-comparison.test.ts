import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssistantCommerce, hydrateAssistantCommerce, commerceCitations, readCommerceContext } from '../src/server/modules/assistant/commerce.service.ts';

const spec = (value: number) => ({ state: 'KNOWN', value });
const p = (id: string, name: string) => ({ id, name, kind: 'LAPTOP', categoryId: 'laptop', category: 'Laptop', categoryRef: { id: 'laptop', name: 'Laptop' },
  isActive: true, inventoryMode: 'BASE', price: 18_000_000n, stock: 4, specs: { values: { ram_capacity_gb: spec(16) } }, variants: [] });
const products = [p('a', 'Lenovo ThinkPad E14'), p('b', 'MacBook Air M2')];
const db = { product: { findMany: async () => products } };

describe('Assistant structured comparison', () => {
  it('asks for two distinct items when identical model names are entered', async () => {
    const result = await resolveAssistantCommerce({ content: 'So sánh Lenovo ThinkPad E14 và Lenovo ThinkPad E14' }, undefined, db);
    assert.equal(result?.commerce.kind, 'clarification');
    assert.match(result!.answer, /khác|trùng|phân biệt/i);
  });
  it('resolves two named shop products and builds factual rows with detail links', async () => {
    const result = await resolveAssistantCommerce({ content: 'So sánh Lenovo ThinkPad E14 và MacBook Air M2' }, undefined, db);
    assert.equal(result?.commerce.kind, 'comparison');
    assert.deepEqual(result?.commerce.products.map(p => p.productId), ['a', 'b']);
    assert.ok(result?.commerce.comparison?.rows.some(r => r.code === 'ram_capacity_gb' && r.values[0] === '16 GB'));
    assert.equal(result?.commerce.products[1].href, '/products/b');
  });
  it('uses latest ordered results for first-two follow-ups and refreshes data', async () => {
    const search = await resolveAssistantCommerce({ content: 'tìm laptop' }, undefined, db);
    const context = readCommerceContext(commerceCitations(search!.commerce));
    assert.ok(context);
    const comparison = await resolveAssistantCommerce({ content: 'So sánh hai chiếc đầu tiên' }, context, db);
    assert.equal(comparison?.commerce.kind, 'comparison');
    const refreshed = await hydrateAssistantCommerce(commerceCitations(comparison!.commerce), { product: { findMany: async () => [{ ...products[0], price: 17_000_000n }, products[1]] } });
    assert.equal(refreshed?.products[0].price.min, '17000000');
    assert.equal(refreshed?.refreshed, true);
  });
  it('asks for clarification when a model name is ambiguous', async () => {
    const result = await resolveAssistantCommerce({ content: 'So sánh ThinkPad và MacBook Air M2' }, undefined,
      { product: { findMany: async () => [...products, p('c', 'Lenovo ThinkPad T14')] } });
    assert.equal(result?.commerce.kind, 'clarification');
    assert.match(result!.answer, /chọn|nhiều/i);
  });
  it('does not silently select two products when no previous search exists', async () => {
    const result = await resolveAssistantCommerce({ content: 'so sánh hai chiếc đầu tiên' }, undefined, db);
    assert.equal(result?.commerce.kind, 'clarification');
  });
  it('rejects mixed categories, duplicate selections, invalid variants and delisted products', async () => {
    const comparison = { content: 'so sánh', comparison: [{ productId: 'a' }, { productId: 'b' }] };
    const mismatch = await resolveAssistantCommerce(comparison, undefined, { product: { findMany: async () => [products[0], { ...products[1], categoryId: 'phone' }] } });
    assert.match(mismatch!.answer, /cùng.*danh mục/i);
    await assert.rejects(() => resolveAssistantCommerce({ ...comparison, comparison: [{ productId: 'a' }, { productId: 'a' }] }, undefined, db), /trùng/i);
    const invalid = await resolveAssistantCommerce({ ...comparison, comparison: [{ productId: 'a', variantId: 'other' }, { productId: 'b' }] }, undefined, db);
    assert.equal(invalid?.commerce.kind, 'clarification');
    const stale = await hydrateAssistantCommerce(commerceCitations({ kind: 'search', products: [await resolveAssistantCommerce({content: 'tìm laptop'}, undefined, db).then(r => r!.commerce.products[0])], total: 1 }), { product: { findMany: async () => [] } });
    assert.equal(stale?.products.length, 0);
    assert.match(stale!.notice!, /không còn/i);
  });
  it('keeps legacy citations readable without commerce data', async () => {
    assert.equal(await hydrateAssistantCommerce([{ id: 'old', title: 'Nguồn cũ' }], db), undefined);
  });
});
