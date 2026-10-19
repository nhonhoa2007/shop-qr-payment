# M1 Electronics Catalog Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo catalog điện tử có cấu trúc cho 2 laptop, 2 điện thoại và 6 phụ kiện bằng validated JSONB, provenance hợp nhất và checkout snapshot mà chỉ thêm ba Prisma models.

**Architecture:** `Brand`, `Category` và `DataSource` là ba model mới. Category chứa versioned spec/scoring/warranty schemas; Product/Variant chứa validated specs/options/images/config JSON. Filter production dùng allowlisted JSON paths với GIN/expression indexes; không tạo EAV/option/image/source child tables.

**Tech Stack:** Prisma/PostgreSQL JSONB+GIN, TypeScript strict, shared validators, Next.js 16, Redis cache, Node native tests.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- M1 bắt đầu sau M0; schema trước M1 có 22 models và phải kết thúc đúng 25.
- Chỉ tạo `Brand`, `Category`, `DataSource`.
- Cấm `AttributeDefinition`, `CategoryAttribute`, `ProductAttributeValue`, `ProductOptionDefinition`, `ProductOptionValue`, `ProductImage`, `ProductSource`.
- JSON catalog phải có shared schema, server validation, schemaVersion và canonical hash.
- `UNKNOWN` khác `UNSUPPORTED`; không invent legacy metadata.
- Effective price dùng active/sellable SKU BigInt; Product `VARIANT` bắt buộc exact variant.
- New active electronics SKU phải có packing data và warranty resolution trước checkout.
- UI chỉ tối thiểu; client không import server/Prisma.

## Review Focus

- Arbitrary/unknown JSON keys, wrong types, units hoặc stale schemaVersion bị từ chối.
- Category schema update không để product cũ silently publish với invalid specs.
- JSON filter allowlist chống path/operator injection và có index/query-plan evidence.
- Source mapping parent model không tự fan-out sang mọi variant/market.
- Cache invalidation phản ánh source/spec/variant changes ngay.

---

### Task 1: Add the schema budget gate and M1 registry

**Files:**
- Create: `scripts/check-prisma-model-budget.mjs`
- Create: `docs/architecture/prisma-model-registry.md`
- Modify: `package.json`
- Test: `tests/prisma-model-budget.test.ts`

**Interfaces:**
- Produces command `npm run schema:budget`.
- Budget config: expected M1 count `25`, target ceiling `37`, hard cap `40`, forbidden model names from spec.

- [ ] **Step 1: Write failing budget tests**

Assert current parser counts every `model` block, rejects count 41, rejects forbidden `ProductImage`, and reports added/removed names against registry.

- [ ] **Step 2: Run targeted test and confirm missing script failure**

- [ ] **Step 3: Implement parser, package script and registry**

Registry lists all 22 M0 models and planned transition; command accepts `--expected=25` for milestone gates without weakening hard cap.

- [ ] **Step 4: Run tests and current hard-cap check**

Expected parser tests PASS; current M0 count reports 22 and <=40.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-prisma-model-budget.mjs docs/architecture/prisma-model-registry.md package.json tests/prisma-model-budget.test.ts
git commit -m "test: enforce Prisma model budget"
```

---

### Task 2: Define JSON catalog contracts and pure validation

**Files:**
- Create: `src/shared/types/catalog.ts`
- Create: `src/shared/validations/catalog-json.ts`
- Create: `src/shared/utils/measurements.ts`
- Modify: `src/shared/types/index.ts`
- Test: `tests/catalog-json-validation.test.ts`

**Interfaces:**

```ts
export type ProductKind = 'LAPTOP' | 'PHONE' | 'ACCESSORY' | 'LEGACY';
export type ProductSegment = 'BUDGET' | 'MID_RANGE' | 'PREMIUM' | 'FLAGSHIP';
export type KnowledgeState = 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';
export type SourceStatus = 'DISCOVERED' | 'LICENSE_REVIEW' | 'MAPPING_REVIEW' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
export interface VersionedJson<T> { schemaVersion: number; value: T }
export function validateCategorySpecSchema(input: unknown): CategorySpecSchema;
export function validateProductSpecs(input: unknown, schema: CategorySpecSchema): ProductSpecs;
export function validateVariantOptions(input: unknown, schema: CategorySpecSchema): VariantOptions;
export function canonicalJsonHash(input: unknown): string;
```

- [ ] **Step 1: Write failing validation tests**

Assert required fields, types, enum values, canonical units, bounded image arrays/URLs, exactly-one KNOWN value, UNKNOWN/UNSUPPORTED semantics, duplicate option codes, unknown keys and stale version behavior.

- [ ] **Step 2: Verify module-missing failure**

- [ ] **Step 3: Implement pure validators and canonicalization**

No Prisma in shared/pure validator; stable sorted JSON is used for hash/option identity.

- [ ] **Step 4: Run targeted tests and commit**

```bash
git add src/shared/types/catalog.ts src/shared/validations/catalog-json.ts src/shared/utils/measurements.ts src/shared/types/index.ts tests/catalog-json-validation.test.ts
git commit -m "feat: validate compact catalog JSON"
```

---

### Task 3: Add Brand, Category and DataSource only

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_compact_electronics_catalog/migration.sql`
- Test: `tests/electronics-catalog-schema.test.ts`
- Modify: `docs/architecture/prisma-model-registry.md`

**Interfaces:**
- `Category`: parent, slug/kind, `specSchema`, `specSchemaVersion`, `scoringConfig`, `warrantyConfig`.
- `DataSource`: sourceType/status/provenance/mapping/payload/isSynthetic/reviewer/version/checksum.
- Product: brand/category/kind/segment/isLegacy/specs/images/editorialTags/warrantyConfig/catalogVersion.
- Variant: optionValues/optionHash/specOverrides/images/warrantyConfig/serializationRequired.

- [ ] **Step 1: Write failing schema contract tests**

Assert exactly three added models, required relations/unique/indexes, JSON fields and no forbidden model. Assert final schema count 25.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Add expand migration**

Keep legacy `category`, `image`, `color`, `size` fields readable during transition. Add PostgreSQL GIN indexes for specs/options/source payload and expression indexes only for documented hot filters.

- [ ] **Step 4: Backfill LEGACY category without inventing data**

Preserve Product/OrderItem IDs and null/UNKNOWN provenance.

- [ ] **Step 5: Validate and run budget gate**

```bash
npx prisma validate
npm run schema:budget -- --expected=25
```

Expected PASS, exact count 25.

- [ ] **Step 6: Commit**

```bash
git add prisma docs/architecture/prisma-model-registry.md tests/electronics-catalog-schema.test.ts
git commit -m "feat: add compact electronics catalog schema"
```

---

### Task 4: Implement DataSource lifecycle and catalog readiness

**Files:**
- Create: `src/server/modules/catalog/data-source.service.ts`
- Create: `src/server/modules/catalog/catalog-readiness.service.ts`
- Create: `src/server/modules/admin/catalog-sources.controller.ts`
- Create: `src/app/api/admin/data-sources/route.ts`
- Test: `tests/data-sources.test.ts`
- Test: `tests/catalog-readiness.test.ts`

**Interfaces:**

```ts
export interface DataSourceInput { sourceType: string; productId?: string; variantId?: string; publisher: string; url: string; market: string; licenseDecision: string; checkedAt: string; checksum: string; version: string; payload: unknown }
export interface CatalogReadiness { publishable: boolean; missing: string[]; warnings: string[] }
export async function transitionDataSource(input: SourceTransitionInput, db?: CatalogDb): Promise<DataSourceDto>;
export async function evaluateCatalogReadiness(productId: string, db?: CatalogDb): Promise<CatalogReadiness>;
```

- [ ] **Step 1: Write failing lifecycle/mapping tests**

Only valid transitions; ACTIVE requires reviewed license, checksum, exact market/product/variant mapping and validated payload; revoke excludes source; changed checksum returns review state; parent mapping does not fan out.

- [ ] **Step 2: Write failing readiness tests**

Laptop/phone require Brand/Category, valid current specs schema, active catalog source, packing, warranty resolution and sellable SKU. Legacy stays readable but not ready.

- [ ] **Step 3: Implement services/controller with knowledge/ADMIN gates**

`knowledge` STAFF prepares; ADMIN activates/publishes.

- [ ] **Step 4: Run tests and commit**

```bash
git add src/server/modules/catalog src/server/modules/admin/catalog-sources.controller.ts src/app/api/admin/data-sources tests/data-sources.test.ts tests/catalog-readiness.test.ts
git commit -m "feat: gate compact catalog provenance"
```

---

### Task 5: Build transactional catalog writes

**Files:**
- Create: `src/server/modules/catalog/catalog-write.service.ts`
- Modify: `src/server/modules/products/product.service.ts`
- Modify: `src/server/modules/products/products.controller.ts`
- Modify: minimal admin product view
- Test: `tests/electronics-product-write.test.ts`

**Interfaces:**

```ts
export interface UpsertElectronicsProductInput {
  product: ProductCoreInput;
  specs: unknown;
  images: unknown;
  warrantyConfig?: unknown;
  variants: Array<ProductVariantInput & { optionValues: unknown; specOverrides?: unknown; images?: unknown }>;
  sources: DataSourceInput[];
  expectedVersion?: number;
}
export async function upsertElectronicsProduct(input: UpsertElectronicsProductInput, actor: GuardUser, db?: PrismaLike): Promise<ProductDetailDto>;
```

- [ ] **Step 1: Write failing rollback/CAS tests**

Invalid JSON/source, duplicate optionHash/SKU, stale expectedVersion and unauthorized activation roll back all writes. Legacy color/size adapter produces canonical options but new writes use JSON only.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement one transactional orchestrator**

Reuse pure validators/readiness; never merge arbitrary partial JSON without validation.

- [ ] **Step 4: Add minimal structured form and run tests**

- [ ] **Step 5: Commit**

```bash
git add src/server/modules/catalog/catalog-write.service.ts src/server/modules/products src/client/views/admin tests/electronics-product-write.test.ts
git commit -m "feat: write compact electronics catalog safely"
```

---

### Task 6: Query JSON specs and effective SKU price

**Files:**
- Create: `src/shared/types/catalog-query.ts`
- Create: `src/server/modules/catalog/catalog-query.service.ts`
- Modify: `src/server/modules/catalog/catalog.service.ts`
- Modify: `src/app/page.tsx`
- Test: `tests/catalog-query.test.ts`
- Test: `tests/catalog-effective-price.test.ts`
- Create: `docs/verification/m1-json-query-plan.md`

**Interfaces:**

```ts
export interface CatalogQuery { search?: string; category?: string; brand?: string[]; segment?: ProductSegment[]; minPrice?: MoneyVnd; maxPrice?: MoneyVnd; inStock?: boolean; specs?: Record<string, string[]>; page: number; limit: number; sort: 'newest'|'price-asc'|'price-desc' }
export async function queryCatalog(query: CatalogQuery): Promise<PaginatedResponse<CatalogItemDto>>;
```

- [ ] **Step 1: Write failing normalization/security tests**

Reject unknown spec codes/path/operator and wrong units; clamp page/limit; no raw SQL interpolation from input.

- [ ] **Step 2: Write effective-price tests**

VARIANT uses minimum active sellable SKU; BASE/LEGACY uses product price; sort stays BigInt in DB.

- [ ] **Step 3: Implement allowlisted Prisma/parameterized JSON query**

- [ ] **Step 4: Capture EXPLAIN evidence for hot filters**

Verify GIN/expression index use on disposable representative data; add index only with evidence.

- [ ] **Step 5: Add revision-based cache invalidation, run tests and commit**

```bash
git add src/shared/types/catalog-query.ts src/server/modules/catalog src/app/page.tsx tests/catalog-query.test.ts tests/catalog-effective-price.test.ts docs/verification/m1-json-query-plan.md
git commit -m "feat: query validated electronics specs"
```

---

### Task 7: Expose comparison-ready detail DTO

**Files:**
- Create: `src/shared/types/product-detail.ts`
- Modify: catalog detail service/page/view
- Test: `tests/product-detail-dto.test.ts`

**Interfaces:**

```ts
export interface ProductDetailDto {
  id: string;
  brand: BrandDto | null;
  category: CategoryDto;
  segment: ProductSegment | null;
  specs: ProductSpecsDto;
  variants: ProductVariantDto[];
  images: CatalogImageDto[];
  sources: EvidenceRef[];
  effectivePrice: MoneySnapshot;
  legacy: boolean;
}
```

- [ ] **Step 1: Write failing DTO tests**

UNKNOWN/UNSUPPORTED distinct; JSON is parsed to typed DTO, never leaked raw; inactive/revoked sources excluded; exact variant option/spec overrides/images; BigInt serialized; legacy data not invented.

- [ ] **Step 2: Implement mapper/cache and minimal rendering**

Cache key contains product/category-schema/source revision.

- [ ] **Step 3: Run tests/build and commit**

```bash
git add src/shared/types/product-detail.ts src/server/modules/catalog src/app/products src/client/views tests/product-detail-dto.test.ts
git commit -m "feat: expose compact electronics product details"
```

---

### Task 8: Seed the 10-product vertical slice

**Files:**
- Create: `prisma/seed-electronics-catalog.ts`
- Modify: `prisma/seed-demo-data.ts`
- Modify: `package.json`
- Create: `docs/data/electronics-vertical-slice-sources.md`
- Test: `tests/electronics-seed.test.ts`

**Interfaces:**
- `npm run seed:electronics` is idempotent by stable slug/SKU/source checksum and marks synthetic data.

- [ ] **Step 1: Write failing fixture/readiness tests**

Exactly 2 laptops, 2 phones, 6 accessories; valid JSON schemas/specs/options; no duplicate optionHash/SKU/source; source origin/license transparent.

- [ ] **Step 2: Implement fixtures/upserts and run twice on disposable DB**

Expected stable counts and no protected external corpus/image copies.

- [ ] **Step 3: Run readiness/query/detail suites and commit**

```bash
git add prisma/seed-electronics-catalog.ts prisma/seed-demo-data.ts package.json docs/data/electronics-vertical-slice-sources.md tests/electronics-seed.test.ts
git commit -m "feat: seed compact electronics vertical slice"
```

---

### Task 9: Snapshot electronics terms on OrderItem

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_order_item_electronics_snapshots/migration.sql`
- Modify: checkout/order/shipping services and DTO serializer
- Test: `tests/order-item-snapshot.test.ts`
- Test: `tests/checkout.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- OrderItem fields/snapshots: productName, SKU, variantOptions JSON, unitPrice BigInt, warrantySnapshot JSON, packingLineSnapshot JSON, schema/source revision.

- [ ] **Step 1: Write failing immutable snapshot tests**

Create order then mutate catalog/schema/source; historical DTO retains original terms. Client snapshot input ignored.

- [ ] **Step 2: Add fields/backfill known legacy values only**

Unknown historical warranty/packing remains explicit UNKNOWN/null.

- [ ] **Step 3: Run checkout/integration/budget gates and commit**

Schema adds no model; expected count remains 25.

```bash
git add prisma src/server/modules/orders src/server/modules/shipping tests/order-item-snapshot.test.ts tests/checkout.test.ts tests/integration/money-shipping.test.ts
git commit -m "feat: snapshot compact catalog terms on orders"
```

---

### Task 10: Verify M1 and document migration

**Files:**
- Create: `docs/verification/2026-10-17-m1-catalog.md`
- Create: `docs/data/legacy-product-normalization.md`
- Modify: `docs/architecture/prisma-model-registry.md`

**Interfaces:**
- Produces the M1 verification evidence, legacy normalization procedure and locked 25-model registry consumed by M2/M5.

- [ ] **Step 1: Run targeted/schema/query/seed tests**

- [ ] **Step 2: Run full gates**

```bash
npm run verify
npx prisma validate
npm run schema:budget -- --expected=25
```

- [ ] **Step 3: Rehearse migration/rollback and seed twice**

Assert IDs/history preserved and no invented data.

- [ ] **Step 4: Record actual output and commit**

```bash
git add docs/verification/2026-10-17-m1-catalog.md docs/data/legacy-product-normalization.md docs/architecture/prisma-model-registry.md
git commit -m "docs: verify compact M1 catalog"
```

## M1 Exit Criteria

- [ ] Exactly 25 Prisma models; only Brand/Category/DataSource were added.
- [ ] No forbidden EAV/option/image/source child model.
- [ ] JSON specs/options/images/configs validate, version and round-trip.
- [ ] Filters use allowlisted indexed JSON paths and effective SKU BigInt price.
- [ ] 10-product vertical slice passes readiness; legacy remains honest/readable.
- [ ] OrderItem commercial/warranty/packing snapshot is immutable.
- [ ] Full gate, migration rehearsal and `schema:budget` pass.
