import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareDemoCatalog, planDemoImageUpdates } from '../scripts/import-demo-technology-catalog.ts';
import { toAssistantCard } from '../src/server/modules/assistant/commerce-search.service.ts';

const manifest = () => JSON.parse(fs.readFileSync(new URL('../prisma/data/electronics-catalog.json', import.meta.url), 'utf8'));
describe('Demo technology catalog', () => {
  it('prepares all 50 products with explicit demo disclosure, synthetic provenance and variant-specific specs', () => {
    const data = prepareDemoCatalog(manifest());
    assert.equal(data.products.length, 50);
    const laptop = data.products[0];
    assert.match(laptop.description, /DỮ LIỆU DEMO/);
    assert.equal(laptop.editorialTags.origin, 'SYNTHETIC_DEMO');
    assert.equal(data.sources[0].isSynthetic, true);
    assert.equal(data.sources[0].sourceType, 'CATALOG');
    assert.match(data.sources[0].checksum, /^[a-f0-9]{64}$/);
    assert.equal(laptop.variants[1].specOverrides.values.ram.value, 36);
    assert.equal(laptop.inventoryMode, 'VARIANT');
    assert.equal(laptop.images?.[0]?.url, '/demo/products/macbook.webp');
    assert.ok(data.products.every(p => p.images?.[0]?.url.startsWith('/')));
    assert.deepEqual(prepareDemoCatalog(manifest()), data);
  });
  it('rejects invalid stock, duplicate SKUs and undeclared relationships before any database write', () => {
    for (const mutate of [
      (m: ReturnType<typeof manifest>) => { m.products[0].variants[0].stock = -1; },
      (m: ReturnType<typeof manifest>) => { m.products[1].variants[0].sku = m.products[0].variants[0].sku; },
      (m: ReturnType<typeof manifest>) => { m.products[0].categoryId = 'missing'; },
    ]) {
      const raw = manifest(); mutate(raw);
      assert.throws(() => prepareDemoCatalog(raw));
    }
  });
  it('carries the demo label into assistant cards', () => {
    const card = toAssistantCard({ id: 'demo', name: 'Laptop', price: 10n, stock: 1, editorialTags: { origin: 'SYNTHETIC_DEMO' } });
    assert.equal(card.isDemo, true);
  });
  it('refreshes only managed demo photos and preserves custom product or gallery images', () => {
    const products = prepareDemoCatalog(manifest()).products;
    const existing = products.slice(0, 4).map(p => ({ id: p.id, image: '/showcase/laptops.png', images: [{ url: '/showcase/laptops.png' }], editorialTags: p.editorialTags }));
    existing[1].image = '/uploads/custom-photo.webp';
    existing[2].images = [{ url: '/uploads/custom-gallery.webp' }];
    const updates = planDemoImageUpdates(existing, products);
    assert.deepEqual(updates.map(p => p.id), [products[0].id, products[3].id]);
    assert.ok(updates.every(p => Object.keys(p).sort().join(',') === 'id,image,images'));
    assert.ok(updates.every(p => p.image.startsWith('/demo/products/')));
    const refreshed = existing.map(p => {
      const update = updates.find(u => u.id === p.id);
      return update ? { ...p, image: update.image, images: update.images.map(image => ({ alt: image.alt, sortOrder: image.sortOrder, url: image.url })) } : p;
    });
    assert.deepEqual(planDemoImageUpdates(refreshed, products), []);
  });
  it('refuses to replace a non-demo product with a conflicting product identifier', () => {
    const products = prepareDemoCatalog(manifest()).products;
    assert.throws(() => planDemoImageUpdates([{ id: products[0].id, image: null, images: [], editorialTags: {} }], products), /not this demo version/);
  });
});
