# M1 Electronics Catalog Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo catalog điện tử có cấu trúc cho 2 laptop, 2 điện thoại và 6 phụ kiện, với provenance, typed attributes, option/SKU thực tế, lọc/so sánh cơ bản và checkout tương thích.

**Architecture:** Mô hình lai chuẩn hóa Brand/Category/AttributeDefinition và typed values, giữ Product/ProductVariant làm aggregate bán hàng. Catalog read model xuất DTO shared với MoneyVnd; legacy products tiếp tục đọc được nhưng bị đánh dấu và không được giả thông số/provenance.

**Tech Stack:** Prisma/PostgreSQL, TypeScript strict, Next.js 16 App Router/Server Components, Redis cache, Node native tests.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- M1 chỉ bắt đầu khi M0 exit criteria pass.
- Không redesign UI; chỉ form/table/filter/detail tối thiểu.
- Không dùng JSON tự do làm nguồn duy nhất cho thuộc tính cần validate/filter/compare.
- `UNKNOWN` khác `UNSUPPORTED`; null legacy không được tự suy diễn.
- Product có `VARIANT` inventory mode phải mua bằng SKU/variant cụ thể.
- Price/sort/filter dùng effective active SKU price; DTO money là decimal string.
- Nguồn catalog phải có publisher/URL/market/license status/checkedAt/version.
- New active electronics SKU phải có packing data trước khi checkout.
- Client không import Prisma/server; DTO nằm ở `@shared`.

## Review Focus

- Hai attribute cùng label nhưng khác code/unit không bị so sánh hoặc filter nhầm.
- Category move không để lại value không hợp lệ mà vẫn publish sản phẩm.
- Effective price sort đúng với sản phẩm nhiều SKU, inactive/zero-stock variants và legacy base products.
- Review/source mapping vào parent model không tự lan sang mọi variant.
- Cache catalog/detail bị invalidate sau product/source/attribute update.

---

### Task 1: Define electronics catalog enums and schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_electronics_catalog/migration.sql`
- Create: `src/shared/types/catalog.ts`
- Modify: `src/shared/types/index.ts`
- Test: `tests/electronics-catalog-schema.test.ts`

**Interfaces:**
- Produces:

```ts
export type ProductKind = 'LAPTOP' | 'PHONE' | 'ACCESSORY' | 'LEGACY';
export type ProductSegment = 'BUDGET' | 'MID_RANGE' | 'PREMIUM' | 'FLAGSHIP';
export type AttributeValueType = 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'ENUM';
export type SourceStatus = 'DISCOVERED' | 'LICENSE_REVIEW' | 'MAPPING_REVIEW' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
export type KnowledgeState = 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';
```

Schema adds Brand, Category(parent), AttributeDefinition, CategoryAttribute, ProductAttributeValue, ProductOptionDefinition/Value, ProductImage, ProductSource; Product gets brandId/categoryId/kind/segment/legacy flag, ProductVariant gets stable option values and serializationRequired.

- [ ] **Step 1: Write failing schema contract test**

Parse schema text or Prisma DMMF and assert required models/enums/unique constraints:
- Brand.slug unique;
- Category.slug unique and parent relation;
- AttributeDefinition.code unique;
- one ProductAttributeValue per product/variant/attribute scope;
- ProductSource has status/checkedAt/checksum;
- ProductVariant.sku remains unique.

- [ ] **Step 2: Verify test fails**

Run targeted test; expected missing models.

- [ ] **Step 3: Add schema and migration**

Use typed nullable columns on ProductAttributeValue (`textValue`, `integerValue`, `decimalValue`, `booleanValue`, `enumValue`, `knowledgeState`) with application invariant exactly one value for `KNOWN`, no value for UNKNOWN/UNSUPPORTED. Decimal attribute is measurement, not VND money.

- [ ] **Step 4: Backfill legacy records**

Create LEGACY root/category and map existing category strings without inventing brand/spec/source. Preserve current Product IDs and OrderItem relations.

- [ ] **Step 5: Validate**

Run: `npx prisma validate`

Run targeted schema test; expected PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma src/shared/types/catalog.ts src/shared/types/index.ts tests/electronics-catalog-schema.test.ts
git commit -m "feat: model structured electronics catalog"
```

---

### Task 2: Implement attribute schema/value validation

**Files:**
- Create: `src/server/modules/catalog/attribute-validation.service.ts`
- Create: `src/shared/utils/measurements.ts`
- Test: `tests/catalog-attributes.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AttributeInput { attributeCode: string; state: KnowledgeState; value?: unknown }
export interface ValidatedAttributeValue { definitionId: string; state: KnowledgeState; typedValue: string | number | boolean | null; normalizedUnit: string | null }
export function validateAttributesForCategory(input: AttributeInput[], schema: CategoryAttributeSchema[]): AttributeValidationResult;
export function normalizeMeasurement(value: number, fromUnit: string, canonicalUnit: string): number;
```

- [ ] **Step 1: Write failing tests**

Assert required attribute missing fails; UNKNOWN passes without value; UNSUPPORTED passes only when category allows it; INTEGER rejects decimal; ENUM rejects unknown option; cm/mm and GB/TB normalize correctly; duplicate code fails; irrelevant category attribute fails.

- [ ] **Step 2: Verify fail**

Run targeted test; expected module missing.

- [ ] **Step 3: Implement minimal pure validator**

Do not query Prisma inside pure function; controller/service loads schema then invokes it.

- [ ] **Step 4: Verify pass and commit**

```bash
git add src/server/modules/catalog/attribute-validation.service.ts src/shared/utils/measurements.ts tests/catalog-attributes.test.ts
git commit -m "feat: validate typed electronics attributes"
```

---

### Task 3: Generalize product variants from color/size to option values

**Files:**
- Create: `src/shared/types/product-options.ts`
- Create: `src/server/modules/products/product-option.service.ts`
- Modify: `src/shared/types/index.ts:145-158,476-509`
- Modify: `src/server/modules/products/product.service.ts`
- Modify: `src/client/views/admin/AdminProductsView.tsx`
- Modify: `src/client/views/ProductDetailView.tsx`
- Keep compatibility shim: `src/client/components/product/ProductDetailView.tsx`
- Modify: `src/client/stores/cart-store.ts`
- Test: `tests/product-options.test.ts`
- Test: `tests/product-variants-ui.test.ts`
- Test: `tests/cart-store.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ProductOptionDto { code: string; label: string; value: string }
export interface ProductVariantDto { id: string; sku: string; title: string; options: ProductOptionDto[]; price: MoneyVnd; stock: number; isActive: boolean }
export function buildVariantTitle(options: ProductOptionDto[]): string;
export function variantKey(options: ProductOptionDto[]): string;
```

- [ ] **Step 1: Write failing pure option tests**

Assert option order deterministic by definition sort order, duplicate combination rejected, title for RAM/Storage/Color stable, color/size legacy migrates to options, cart identity includes variantId not title.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement option service and DTO migration**

Keep legacy color/size read adapter during migration; all new writes use options. Do not delete legacy columns until M7 cleanup after data verification.

- [ ] **Step 4: Update minimal admin/detail selectors**

Admin edits option definitions/values and explicit SKU combinations; do not generate invalid Cartesian products implicitly. Detail page shows option selectors and exact SKU availability.

- [ ] **Step 5: Run targeted tests**

Expected PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared src/server/modules/products src/client/views src/client/stores tests/product-options.test.ts tests/product-variants-ui.test.ts tests/cart-store.test.ts
git commit -m "feat: support electronics SKU options"
```

---

### Task 4: Add product provenance and publish readiness

**Files:**
- Create: `src/server/modules/catalog/product-source.service.ts`
- Create: `src/server/modules/catalog/catalog-readiness.service.ts`
- Create: `src/server/modules/admin/catalog-sources.controller.ts`
- Create: `src/app/api/admin/data-sources/route.ts`
- Modify: `src/server/modules/products/product.service.ts`
- Test: `tests/product-sources.test.ts`
- Test: `tests/catalog-readiness.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ProductSourceInput { productId: string; variantId?: string | null; publisher: string; url: string; market: string; licenseStatus: SourceStatus; checkedAt: string; checksum: string; version: string }
export interface CatalogReadiness { publishable: boolean; missing: string[]; warnings: string[] }
export async function evaluateCatalogReadiness(productId: string, db?: CatalogDb): Promise<CatalogReadiness>;
```

- [ ] **Step 1: Write failing source state tests**

Assert only allowed state transitions; ACTIVE requires URL/publisher/license decision/checksum/reviewer; REVOKED cannot participate; changing checksum requires review; variant mapping stays scoped.

- [ ] **Step 2: Write failing readiness tests**

New laptop/phone requires brand/category, category-required attributes, active source, packing data, at least one sellable SKU, warranty policy reference. Legacy product may remain readable but readiness false until normalized.

- [ ] **Step 3: Verify failures, implement services/controllers**

Use `knowledge` permission for review workflow; ACTIVE transition/publish remains ADMIN initially per spec.

- [ ] **Step 4: Run tests and commit**

```bash
git add src/server/modules/catalog src/server/modules/admin/catalog-sources.controller.ts src/app/api/admin/data-sources tests/product-sources.test.ts tests/catalog-readiness.test.ts
git commit -m "feat: gate catalog publication on verified sources"
```

---

### Task 5: Build catalog write service around one transaction

**Files:**
- Create: `src/server/modules/catalog/catalog-write.service.ts`
- Modify: `src/server/modules/products/products.controller.ts`
- Modify: `src/server/modules/products/product.service.ts`
- Test: `tests/electronics-product-write.test.ts`
- Test: `tests/products-operator-guard.test.ts`

**Interfaces:**
- Produces:

```ts
export interface UpsertElectronicsProductInput {
  product: ProductCoreInput;
  variants: ProductVariantInput[];
  attributes: AttributeInput[];
  images: ProductImageInput[];
  sources: ProductSourceInput[];
  expectedVersion?: number;
}
export async function upsertElectronicsProduct(input: UpsertElectronicsProductInput, actor: GuardUser, db?: PrismaLike): Promise<ProductDetailDto>;
```

- [ ] **Step 1: Write failing transaction tests**

Assert invalid attribute rolls back Product/Variant/Source writes; duplicate SKU/option combination rolls back; stale expectedVersion returns conflict; source cannot be activated by STAFF without ADMIN publish authorization.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement orchestrator and keep route facade thin**

Reuse Task 2/3/4 services. General product PUT delegates legacy or electronics path explicitly; no mixed partial mutation.

- [ ] **Step 4: Run tests and commit**

```bash
git add src/server/modules/catalog/catalog-write.service.ts src/server/modules/products tests/electronics-product-write.test.ts tests/products-operator-guard.test.ts
git commit -m "feat: write electronics products transactionally"
```

---

### Task 6: Build electronics catalog read model, filters and effective-price sorting

**Files:**
- Create: `src/shared/types/catalog-query.ts`
- Create: `src/server/modules/catalog/catalog-query.service.ts`
- Modify: `src/server/modules/catalog/catalog.service.ts`
- Modify: `src/app/page.tsx`
- Test: `tests/catalog-query.test.ts`
- Test: `tests/catalog-effective-price.test.ts`

**Interfaces:**
- Produces:

```ts
export interface CatalogQuery { search?: string; category?: string; brand?: string[]; segment?: ProductSegment[]; minPrice?: MoneyVnd; maxPrice?: MoneyVnd; inStock?: boolean; attributes?: Record<string, string[]>; page: number; limit: number; sort: 'newest' | 'price-asc' | 'price-desc' }
export interface CatalogItemDto { id: string; name: string; brand: string | null; category: string; segment: ProductSegment | null; effectivePrice: MoneySnapshot; image: string | null; available: boolean; legacy: boolean }
export async function queryCatalog(query: CatalogQuery): Promise<PaginatedResponse<CatalogItemDto>>;
```

- [ ] **Step 1: Write failing query normalization tests**

Reject invalid/unknown filter codes rather than interpolate; clamp page/limit; normalize units; empty arrays ignored; search escapes wildcard semantics as intended.

- [ ] **Step 2: Write failing effective-price tests**

For VARIANT product, effective price is minimum active **sellable** SKU price; inactive/zero-stock handling follows `inStock` filter; BASE/LEGACY uses product price. Price sort is numeric BigInt in DB, not string/JS number.

- [ ] **Step 3: Verify fail, implement query service**

Use Prisma relational filters for typed attributes; no client-side full catalog filtering.

- [ ] **Step 4: Invalidate cache by catalog version**

Product/source/attribute write increments catalog revision or deletes deterministic cache keys; tests assert updated query/detail is visible.

- [ ] **Step 5: Run tests and commit**

```bash
git add src/shared/types/catalog-query.ts src/server/modules/catalog src/app/page.tsx tests/catalog-query.test.ts tests/catalog-effective-price.test.ts
git commit -m "feat: query electronics catalog by structured filters"
```

---

### Task 7: Expose structured product detail and comparison-ready data

**Files:**
- Create: `src/shared/types/product-detail.ts`
- Modify: `src/server/modules/catalog/catalog.service.ts:134-189`
- Modify: `src/app/products/[id]/page.tsx`
- Modify: `src/client/views/ProductDetailView.tsx`
- Keep compatibility shim: `src/client/components/product/ProductDetailView.tsx`
- Test: `tests/product-detail-dto.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ProductDetailDto {
  id: string;
  name: string;
  brand: BrandDto | null;
  category: CategoryDto;
  segment: ProductSegment | null;
  attributes: Array<{ code: string; label: string; state: KnowledgeState; value: string | number | boolean | null; unit: string | null; comparable: boolean }>;
  variants: ProductVariantDto[];
  images: ProductImageDto[];
  sources: EvidenceRef[];
  effectivePrice: MoneySnapshot;
  legacy: boolean;
}
```

- [ ] **Step 1: Write failing DTO tests**

Assert UNKNOWN and UNSUPPORTED serialize distinctly, inactive sources excluded from public DTO, variant options and images scoped correctly, BigInt price serialized, legacy details do not invent brand/spec.

- [ ] **Step 2: Verify fail, implement mapper and cached detail**

Cache key includes catalog/source revision.

- [ ] **Step 3: Update minimal detail rendering**

Render grouped specifications and source “checked at” metadata; preserve add-to-cart/wishlist/reviews behavior.

- [ ] **Step 4: Run tests/build and commit**

```bash
git add src/shared/types/product-detail.ts src/server/modules/catalog/catalog.service.ts src/app/products src/client/views/ProductDetailView.tsx tests/product-detail-dto.test.ts
git commit -m "feat: expose sourced electronics product details"
```

---

### Task 8: Seed the 10-model vertical slice with explicit synthetic/source labels

**Files:**
- Create: `prisma/seed-electronics-catalog.ts`
- Modify: `prisma/seed-demo-data.ts`
- Modify: `package.json`
- Create: `docs/data/electronics-vertical-slice-sources.md`
- Test: `tests/electronics-seed.test.ts`

**Interfaces:**
- Produces script `npm run seed:electronics` that is idempotent by stable brand/category/product/source keys and labels all synthetic data.

- [ ] **Step 1: Write failing seed fixture validation test**

Assert exactly 2 LAPTOP, 2 PHONE, 6 ACCESSORY models; each non-legacy model passes readiness; no duplicate SKU/source checksum; source records identify synthetic vs real and do not claim unverified license.

- [ ] **Step 2: Verify fail, author fixtures and idempotent upserts**

Do not copy protected external reviews/images. Use local/demo-safe assets and manufacturer facts only when source/permission record exists; otherwise mark UNKNOWN.

- [ ] **Step 3: Run seed twice on disposable DB**

Expected identical counts and no duplicate variants/sources.

- [ ] **Step 4: Run readiness/catalog/detail tests**

Expected PASS for all 10 models.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-electronics-catalog.ts prisma/seed-demo-data.ts package.json docs/data/electronics-vertical-slice-sources.md tests/electronics-seed.test.ts
git commit -m "feat: seed electronics catalog vertical slice"
```

---

### Task 9: Preserve checkout/order snapshots with electronics SKU data

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_order_item_snapshots/migration.sql`
- Modify: `src/shared/validations/index.ts`
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/shipping/shipping-quote.service.ts`
- Modify: order DTO serializers
- Test: `tests/order-item-snapshot.test.ts`
- Test: `tests/checkout.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- OrderItem snapshot fields: productName, sku, variantOptions JSON, unitPrice BigInt, warranty policy reference/terms snapshot, packing line snapshot.

- [ ] **Step 1: Write failing snapshot tests**

Create order, mutate/deactivate/delete-safe catalog data, then assert historical order DTO still shows original name/SKU/options/price/warranty/packing. Client-sent snapshot fields must be ignored.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Add snapshot fields and populate only from server validation result**

Backfill legacy OrderItems with known product name/variant title and explicit unknown policy/packing metadata; do not invent terms.

- [ ] **Step 4: Run checkout/integration tests**

Expected PASS; M0 money and packing invariants remain intact.

- [ ] **Step 5: Commit**

```bash
git add prisma src/shared/validations/index.ts src/server/modules/orders src/server/modules/shipping tests/order-item-snapshot.test.ts tests/checkout.test.ts tests/integration/money-shipping.test.ts
git commit -m "feat: snapshot electronics SKU terms on orders"
```

---

### Task 10: Run M1 full gate and document legacy migration

**Files:**
- Create: `docs/verification/2026-10-17-m1-catalog.md`
- Create: `docs/data/legacy-product-normalization.md`

**Interfaces:**
- Produces verified list of legacy products, missing fields, readiness state and normalization procedure.

- [ ] **Step 1: Run schema/seed/catalog targeted suites**

Expected PASS.

- [ ] **Step 2: Run full verification**

```bash
npm run verify
```

Expected PASS.

- [ ] **Step 3: Rehearse migration and seed twice on disposable DB**

Assert historical order/product IDs preserved; 10 vertical-slice models ready; legacy products remain readable and not silently published as electronics.

- [ ] **Step 4: Record evidence and commit**

```bash
git add docs/verification/2026-10-17-m1-catalog.md docs/data/legacy-product-normalization.md
git commit -m "docs: verify electronics catalog migration"
```

## M1 Exit Criteria

- [ ] 2 laptop, 2 phone, 6 accessory models pass readiness.
- [ ] Brand/category/typed attributes/options/images/sources round-trip through DB and DTO.
- [ ] Catalog filter/sort uses typed data and effective SKU price.
- [ ] Legacy data remains accessible without invented metadata.
- [ ] Checkout stores immutable SKU/money/warranty/packing snapshots.
- [ ] `npm run verify` and migration rehearsal pass.
