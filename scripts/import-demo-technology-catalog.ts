import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PrismaClient, type Prisma, type ProductSegment } from '@prisma/client';
import type { CatalogManifest } from './import-electronics-catalog.ts';
import { computeVariantOptionHash, canonicalJsonStringify } from '../src/shared/validations/catalog-json.ts';
import { applyInventoryMovement } from '../src/server/modules/inventory/inventory-ledger.service.ts';
import { asRecord } from '../src/shared/utils/product-specs.ts';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const DEMO_NOTICE = 'DỮ LIỆU DEMO: Giá, tồn kho, thông số, bảo hành và ảnh minh họa chỉ phục vụ trình diễn, chưa được xác minh cho bán hàng thực tế.';

interface DemoMediaAsset { localPath: string; sourceProduct: string; publisher: string }
const demoMedia = JSON.parse(fs.readFileSync(new URL('../prisma/data/demo-product-images.json', import.meta.url), 'utf8')) as {
  assets: Record<string, DemoMediaAsset>;
  products: Record<string, { asset: string; illustrative: boolean }>;
};
const managedImages = new Set([
  '/showcase/laptops.png', '/showcase/smartphones.png', '/showcase/audio.png', '/demo/accessories.svg',
  ...Object.values(demoMedia.assets).map(asset => asset.localPath),
]);

/** Pure preparation: no database side effects and no claims of manufacturer verification. */
export function prepareDemoCatalog(manifest: CatalogManifest) {
  if (!manifest.products?.length || !manifest.brands?.length || !manifest.categories?.length) throw new Error('Empty catalog');
  const unique = (values: string[]) => values.every(Boolean) && new Set(values).size === values.length;
  if (!unique(manifest.products.map(p => p.id)) || !unique(manifest.brands.map(b => b.id)) || !unique(manifest.categories.map(c => c.id)) || !unique(manifest.products.flatMap(p => p.variants.map(v => v.sku)))) throw new Error('Duplicate or missing catalog identifiers');
  const brands = new Set(manifest.brands.map(b => b.id));
  const categories = new Map(manifest.categories.map(c => [c.id, c]));
  const products = manifest.products.map(p => {
    if (!brands.has(p.brandId) || categories.get(p.categoryId)?.kind !== p.kind || !['LAPTOP', 'PHONE', 'ACCESSORY'].includes(p.kind)) throw new Error(`Invalid relation: ${p.id}`);
    if (!p.variants.length || !Object.keys(asRecord(asRecord(p.specs).values)).length) throw new Error(`Missing variants/specs: ${p.id}`);
    const variants = p.variants.map(v => {
      if (!Number.isSafeInteger(v.price) || v.price <= 0 || !Number.isSafeInteger(v.stock) || v.stock < 0) throw new Error(`Invalid price/stock: ${v.sku}`);
      const values = { ...asRecord(asRecord(v.specOverrides).values) };
      for (const [code, value] of Object.entries(v.optionValues)) {
        if (code in asRecord(asRecord(p.specs).values)) values[code] = { ...asRecord(asRecord(asRecord(p.specs).values)[code]), state: 'KNOWN', value };
      }
      return { ...v, id: `demo-v-${hash(v.sku).slice(0, 24)}`, optionHash: computeVariantOptionHash(v.optionValues), specOverrides: { schemaVersion: 1, values } };
    });
    if (!unique(variants.map(v => v.optionHash))) throw new Error(`Duplicate variant options: ${p.id}`);
    const checksum = hash(p);
    const media = demoMedia.products[p.id];
    const asset = media && demoMedia.assets[media.asset];
    const illustration = asset?.localPath || (p.kind === 'LAPTOP' ? '/showcase/laptops.png' : p.kind === 'PHONE' ? '/showcase/smartphones.png'
      : /headphones|earbuds|airpods|buds\d|linkbuds/i.test(p.name) ? '/showcase/audio.png' : '/demo/accessories.svg');
    return { ...p, variants, inventoryMode: 'VARIANT' as const,
      images: [{ url: illustration, alt: asset ? `${media.illustrative ? 'Ảnh minh họa' : 'Ảnh'} ${p.name} — ${asset.sourceProduct}` : `Ảnh minh họa nhóm sản phẩm demo — ${p.name}`, sortOrder: 0 }],
      description: `${DEMO_NOTICE}\n\n${p.description || ''}`,
      editorialTags: { origin: 'SYNTHETIC_DEMO', manifestChecksum: checksum, sourceIds: [`demo-source-${p.id}`] },
    };
  });
  const sources = products.map(p => ({ id: `demo-source-${p.id}`, name: `Demo catalog: ${p.name}`, sourceType: 'CATALOG' as const,
    status: 'ACTIVE' as const, publisher: 'Local demo catalog', license: 'Internal demonstration only', version: manifest.version,
    checksum: p.editorialTags.manifestChecksum, isSynthetic: true, payload: { productId: p.id, notice: DEMO_NOTICE } }));
  return { brands: manifest.brands, categories: manifest.categories, products, sources };
}

interface CurrentDemoImages { id: string; image: string | null; images: unknown; editorialTags: unknown }

/** Only managed images are eligible; custom images and operational fields are preserved. */
export function planDemoImageUpdates(current: CurrentDemoImages[], products: ReturnType<typeof prepareDemoCatalog>['products']) {
  return current.flatMap(existing => {
    const product = products.find(p => p.id === existing.id);
    if (!product) return [];
    const tags = asRecord(existing.editorialTags);
    if (tags.origin !== 'SYNTHETIC_DEMO' || tags.manifestChecksum !== product.editorialTags.manifestChecksum) throw new Error(`Existing product is not this demo version: ${existing.id}`);
    const gallery = Array.isArray(existing.images) ? existing.images : [];
    if ((existing.image && !managedImages.has(existing.image)) || gallery.some(image => !managedImages.has(String(asRecord(image).url)))) return [];
    const image = product.images[0].url;
    if (existing.image === image && canonicalJsonStringify(existing.images) === canonicalJsonStringify(product.images)) return [];
    return [{ id: existing.id, image, images: product.images }];
  });
}

export async function importDemoCatalog(db: PrismaClient, manifest: CatalogManifest) {
  const data = prepareDemoCatalog(manifest);
  return db.$transaction(async tx => {
    const current = await tx.product.findMany({ select: { id: true, kind: true, isActive: true, image: true, images: true, editorialTags: true } });
    for (const p of data.products) {
      const existing = current.find(c => c.id === p.id);
      if (existing && (asRecord(existing.editorialTags).origin !== 'SYNTHETIC_DEMO' || asRecord(existing.editorialTags).manifestChecksum !== p.editorialTags.manifestChecksum)) throw new Error(`Existing product is not this demo version: ${p.id}`);
    }
    const imageUpdates = planDemoImageUpdates(current, data.products);
    for (const b of data.brands) await tx.brand.upsert({ where: { id: b.id }, update: {}, create: b });
    for (const c of data.categories) await tx.category.upsert({ where: { id: c.id }, update: {}, create: { ...c, specSchema: json(c.specSchema), warrantyConfig: json(c.warrantyConfig) } });
    let added = 0;
    for (const p of data.products) {
      // Reruns preserve edited prices, visibility and all operational stock balances.
      const existing = current.find(c => c.id === p.id);
      if (existing) {
        const update = imageUpdates.find(u => u.id === p.id);
        if (update) await tx.product.update({ where: { id: p.id }, data: { image: update.image, images: json(update.images), catalogVersion: { increment: 1 } } });
        continue;
      }
      await tx.dataSource.create({ data: { ...data.sources.find(s => s.payload.productId === p.id)!, payload: json(data.sources.find(s => s.payload.productId === p.id)!.payload) } });
      const segment: ProductSegment = p.segment === 'BUDGET' ? 'BUDGET' : p.segment === 'FLAGSHIP' ? 'FLAGSHIP' : ['PRO', 'PREMIUM'].includes(p.segment || '') ? 'PREMIUM' : 'MID_RANGE';
      await tx.product.create({ data: { id: p.id, name: p.name, description: p.description, price: BigInt(Math.min(...p.variants.map(v => v.price))),
        brandId: p.brandId, categoryId: p.categoryId, category: data.categories.find(c => c.id === p.categoryId)!.name,
        kind: p.kind, segment, inventoryMode: p.inventoryMode, image: p.images?.[0]?.url,
        images: json(p.images || []), specs: json(p.specs), editorialTags: json(p.editorialTags),
        warrantyConfig: json(p.warrantyConfig || data.categories.find(c => c.id === p.categoryId)!.warrantyConfig),
        weightGrams: Math.round(p.weight * 1000), lengthCm: Math.ceil(p.length), widthCm: Math.ceil(p.width), heightCm: Math.ceil(p.height),
      } });
      for (const v of p.variants) {
        await tx.productVariant.create({ data: { id: v.id, productId: p.id, sku: v.sku, title: v.title, price: BigInt(v.price),
          color: v.color, size: v.size, optionValues: json(v.optionValues), optionHash: v.optionHash, specOverrides: json(v.specOverrides) } });
        await applyInventoryMovement(tx, { operationKey: `demo-catalog-opening:${v.id}`, target: { productId: p.id, variantId: v.id }, kind: 'RECEIVE',
          deltaOnHand: v.stock, deltaReserved: 0, deltaQuarantined: 0, reason: 'Khởi tạo tồn kho demo công nghệ', referenceType: 'DEMO_CATALOG', referenceId: p.id });
      }
      added++;
    }
    const ready = await tx.product.count({ where: { id: { in: data.products.map(p => p.id) }, isActive: true, inventoryMode: 'VARIANT', variants: { some: { isActive: true } } } });
    if (ready !== data.products.length) throw new Error('Demo catalog incomplete; legacy visibility was not changed');
    const hidden = await tx.product.updateMany({ where: { kind: 'LEGACY', isActive: true }, data: { isActive: false } });
    return { productsAdded: added, productsReady: ready, legacyHidden: hidden.count, syntheticSources: data.sources.length };
  }, { timeout: 60_000, isolationLevel: 'Serializable' });
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(new URL('../prisma/data/electronics-catalog.json', import.meta.url), 'utf8')) as CatalogManifest;
  const prepared = prepareDemoCatalog(manifest);
  const db = new PrismaClient();
  try {
    const before = { capturedAt: new Date().toISOString(), products: await db.product.findMany({ select: { id: true, isActive: true, kind: true, image: true, images: true, editorialTags: true, catalogVersion: true, stock: true, onHandStock: true, reservedStock: true, quarantinedStock: true, stockVersion: true } }),
      orderCount: await db.order.count(), orderItemCount: await db.orderItem.count() };
    const imagesOnly = process.argv.includes('--images-only');
    const imageUpdates = planDemoImageUpdates(before.products, prepared.products);
    for (const product of prepared.products) {
      if (!fs.existsSync(path.join(process.cwd(), 'public', product.images[0].url))) throw new Error(`Missing local photo for ${product.id}`);
    }
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ dryRun: true, imagesOnly, imagesToRefresh: imageUpdates.length, products: prepared.products.length, variants: prepared.products.reduce((n, p) => n + p.variants.length, 0), legacyToHide: before.products.filter(p => p.kind === 'LEGACY' && p.isActive).map(p => p.id), notice: DEMO_NOTICE }, null, 2));
      return;
    }
    const backupDir = path.resolve('backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, `demo-catalog-before-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(before, null, 2), { mode: 0o600, flag: 'wx' });
    const result = imagesOnly ? await db.$transaction(async tx => {
      const current = await tx.product.findMany({ select: { id: true, image: true, images: true, editorialTags: true } });
      const updates = planDemoImageUpdates(current, prepared.products);
      for (const update of updates) await tx.product.update({ where: { id: update.id }, data: {
        image: update.image, images: json(update.images), catalogVersion: { increment: 1 },
      } });
      return { imagesOnly: true, imagesUpdated: updates.length };
    }, { timeout: 30_000, isolationLevel: 'Serializable' }) : await importDemoCatalog(db, manifest);
    console.log(JSON.stringify({ ...result, visibilityAndStockSnapshot: backup }, null, 2));
  } finally { await db.$disconnect(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : 'Demo import failed'); process.exitCode = 1; });
