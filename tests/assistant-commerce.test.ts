import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommerceQuery, searchAssistantProducts } from '../src/server/modules/assistant/commerce-search.service.ts';
import { readProductSpecs } from '../src/shared/utils/product-specs.ts';

const spec = (value: string | number, unit?: string) => ({ state: 'KNOWN', value, unit });
export function laptop(id: string, name: string, price = 18_000_000) {
  return { id, name, kind: 'LAPTOP', isActive: true, price: BigInt(price), stock: 3,
    inventoryMode: 'BASE', brand: { id: 'lenovo', name: 'Lenovo', slug: 'lenovo' },
    categoryId: 'laptops', category: 'Laptop', categoryRef: { id: 'laptops', name: 'Laptop', slug: 'laptop', specSchema: { definitions: [] } },
    specs: { schemaVersion: 1, values: { ram_capacity_gb: spec(16, 'GB'), storage_capacity_gb: spec(512, 'GB') } }, variants: [] as unknown[] };
}
const dbFor = (products: unknown[]) => ({ product: { findMany: async () => products } });

describe('Assistant commerce search', () => {
  it('finds English accessory names using Vietnamese subtype names', async () => {
    const accessory = (id: string, name: string, brand: string) => ({ ...laptop(id, name), kind: 'ACCESSORY', category: 'Phụ kiện', categoryRef: { id: 'accessories', name: 'Phụ kiện' }, brand: { name: brand } });
    const db = dbFor([accessory('a', 'Sony Wireless Headphones', 'Sony'), accessory('b', 'Anker USB-C Charger', 'Anker'), accessory('c', 'Logitech Wireless Mouse', 'Logitech'), accessory('d', 'Anker USB-C Cable', 'Anker'), accessory('e', 'Logitech Wireless Keyboard', 'Logitech')]);
    for (const [query, id] of [['tìm tai nghe Sony', 'a'], ['tìm sạc Anker', 'b'], ['tìm chuột Logitech', 'c'], ['tìm cáp Anker', 'd'], ['tìm bàn phím Logitech', 'e']]) {
      assert.deepEqual((await searchAssistantProducts(query, db)).products.map(p => p.productId), [id]);
    }
  });
  it('marks differing specs across unselected variants as unknown rather than claiming base configuration', async () => {
    const product = { ...laptop('p', 'Laptop'), inventoryMode: 'VARIANT', variants: [
      { id: 'v1', title: '16GB', isActive: true, price: 18_000_000n, stock: 2, specOverrides: { ram_capacity_gb: spec(16) } },
      { id: 'v2', title: '32GB', isActive: true, price: 22_000_000n, stock: 2, specOverrides: { ram_capacity_gb: spec(32) } },
    ] };
    const result = await searchAssistantProducts('laptop', dbFor([product]));
    assert.equal(result.products[0].specs.find(s => s.code === 'ram_capacity_gb')?.state, 'UNKNOWN');
    assert.match(result.products[0].specs.find(s => s.code === 'ram_capacity_gb')!.formatted, /cấu hình/i);
  });
  it('parses Vietnamese accents, aliases, RAM and strict budget expressions', () => {
    const query = parseCommerceQuery('Tìm máy tính xách tay RAM 16GB dưới 20tr còn hàng');
    assert.equal(query.kind, 'LAPTOP');
    assert.equal(query.maxPrice, '19999999');
    assert.equal(query.inStock, true);
    assert.equal(query.specs.ram_capacity_gb, '16');
    assert.equal(parseCommerceQuery('tai nghe từ 500k đến 1,5 triệu').minPrice, '500000');
    assert.equal(parseCommerceQuery('tai nghe từ 500k đến 1,5 triệu').maxPrice, '1500000');
  });
  it('finds token/alias matches without requiring the whole sentence in the name', async () => {
    const result = await searchAssistantProducts('cho tôi laptop Lenovo RAM 16GB dưới 20 triệu', dbFor([
      laptop('p1', 'Lenovo ThinkPad E14'), laptop('p2', 'Lenovo Yoga', 22_000_000),
      { ...laptop('p3', 'Lenovo IdeaPad'), isActive: false },
    ]));
    assert.deepEqual(result.products.map(p => p.productId), ['p1']);
    assert.equal(result.products[0].href, '/products/p1');
    assert.equal(result.products[0].price.min, '18000000');
  });
  it('matches accented product names with unaccented words', async () => {
    const result = await searchAssistantProducts('tim tai nghe sony', dbFor([
      { ...laptop('audio', 'Tai nghe Sony WH-1000XM5'), kind: 'ACCESSORY', category: 'Tai nghe',
        categoryRef: { id: 'audio', name: 'Tai nghe', slug: 'tai-nghe' }, brand: { name: 'Sony', slug: 'sony' } },
    ]));
    assert.equal(result.products.length, 1);
  });
  it('does not combine the price of one SKU with the RAM or stock of another', async () => {
    const product = { ...laptop('p1', 'Lenovo ThinkPad'), inventoryMode: 'VARIANT', variants: [
      { id: 'v8', title: '8GB', isActive: true, price: 15_000_000n, stock: 4, specOverrides: { ram_capacity_gb: spec(8) } },
      { id: 'v16', title: '16GB', isActive: true, price: 23_000_000n, stock: 0, specOverrides: { ram_capacity_gb: spec(16) } },
    ] };
    assert.equal((await searchAssistantProducts('laptop RAM 16GB dưới 20tr', dbFor([product]))).products.length, 0);
    assert.equal((await searchAssistantProducts('laptop RAM 16GB còn hàng', dbFor([product]))).products.length, 0);
    const valid = await searchAssistantProducts('laptop RAM 8GB dưới 20tr', dbFor([product]));
    assert.equal(valid.products[0].variantId, 'v8');
    assert.equal(valid.products[0].price.min, '15000000');
    assert.equal(valid.products[0].specs.find(s => s.code === 'ram_capacity_gb')?.value, 8);
  });
  it('returns at most five cards while retaining the match count and a refinable query', async () => {
    const result = await searchAssistantProducts('shop có laptop nào', dbFor(Array.from({ length: 8 }, (_, i) => laptop(`p${i}`, `Laptop ${i}`))));
    assert.equal(result.products.length, 5);
    assert.equal(result.total, 8);
    assert.equal(result.query.kind, 'LAPTOP');
    const cheaper = await searchAssistantProducts('rẻ hơn 17 triệu', dbFor([laptop('p1', 'Laptop', 16_000_000), laptop('p2', 'Laptop', 18_000_000)]), result.query);
    assert.deepEqual(cheaper.products.map(p => p.productId), ['p1']);
  });
  it('normalizes stateful specs, aliases and variant overrides without inventing unknowns', () => {
    const specs = readProductSpecs({ schemaVersion: 1, values: { ram_gb: spec(8), gpu_model: { state: 'UNKNOWN' }, touchscreen: { state: 'UNSUPPORTED' } } }, { ram_capacity_gb: spec(16) });
    assert.equal(specs.ram_capacity_gb.value, 16);
    assert.equal(specs.gpu_model.state, 'UNKNOWN');
    assert.equal(specs.touchscreen.state, 'UNSUPPORTED');
  });
});

describe('Assistant live evidence pricing', () => {
  it('uses the selected variant price, stock and canonical specs in grounded evidence', async () => {
    const {buildEvidenceBundle} = await import('../src/server/modules/assistant/evidence.service.ts');
    const product = {...laptop('p', 'Laptop Lenovo'), inventoryMode: 'VARIANT', variants:[
      {id:'v',title:'32GB',price:25_000_000n,stock:2,isActive:true,specOverrides:{ram_capacity_gb:spec(32)}}
    ]};
    const bundle = await buildEvidenceBundle({query:'RAM bao nhiêu?',productIds:['p'],variantIds:['v']},
      {...dbFor([product]),dataSource:{findMany:async()=>[]}});
    assert.equal(bundle.products[0].livePriceVnd,'25000000');
    assert.equal(bundle.products[0].liveStock,2);
    assert.equal(bundle.products[0].specs.ram_capacity_gb.value,32);
    assert.equal(bundle.products[0].variantId,'v');
  });
});
