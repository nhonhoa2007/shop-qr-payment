# M5–M6 Operations and After-Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung PO, inventory ledger, serial/IMEI, audit, warranty và partial return/refund; đồng thời retire bốn bảng legacy để kết thúc ở đúng 34 Prisma models.

**Architecture:** M5 expand thêm sáu operations models lên peak 36: Supplier, PurchaseOrder, PurchaseOrderItem, InventoryMovement, SerializedUnit, AdminAuditLog. Projection onHand/reserved/quarantined nằm trên Product/Variant và được cập nhật cùng ledger; không có InventoryBalance/GoodsReceipt. Sau chuyển writers/readers, M5 contract migrate/drop StockAdjustment, Transaction, CouponUsage, ChatRoomParticipant để còn 32; M6 thêm WarrantyClaim và ReturnRequest (validated JSON timelines/items) để final 34.

**Tech Stack:** Prisma/PostgreSQL transactions/CAS/JSONB, TypeScript strict, Next.js thin facades, Pusher post-commit notifications, Node native/integration tests.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- Entry schema count 30 nếu M2–M4 đã chạy; operations có thể branch từ M1 nhưng merge phải reconcile count/contracts.
- Peak M5 expand đúng 36 và <=37; M5 exit đúng 32; M6 exit đúng 34.
- Chỉ thêm tám final operation/after-sales models nêu trong spec.
- Cấm InventoryBalance, GoodsReceipt/Item, SerializedUnitIdentifier, WarrantyPolicy/Event, ReturnItem/Event, RefundOperation.
- Product/Variant projections cập nhật atomically với append-only InventoryMovement; direct absolute stock writes bị loại.
- Movement/refund/receipt/state transition có operation key/fingerprint và replay-safe.
- Return received chỉ vào quarantine; không auto-restock.
- Partial refund dùng exact allocated paid amount; shipping mặc định không hoàn.
- Private evidence không đi qua AI.

## Review Focus

- Expand/backfill/dual-read/contract không mất dữ liệu, không vượt model budget.
- Movement sum/projection version vẫn đúng dưới reserve/adjust/receive/return concurrency.
- PO partial receipts concurrent không vượt ordered quantity hoặc duplicate serial.
- Legacy chat rooms không đúng 1:1 được report/quarantine, không âm thầm mất participant.
- Concurrent partial returns/refunds không vượt quantity hoặc entitlement từng đồng.

---

## M5 — Expand operations schema (30 → peak 36)

### Task 1: Add projection fields and append-only InventoryMovement

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_compact_inventory_ledger_expand/migration.sql`
- Create: `src/shared/types/inventory-ledger.ts`
- Create: `src/server/modules/inventory/inventory-ledger.service.ts`
- Test: `tests/inventory-ledger.test.ts`
- Test: `tests/integration/inventory-ledger.test.ts`
- Modify: model registry

**Interfaces:**

```ts
export type MovementKind = 'OPENING_LEGACY'|'RESERVE'|'RELEASE'|'SHIP'|'RECEIVE'|'QUARANTINE'|'RESTOCK'|'ADJUST';
export interface ApplyMovementInput { operationKey: string; target: StockTarget; kind: MovementKind; deltaOnHand: number; deltaReserved: number; deltaQuarantined: number; reason: string; actorId?: string; referenceType: string; referenceId: string }
export async function applyInventoryMovement(tx: TransactionClient, input: ApplyMovementInput): Promise<InventoryProjectionDto>;
```

- [ ] **Step 1: Write failing ledger/replay/concurrency tests**

Reserve 2 from onHand 5 → available 3; release/ship/quarantine/restock; same key same fingerprint no-op response; same key different payload conflict; no negative projection; movement sum reconciles.

- [ ] **Step 2: Add projection fields and only `InventoryMovement`**

Product/Variant get onHandStock/reservedStock/quarantinedStock; `stock` remains compatibility available projection. Insert movement and versioned projection update in one transaction.

- [ ] **Step 3: Backfill one OPENING_LEGACY movement per target**

Do not invent movement history/serials. Reconcile totals.

- [ ] **Step 4: Validate count 31 and commit**

```bash
npm run schema:budget -- --expected=31
```

```bash
git add prisma src/shared/types/inventory-ledger.ts src/server/modules/inventory tests docs/architecture/prisma-model-registry.md
git commit -m "feat: add compact inventory movement ledger"
```

---

### Task 2: Route every order/inventory writer through movement service

**Files:**
- Modify: inventory/order/expiry/fulfillment/GHN/admin-bank/wallet services
- Test: existing inventory/cancellation suites
- Test: `tests/integration/inventory-ledger.test.ts`

**Interfaces:**

```ts
reserveOrderStock(tx, items, operationKey): Promise<string | null>;
releaseOrderStock(tx, items, operationKey): Promise<void>;
consumeShippedStock(tx, items, operationKey): Promise<void>;
quarantineReturnedStock(tx, items, operationKey): Promise<void>;
```

- [ ] **Step 1: Write lifecycle/replay/race tests**

Stable `order:<id>:reserve|release|ship`; expiry/GHN/refund replay; shipped cancellation waits physical return; VARIANT never falls back BASE.

- [ ] **Step 2: Move all writers to ledger primitives**

- [ ] **Step 3: Search and reject remaining direct stock mutations**

Only migration/projection updater may write stock fields.

- [ ] **Step 4: Run tests and commit**

```bash
git add src/server/modules tests/integration/inventory-ledger.test.ts
git commit -m "refactor: route stock through movement ledger"
```

---

### Task 3: Add Supplier, PurchaseOrder and PurchaseOrderItem receipts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_compact_procurement/migration.sql`
- Create: procurement shared types/service/controller/routes
- Test: `tests/procurement.test.ts`
- Test: `tests/integration/procurement-receipt.test.ts`
- Modify: model registry

**Interfaces:**

```ts
export async function createPurchaseOrder(tx: TransactionClient, input: CreatePoInput): Promise<PurchaseOrderDto>;
export async function receivePurchaseOrderItems(tx: TransactionClient, input: ReceivePoInput): Promise<ReceiptResultDto>;
export async function transitionPurchaseOrder(tx: TransactionClient, input: PoTransitionInput): Promise<PurchaseOrderDto>;
```

Receipt result is derived from PO items + RECEIVE movements; there is no GoodsReceipt DTO/model identity.

- [ ] **Step 1: Write FSM/quantity/money tests**

DRAFT→ORDERED→PARTIALLY_RECEIVED→RECEIVED/CANCELLED; cumulative received <= ordered; partial 2+3/5; MoneyVnd cost exact.

- [ ] **Step 2: Write replay/concurrent over-receipt tests**

Same key one RECEIVE movement; different payload conflict; at most remaining quantity accepted.

- [ ] **Step 3: Add exactly three models and transaction service**

PurchaseOrderItem stores ordered/received quantities and unitCost. Each receipt creates InventoryMovement linked to PO item/batch.

- [ ] **Step 4: Add guarded routes, validate count 34 and commit**

```bash
npm run schema:budget -- --expected=34
```

```bash
git add prisma src/shared/types/procurement.ts src/server/modules/procurement src/app/api/admin tests docs/architecture/prisma-model-registry.md
git commit -m "feat: receive purchase orders through movements"
```

---

### Task 4: Add SerializedUnit without identifier child table

**Files:**
- Modify: schema + migration
- Create: serial normalization/service/controller/routes
- Modify: procurement/fulfillment/manual review
- Test: `tests/serialized-unit.test.ts`
- Test: `tests/integration/serialized-fulfillment.test.ts`
- Modify: registry

**Interfaces:**

```ts
export function normalizeSerialIdentifiers(input: SerialIdentifiersInput): NormalizedSerialIdentifiers;
export async function assignSerializedUnits(tx: TransactionClient, input: AssignmentInput): Promise<void>;
export async function assertOrderSerializationReady(tx: TransactionClient, orderId: string): Promise<SerializationReadiness>;
```

- [ ] **Step 1: Write identifier/receipt tests**

serialNumber/imei1/imei2 normalized and unique when non-null; receipt unit count equals quantity; public DTO masks identifiers.

- [ ] **Step 2: Write assignment/fulfillment concurrency tests**

Same unit cannot sell twice; wrong SKU/quantity fails; device missing units blocks shipment; accessory rule; legacy override ADMIN+reason+audit seam.

- [ ] **Step 3: Add only `SerializedUnit` and gates**

CAS AVAILABLE→ASSIGNED→SOLD; no identifier child model.

- [ ] **Step 4: Validate count 35 and commit**

```bash
npm run schema:budget -- --expected=35
```

```bash
git add prisma src/server/modules/inventory src/server/modules/procurement src/server/modules/orders src/app/api/admin/inventory tests docs/architecture/prisma-model-registry.md
git commit -m "feat: track compact serialized units"
```

---

### Task 5: Add immutable redacted AdminAuditLog

**Files:**
- Modify: schema + migration
- Create: audit service/controller/route/minimal views
- Modify: sensitive services/controllers
- Test: `tests/audit-privacy.test.ts`
- Test: `tests/operator-guards.test.ts`
- Modify: registry

**Interfaces:**

```ts
export async function appendAdminAudit(tx: TransactionClient, input: AdminAuditInput): Promise<void>;
export function redactAuditPayload(action: string, payload: unknown): JsonObject;
```

- [ ] **Step 1: Write privacy/immutability/idempotency tests**

Allowlisted fields only; no secret/password/token/full prompt/raw payment/full identifier; no update/delete service; replay no duplicate audit; list ADMIN-only.

- [ ] **Step 2: Add only `AdminAuditLog`, redactor and service**

Audit in same transaction as domain action.

- [ ] **Step 3: Adopt audit in price/source/scoring/inventory/serial/permission/reconciliation/refund/manual fulfillment**

- [ ] **Step 4: Add minimal guarded pages, validate peak 36 and commit**

```bash
npm run schema:budget -- --expected=36
```

Expected M5 peak exactly 36 and <=37.

```bash
git add prisma src/server src/app/admin src/app/api/admin src/client tests docs/architecture/prisma-model-registry.md
git commit -m "feat: audit sensitive commerce operations"
```

---

## M5 — Contract four legacy models (36 → 32)

### Task 6: Migrate StockAdjustment and Transaction

**Files:**
- Create: expand/backfill/switch/contract migration scripts
- Modify: stock adjustment, payment webhook and analytics readers
- Test: `tests/integration/m5-ledger-compaction.test.ts`
- Test: `tests/integration/m5-bank-transfer-compaction.test.ts`

**Interfaces:**
- StockAdjustment → InventoryMovement `ADJUST` preserving operationKey/delta/version/reason/actor/time.
- Transaction → BankTransfer `APPLIED_ORDER` preserving amount/bank ID/raw data/time and deterministic fingerprint.

- [ ] **Step 1: Write backfill/replay/reconciliation tests**

Counts, unique IDs and BigInt sums exact; rerun no duplicates; all readers work before contract; conflicting bankTransId fails report.

- [ ] **Step 2: Implement backfill and switch all readers/writers**

Dual-write is permitted only during one explicit migration phase with common operation identity.

- [ ] **Step 3: Prove zero runtime references, then drop two models**

- [ ] **Step 4: Validate count 34 and commit**

```bash
npm run schema:budget -- --expected=34
```

```bash
git add prisma src/server tests/integration docs/architecture/prisma-model-registry.md
git commit -m "refactor: merge temporary stock and bank ledgers"
```

---

### Task 7: Migrate CouponUsage and ChatRoomParticipant

**Files:**
- Modify: schema + expand/backfill/contract migrations
- Modify: coupon claim/release services, chat/auth/read-state services
- Test: `tests/integration/m5-coupon-compaction.test.ts`
- Test: `tests/integration/m5-chat-compaction.test.ts`
- Create: migration anomaly report template

**Interfaces:**
- Order gains `couponUsageClaimedAt`; existing couponId/userId/orderId is claim identity.
- ChatRoom gains `customerId`, `assignedStaffId`, `customerReadAt`, `staffReadAt`.

- [ ] **Step 1: Write coupon migration/concurrency tests**

Backfill claims; per-user/usage-limit remains atomic; cancellation/expiry releases once; counts reconcile before/after.

- [ ] **Step 2: Write chat cardinality/ownership tests**

Valid customer/staff rooms map exactly; duplicate/ambiguous/multi-party room goes to anomaly report and blocks contract; Pusher auth/read-state remain correct.

- [ ] **Step 3: Expand, backfill, switch all readers/writers**

- [ ] **Step 4: Drop both legacy models only after zero anomalies**

- [ ] **Step 5: Validate M5 exit count 32, full reconciliation and commit**

```bash
npm run schema:budget -- --expected=32
```

```bash
git add prisma src/server tests/integration docs/architecture/prisma-model-registry.md docs/verification
git commit -m "refactor: compact coupon and customer chat storage"
```

---

## M6 — Warranty and returns (32 → 34)

### Task 8: Snapshot warranty policy and add WarrantyClaim

**Files:**
- Modify: schema + migration
- Create: warranty shared JSON validation/FSM/service/controller/routes
- Test: `tests/warranty-policy.test.ts`
- Test: `tests/warranty-fsm.test.ts`
- Test: `tests/integration/warranty-ownership.test.ts`
- Modify: registry

**Interfaces:**

```ts
export function resolveWarrantyTerms(orderItemSnapshot: unknown, completedAt: Date): WarrantyTerms;
export async function createWarrantyClaim(tx: TransactionClient, input: CreateWarrantyInput, customerId: string): Promise<WarrantyClaimDto>;
export async function transitionWarranty(tx: TransactionClient, input: WarrantyTransitionInput): Promise<WarrantyClaimDto>;
```

- [ ] **Step 1: Write policy/ownership tests**

Laptop/phone default 12 calendar months; accessory requires snapshot; exclusions; UNKNOWN manual review; owner/completed order/serial match; one open claim slot.

- [ ] **Step 2: Write FSM/timeline/version/replay tests**

Valid transitions, stale expectedVersion conflict, same operation no duplicate timeline/audit; malformed timeline/evidence JSON rejected.

- [ ] **Step 3: Add only `WarrantyClaim`**

Timeline/evidence/outcome embedded validated JSON; AdminAuditLog covers transitions. No WarrantyPolicy/Event models.

- [ ] **Step 4: Add referral/replacement/private evidence**

Replacement compatible AVAILABLE unit; original expiry retained; extension ADMIN reason/audit; refund review creates RefundCase, no immediate wallet mutation.

- [ ] **Step 5: Validate count 33 and commit**

```bash
npm run schema:budget -- --expected=33
```

```bash
git add prisma src/shared src/server/modules/warranties src/app/api/warranties src/client tests docs/architecture/prisma-model-registry.md
git commit -m "feat: add compact warranty lifecycle"
```

---

### Task 9: Add ReturnRequest with JSON items and quarantine FSM

**Files:**
- Modify: schema + migration
- Create: return shared JSON validation/FSM/service/controller/routes
- Test: `tests/return-fsm.test.ts`
- Test: `tests/integration/return-quantity.test.ts`
- Modify: registry

**Interfaces:**

```ts
export async function requestReturn(tx: TransactionClient, input: RequestReturnInput): Promise<ReturnRequestDto>;
export async function transitionReturn(tx: TransactionClient, input: ReturnTransitionInput): Promise<ReturnRequestDto>;
export async function applyReturnDisposition(tx: TransactionClient, input: ReturnDispositionInput): Promise<void>;
```

- [ ] **Step 1: Write JSON item/quantity/concurrency tests**

Bounded item array; orderItem/quantity/unit IDs validated; request 2/3 succeeds, concurrent second 2 fails; cumulative <= purchased; one active return per serial.

- [ ] **Step 2: Write lifecycle/disposition tests**

ITEM_RECEIVED quarantine only; RESTOCKABLE once; other dispositions never saleable automatically; timeline/replay/CAS valid.

- [ ] **Step 3: Add only `ReturnRequest` and OrderItem projections**

No ReturnItem/Event models. Exchange is return + separately priced order.

- [ ] **Step 4: Validate final count 34 and commit**

```bash
npm run schema:budget -- --expected=34
```

```bash
git add prisma src/shared src/server/modules/returns src/app/api/returns tests docs/architecture/prisma-model-registry.md
git commit -m "feat: add compact partial return lifecycle"
```

---

### Task 10: Extend RefundCase for exact idempotent partial refunds

**Files:**
- Modify: schema fields only + migration
- Create: `src/server/modules/returns/refund-allocation.ts`
- Create: `src/server/modules/wallet/refund-case.service.ts`
- Refactor: wallet whole-order refund primitive
- Test: `tests/refund-allocation.test.ts`
- Test: `tests/integration/partial-refund.test.ts`

**Interfaces:**

```ts
export function allocateOrderDiscount(items: AllocationItem[], discount: bigint): AllocationResult;
export async function quotePartialRefund(tx: TransactionClient, input: RefundQuoteInput): Promise<RefundQuote>;
export async function executeRefundCase(tx: TransactionClient, input: ExecuteRefundInput): Promise<RefundCaseDto>;
```

- [ ] **Step 1: Write conservation/cap/concurrency tests**

Largest remainder stable; sums exact; large BigInt exact; cumulative item/order cap; shipping requires store-fault+ADMIN; identical sourceKey replay; same key/different body conflict; whole-order after partial pays remainder only.

- [ ] **Step 2: Extend RefundCase rather than creating RefundOperation**

Link optional ReturnRequest/WarrantyClaim and immutable entitlement/allocation snapshot; credit wallet or guest case once.

- [ ] **Step 3: Update payment projection and serializers coherently**

Do not mutate original subtotal/discount snapshots.

- [ ] **Step 4: Verify count remains 34 and commit**

```bash
git add prisma src/server/modules/returns src/server/modules/wallet tests docs/architecture/prisma-model-registry.md
git commit -m "feat: post partial refunds through refund cases"
```

---

### Task 11: Add minimal after-sales UI, auth, notifications and final gate

**Files:**
- Create: customer/admin warranty/return views/pages
- Modify: admin sidebar/layout, notifications, shared NotificationType
- Test: `tests/aftersales-authorization.test.ts`
- Test: `tests/integration/aftersales-e2e.test.ts`
- Create: `docs/verification/2026-10-17-m5-m6.md`

**Interfaces:**
- Customer can list/read only owned cases; `warranties` STAFF may operate non-financial transitions; ADMIN alone may approve financial/policy overrides and read complete audit records.

- [ ] **Step 1: Write page/API/realtime authorization matrix tests**

Customer own cases only; warranties STAFF workflow only; financial override/audit ADMIN-only.

- [ ] **Step 2: Write end-to-end replay test**

Completed order → serial → warranty + partial return → quarantine → disposition → RefundCase/wallet → notification/audit; replay no duplicates.

- [ ] **Step 3: Implement minimal UI and post-commit notification events**

- [ ] **Step 4: Run full gates/rehearsal/reconciliation**

```bash
npm run verify
npx prisma validate
npm run schema:budget -- --expected=34
```

- [ ] **Step 5: Record actual evidence and commit**

```bash
git add src/app src/client src/server src/shared tests docs/verification docs/architecture/prisma-model-registry.md
git commit -m "feat: expose compact after-sales operations"
```

## M5–M6 Exit Criteria

- [ ] M5 expand peak 36 and never >37.
- [ ] M5 contract drops four legacy models after exact reconciliation; exit 32.
- [ ] M6 adds only WarrantyClaim/ReturnRequest; final 34.
- [ ] No forbidden balance/receipt/identifier/policy/event/item/refund-operation model.
- [ ] Ledger/projection/PO/serial/audit concurrency tests pass.
- [ ] Warranty/return/refund ownership/conservation/replay tests pass.
- [ ] Full gate, model budget and migration rollback rehearsal pass.
