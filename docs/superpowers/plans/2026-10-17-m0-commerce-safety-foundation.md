# M0 Commerce Safety Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Củng cố tiền, thanh toán ví, kho biến thể và vận chuyển để catalog điện tử giá trị cao có thể phát triển trên nền bất biến an toàn.

**Architecture:** M0 không thêm feature bán hàng mới. Nó chuẩn hóa MoneyVnd/BigInt, đưa payment transition về CAS, tách inventory mode khỏi số variant active, cấm absolute stock overwrite, và tạo packing snapshot dùng chung cho quote/fulfillment; mọi thay đổi được khóa bằng unit + PostgreSQL integration tests.

**Tech Stack:** TypeScript, Prisma 6/PostgreSQL, Next.js 16 route/controller patterns, Node native test runner, GHN adapter.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- Không redesign UI và không thêm domain AI trong M0.
- User, wallet, orders và lịch sử tài chính phải được bảo tồn.
- JSON money dùng decimal string `MoneyVnd`; database dùng `BigInt`; không dùng JS `number` trong domain amount sau migration.
- Checkout tiếp tục lấy giá từ server; mismatch quote trả `409`.
- Product có variant không được bán qua base stock khi không còn active variant.
- Reservation/release/payment transition phải atomic và idempotent.
- Quote và fulfillment phải dùng cùng packing snapshot.
- Manual high-value fulfillment không được bypass nếu thiếu audit evidence.
- Mỗi thay đổi Next.js phải đọc guide tương ứng trong `node_modules/next/dist/docs/` trước khi sửa.

## Review Focus

- Hai wallet payment đồng thời hoặc wallet payment race expiry chỉ debit một lần và chỉ một transition thắng.
- Giỏ có tổng >2.147.483.647 VND round-trip DB/API chính xác, không overflow hoặc serialization crash.
- Product `VARIANT` với mọi SKU inactive bị từ chối thay vì trừ `Product.stock`.
- Admin stock edit stale không ghi đè reservation vừa tạo.
- Quote và shipment sử dụng đúng cùng weight/dimensions/insurance snapshot; high-value unsupported route chuyển REVIEW.

---

### Task 1: Ghi nhận baseline và khóa regression hiện tại

**Files:**
- Create: `docs/verification/2026-10-17-m0-baseline.md`
- Modify: `package.json`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- Consumes: scripts hiện tại `test`, `test:integration`, `lint`, `arch:check`, `build`.
- Produces: script `verify` chạy unit → integration → lint → architecture → build; baseline report có command, exit code và known failures trước M0.

- [ ] **Step 1: Đọc Next.js guides có liên quan và ghi path/version vào baseline report**

Đọc tối thiểu route handlers/server components guides trong `node_modules/next/dist/docs/01-app/` trước khi chạm route/page ở các task sau.

- [ ] **Step 2: Chạy baseline commands riêng biệt và ghi output trung thực**

Run lần lượt:

```bash
npm run test
```

```bash
npm run test:integration
```

```bash
npm run lint
```

```bash
npm run arch:check
```

```bash
npm run build
```

Expected: report ghi PASS/FAIL thật; không sửa unrelated pre-existing failures trong task này.

- [ ] **Step 3: Thêm script tổng hợp**

Trong `package.json` tạo:

```json
"verify": "npm run test && npm run test:integration && npm run lint && npm run arch:check && npm run build"
```

- [ ] **Step 4: Chạy parser/package validation**

Run: `npm pkg get scripts.verify`

Expected: in đúng command chain.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/verification/2026-10-17-m0-baseline.md
git commit -m "chore: record M0 verification baseline"
```

---

### Task 2: MoneyVnd boundary và BigInt schema migration

**Files:**
- Create: `src/shared/types/money.ts`
- Create: `src/shared/utils/money.ts`
- Create: `src/server/modules/money/money-serialization.ts`
- Create: `prisma/migrations/<timestamp>_money_bigint/migration.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/shared/types/index.ts`
- Test: `tests/money.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- Produces:

```ts
export type MoneyVnd = string;
export interface MoneySnapshot { amount: MoneyVnd; currency: 'VND'; revision: string }
export function parseMoneyVnd(value: unknown, field: string): bigint;
export function serializeMoneyVnd(value: bigint): MoneyVnd;
export function addMoney(...values: bigint[]): bigint;
export function allocateProportionally(total: bigint, weights: bigint[]): bigint[];
```

- Migration converts every amount/price/balance/fee/discount field named in spec to PostgreSQL `BIGINT` using explicit `USING column::bigint`; no silent resets.

- [ ] **Step 1: Write failing pure money tests**

Add assertions:

```ts
assert.equal(parseMoneyVnd('2147483648', 'amount'), 2147483648n);
assert.equal(serializeMoneyVnd(9007199254740992n), '9007199254740992');
assert.deepEqual(allocateProportionally(10n, [1n, 1n, 1n]), [4n, 3n, 3n]);
assert.equal(allocateProportionally(10n, [1n, 1n, 1n]).reduce((a, b) => a + b, 0n), 10n);
assert.throws(() => parseMoneyVnd('-1', 'amount'));
assert.throws(() => parseMoneyVnd('1.5', 'amount'));
```

Tie-break remainder by stable input index.

- [ ] **Step 2: Verify tests fail**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/money.test.ts`

Expected: FAIL because money module does not exist.

- [ ] **Step 3: Implement shared money types/utilities**

Use decimal integer strings only at JSON/form boundary. Reject signs other than optional `+`, decimals, exponent notation and values above explicit business max `9_000_000_000_000_000` VND.

- [ ] **Step 4: Verify pure tests pass**

Run same command; expected PASS.

- [ ] **Step 5: Audit and change all Prisma money columns in one schema migration**

Cover at least Product.price, ProductVariant.price, Order subtotal/discountAmount/shippingFee/totalAmount, OrderItem.price, Coupon monetary values, Transaction.amount, BankTransfer.amount, RefundCase.amount, Shipment shippingFee/codAmount, UserWallet.balance, WalletTransaction.amount. Document every converted column as SQL comments.

- [ ] **Step 6: Add integration round-trip test above Int32**

Create product/order/wallet fixture with `3_000_000_000n`, retrieve it, serialize via helper, and assert exact string. Cleanup in `finally`.

- [ ] **Step 7: Validate schema and migration against disposable DB**

Run: `npx prisma validate`

Expected: schema valid.

Run migration on a disposable clone only; expected row counts and SUM(amount) before/after match exactly. Append evidence to M0 baseline report.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/shared/types/money.ts src/shared/utils/money.ts src/server/modules/money tests/money.test.ts tests/integration/money-shipping.test.ts docs/verification/2026-10-17-m0-baseline.md
git commit -m "refactor: migrate commerce amounts to BigInt"
```

---

### Task 3: Propagate MoneyVnd through server and shared DTO boundaries

**Files:**
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/validations/index.ts`
- Modify: `src/shared/utils/checkout.ts`
- Modify: `src/server/modules/catalog/catalog.service.ts`
- Modify: `src/server/modules/products/product.service.ts`
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/payment/casso-webhook.controller.ts`
- Modify: `src/server/modules/admin/reconciliation.service.ts`
- Modify: `src/server/modules/wallet/wallet.service.ts`
- Modify: `src/server/modules/wallet/wallet-topup.service.ts`
- Modify: `src/server/modules/shipping/shipping-quote.service.ts`
- Modify: impacted client DTO consumers under `src/client/`
- Test: `tests/money-boundaries.test.ts`
- Test: existing checkout/wallet/payment/catalog tests

**Interfaces:**
- Consumes: Task 2 money helpers.
- Produces: all public DTO amount fields typed `MoneyVnd`; client performs display formatting from decimal string; internal arithmetic remains bigint.

- [ ] **Step 1: Write failing contract tests**

Assert serialized Product/Order/Wallet/BankTransfer DTOs contain strings and that quote comparison parses client strings then compares bigint. Assert number input above safe integer is rejected rather than coerced.

- [ ] **Step 2: Verify failures**

Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/money-boundaries.test.ts`

Expected: FAIL against number-based DTOs.

- [ ] **Step 3: Update shared DTO signatures and central serializers**

Do not scatter `String(value)` through controllers. Provide focused serializers for product/order/wallet/admin financial DTOs in their owning module or `money-serialization.ts`.

- [ ] **Step 4: Convert server calculations and comparisons to bigint**

Coupon percentage calculation must specify integer rounding rule; use floor for percentage discount then cap by maxDiscount. Preserve invariant `subtotal + shipping - discount = total` exactly.

- [ ] **Step 5: Update minimal client consumers**

Formatting utilities accept `MoneyVnd`; cart persistence migration either converts safe legacy numbers to decimal strings or clears only incompatible cart entries with a user-visible message. Do not use `Number()` for domain arithmetic.

- [ ] **Step 6: Run impacted suites**

Run unit files for checkout, coupon, wallet, wallet-topup, payment parser, reconciliation, products, admin analytics and cart store.

Expected: PASS.

- [ ] **Step 7: Run TypeScript/build gate**

Run: `npm run build`

Expected: PASS and no `Do not know how to serialize a BigInt` runtime/build paths.

- [ ] **Step 8: Commit**

```bash
git add src tests/money-boundaries.test.ts
git commit -m "refactor: serialize money safely across commerce DTOs"
```

---

### Task 4: Make wallet payment an order CAS transition

**Files:**
- Modify: `src/server/modules/wallet/wallet.service.ts:179-283`
- Modify: `src/server/modules/wallet/wallet-pay.controller.ts`
- Test: `tests/wallet.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- Produces:

```ts
export async function payOrderWithWallet(
  tx: TransactionClient,
  userId: string,
  orderId: string,
  now?: Date,
): Promise<WalletOperationResult>;
```

Order claim is `updateMany({id,userId,paymentStatus:'UNPAID',status:'PENDING',expiresAt:{gt:now}})` and must occur in the same transaction as balance debit and ledger records.

- [ ] **Step 1: Write failing unit tests for CAS losing paths**

Mock order CAS `count: 0`; assert no wallet transaction/Transaction is created and service returns failure. Assert `now === expiresAt` is expired.

- [ ] **Step 2: Add failing PostgreSQL concurrency tests**

Create wallet balance sufficient for one order payment. Run two `db.$transaction` calls concurrently. Assert exactly one success, one PURCHASE_PAYMENT, one Transaction, balance decremented once, order PAID. Add payment-vs-expiry race asserting exactly one terminal outcome and correct stock/balance.

- [ ] **Step 3: Verify targeted failures**

Run unit wallet test then integration name pattern; expected FAIL because current code uses `order.update` after debit.

- [ ] **Step 4: Implement CAS order claim and transaction semantics**

Claim order before irreversible debit inside the transaction. If balance CAS fails, throw/return in a way that causes transaction rollback of order claim. Return new balance from the updated row or re-read inside tx; do not subtract from stale wallet object.

- [ ] **Step 5: Verify unit and integration tests pass**

Run targeted commands; expected PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/wallet tests/wallet.test.ts tests/integration/money-shipping.test.ts
git commit -m "fix: claim wallet orders atomically"
```

---

### Task 5: Make inventory mode explicit and prevent base fallback

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_inventory_mode/migration.sql`
- Create: `src/shared/types/inventory.ts`
- Modify: `src/shared/validations/index.ts`
- Modify: `src/server/modules/inventory/inventory.service.ts`
- Modify: `src/server/modules/products/product.service.ts`
- Test: `tests/inventory-mode.test.ts`
- Test: `tests/inventory.test.ts`
- Test: `tests/product-variant-lifecycle-and-stock-sync.test.ts`

**Interfaces:**
- Produces:

```ts
export type InventoryMode = 'BASE' | 'VARIANT';
export interface OrderStockItem { productId: string; variantId: string | null; quantity: number }
export function validateStockTarget(product: ProductStockShape, item: OrderStockItem): StockTargetResult;
```

Product gets `inventoryMode`; backfill `VARIANT` if any historical variant exists, not merely active variants.

- [ ] **Step 1: Write failing tests**

Assert:
- VARIANT product without variantId is rejected even when no active variant exists;
- BASE product with variantId is rejected;
- inactive variant is rejected;
- parent aggregate includes only defined ledger/projected quantities according to migration policy, not accidental inactive residue;
- duplicate product+variant cart lines are normalized before CAS to prevent sequential partial mutation ambiguity.

- [ ] **Step 2: Verify failures**

Run targeted files; expected FAIL because current behavior infers mode from active variants.

- [ ] **Step 3: Add schema field/backfill migration**

Backfill from existence of ProductVariant records. Add CHECK/application validation preventing BASE product from accepting variants in new writes.

- [ ] **Step 4: Centralize target validation and update checkout/inventory/product lifecycle**

All reserve/release/validation paths call the same mode rule. Parent `Product.stock` becomes read-only projection for VARIANT mode until M5 replaces it with ledger balance.

- [ ] **Step 5: Run schema and targeted tests**

Expected PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma src/shared/types/inventory.ts src/shared/validations/index.ts src/server/modules/inventory src/server/modules/products tests/inventory-mode.test.ts tests/inventory.test.ts tests/product-variant-lifecycle-and-stock-sync.test.ts
git commit -m "fix: make product inventory mode explicit"
```

---

### Task 6: Replace absolute admin stock overwrite with versioned adjustments

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_stock_version/migration.sql`
- Create: `src/server/modules/inventory/stock-adjustment.service.ts`
- Create: `src/server/modules/inventory/stock-adjustment.controller.ts`
- Create: `src/app/api/admin/inventory/adjustments/route.ts`
- Modify: `src/server/modules/products/product.service.ts`
- Modify: `src/client/views/admin/AdminProductsView.tsx`
- Test: `tests/stock-adjustment.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AdjustStockInput {
  productId: string;
  variantId: string | null;
  delta: number;
  expectedVersion: number;
  reason: string;
  operationKey: string;
}
export async function adjustStock(tx: TransactionClient, input: AdjustStockInput, actorId: string): Promise<StockAdjustmentResult>;
```

M5 will replace/extend storage with InventoryMovement; M0 interface and operationKey remain stable.

- [ ] **Step 1: Write failing validation and stale-version tests**

Assert reason non-empty, delta non-zero integer, operationKey required, negative result forbidden, stale expectedVersion conflicts, duplicate operationKey returns original result without applying twice.

- [ ] **Step 2: Write failing checkout-vs-adjustment integration test**

Run reservation and stale adjustment concurrently; assert either adjustment retries/conflicts and final stock equals initial − reserved + accepted delta, never absolute stale value.

- [ ] **Step 3: Verify failures**

Expected FAIL because current admin editor writes absolute stock.

- [ ] **Step 4: Add stockVersion and adjustment service/controller**

Use `updateMany` with `stockVersion: expectedVersion`, `stock + delta >= 0`; guard `inventory` or current `products` permission until Task 8 adds permission.

- [ ] **Step 5: Remove stock mutation from general product update**

Product create may set initial stock. Existing product PUT must reject direct `stock`/variant stock overwrite and direct client to adjustment endpoint. Minimal admin UI sends delta/reason/version.

- [ ] **Step 6: Run targeted tests and arch check**

Expected PASS and zero boundary violations.

- [ ] **Step 7: Commit**

```bash
git add prisma src/server/modules/inventory src/server/modules/products src/app/api/admin/inventory src/client/views/admin/AdminProductsView.tsx tests/stock-adjustment.test.ts tests/integration/money-shipping.test.ts
git commit -m "fix: make stock adjustments versioned and idempotent"
```

---

### Task 7: Use one packing snapshot for quote and fulfillment

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_packing_snapshot/migration.sql`
- Create: `src/shared/types/packing.ts`
- Create: `src/server/modules/shipping/packing.service.ts`
- Modify: `src/server/modules/shipping/shipping-quote.service.ts`
- Modify: `src/server/modules/shipping/ghn.service.ts`
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/orders/order-fulfillment.service.ts`
- Test: `tests/shipping-packing.test.ts`
- Test: `tests/ghn.test.ts`
- Test: `tests/order-fulfillment.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PackingSnapshot {
  totalWeightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  insuredValue: MoneyVnd;
  revision: string;
  lines: Array<{ orderItemId?: string; productId: string; variantId: string | null; unitWeightGrams: number; quantity: number }>;
}
export function buildPackingSnapshot(items: PackingSourceItem[], insuredValue: bigint): PackingSnapshot;
```

Order stores immutable packing snapshot JSON created at checkout/order creation.

- [ ] **Step 1: Write failing packing tests**

Assert non-positive/missing dimensions return typed `PACKING_DATA_MISSING`, multiple quantities aggregate deterministically, insured value round-trips string, and quote/fulfillment consume identical snapshot revision.

- [ ] **Step 2: Verify failures**

Expected FAIL due to 300g/250g/200g fallback paths.

- [ ] **Step 3: Add product/variant physical data and order snapshot**

Fields are nullable for legacy records. New active electronics SKUs require validated positive weight and dimensions before checkout.

- [ ] **Step 4: Implement packing builder and remove hardcoded weights**

Quote response includes snapshot/revision; order creation recalculates server-side and rejects mismatched quote revision with 409. Fulfillment reads stored snapshot only.

- [ ] **Step 5: Run targeted unit/integration tests**

Expected PASS; grep confirms no commerce fallback weights remain.

- [ ] **Step 6: Commit**

```bash
git add prisma src/shared/types/packing.ts src/server/modules/shipping src/server/modules/orders tests/shipping-packing.test.ts tests/ghn.test.ts tests/order-fulfillment.test.ts tests/integration/money-shipping.test.ts
git commit -m "feat: share packing snapshots across shipping lifecycle"
```

---

### Task 8: Add high-value manual fulfillment outcomes and RBAC alignment

**Files:**
- Modify: `src/shared/constants/permissions.ts`
- Modify: `src/server/modules/admin/permission.service.ts`
- Modify: `src/server/modules/auth/auth-options.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_manual_fulfillment/migration.sql`
- Modify: `src/server/modules/orders/order-fulfillment.service.ts`
- Modify: `src/server/modules/admin/fulfillment-review.controller.ts`
- Modify: `src/app/api/admin/fulfillment-review/route.ts`
- Modify: relevant admin order/shipments page gates
- Test: `tests/high-value-fulfillment.test.ts`
- Test: `tests/permissions.test.ts`
- Test: `tests/auth-session-permissions.test.ts`
- Test: `tests/integration/money-shipping.test.ts`

**Interfaces:**
- Adds permissions `inventory`, `warranties`, `knowledge`, `scoring`, `assistant`; financial/provider configuration stays ADMIN-only.
- Produces:

```ts
export type ManualFulfillmentOutcome = 'CANCEL_AND_REFUND' | 'EXTERNAL_SHIPMENT';
export interface ResolveFulfillmentReviewInput {
  orderId: string;
  outcome: ManualFulfillmentOutcome;
  reason: string;
  carrier?: string;
  trackingReference?: string;
  customerConsentReference?: string;
}
```

- [ ] **Step 1: Write failing permission/session tests**

Assert new allowlist round-trips JWT refresh and that page/API guards agree for STAFF. Provider config and financial resolve remain ADMIN-only.

- [ ] **Step 2: Write failing fulfillment policy tests**

Assert over carrier insurance/COD limit enters REVIEW without network call. `EXTERNAL_SHIPMENT` requires carrier/tracking/customer consent/reason. `CANCEL_AND_REFUND` calls the single refund operation key. Repeated resolution is idempotent.

- [ ] **Step 3: Verify failures**

Expected FAIL against binary CREATED/NONE review logic.

- [ ] **Step 4: Implement schema/state and resolver**

Store structured manual resolution metadata, actor and timestamps. Do not put evidence only into free-form `Order.note`.

- [ ] **Step 5: Align page/API guards and minimal admin forms**

No navigation-only authorization. API remains authoritative.

- [ ] **Step 6: Run permission, fulfillment and integration tests**

Expected PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma src/shared/constants/permissions.ts src/server/modules/admin src/server/modules/auth src/server/modules/orders src/app/api/admin src/app/admin tests/high-value-fulfillment.test.ts tests/permissions.test.ts tests/auth-session-permissions.test.ts tests/integration/money-shipping.test.ts
git commit -m "feat: gate high-value orders through reviewed fulfillment"
```

---

### Task 9: Fix approved-rating aggregation and run M0 full gate

**Files:**
- Modify: `src/server/modules/catalog/catalog.service.ts:70-104`
- Test: `tests/catalog-rating.test.ts`
- Modify: `docs/verification/2026-10-17-m0-baseline.md`

**Interfaces:**
- Produces catalog `avgRating`/`reviewCount` from `isApproved: true` only.

- [ ] **Step 1: Write failing catalog rating test**

Fixture has approved ratings `[5, 3]` and hidden rating `[1]`; assert `avgRating === 4`, `reviewCount === 2`.

- [ ] **Step 2: Verify fail, implement relation filter, verify pass**

Use Prisma relation where `isApproved: true`; do not filter only in UI.

- [ ] **Step 3: Run full M0 verification**

Run:

```bash
npm run verify
```

Expected: all commands PASS. If baseline had unrelated failure, stop and report rather than weakening tests.

- [ ] **Step 4: Rehearse migration/rollback and reconcile data**

Record table row counts, wallet balance sums, transaction sums and order totals before/after on disposable DB. Expected exact reconciliation.

- [ ] **Step 5: Update verification report and commit**

```bash
git add src/server/modules/catalog/catalog.service.ts tests/catalog-rating.test.ts docs/verification/2026-10-17-m0-baseline.md
git commit -m "fix: publish only approved review aggregates"
```

## M0 Exit Criteria

- [ ] `npm run verify` passes.
- [ ] Migration rehearsal and rollback evidence exists.
- [ ] Wallet concurrency and payment-vs-expiry tests pass.
- [ ] BigInt amounts survive DB + DTO round-trip.
- [ ] VARIANT product cannot fall back to base stock.
- [ ] Stale admin stock adjustment conflicts instead of overwriting reservation.
- [ ] Quote/fulfillment share one packing snapshot.
- [ ] High-value unsupported shipment reaches reviewed outcomes with audit-ready metadata.
