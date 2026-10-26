# M5–M6 Operations and After-Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung nhập hàng, ledger kho, serial/IMEI, audit, bảo hành và partial return/refund có tính đồng thời và truy vết đầy đủ.

**Architecture:** InventoryBalance là projection được cập nhật cùng append-only InventoryMovement trong một transaction; Product/Variant.stock chỉ còn read projection tương thích. Warranty/Return là hai FSM riêng, cùng dùng serialized units, audit và refund operation idempotent; partial refund không gọi nguyên trạng whole-order refund hiện tại.

**Tech Stack:** Prisma/PostgreSQL, TypeScript strict, Next.js 16 thin route facades, Node native tests, Pusher notifications.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- Chỉ bắt đầu khi M0 và M1 pass; M0 MoneyVnd/MoneySnapshot và M1 OrderItem snapshots là contract bắt buộc.
- `onHand` là hàng bán được tại kho; `reserved` là phần đã giữ trong onHand; `available = onHand - reserved`; `quarantined` là kho vật lý riêng chưa bán được.
- InventoryMovement append-only; mọi operation có operationKey duy nhất và replay không áp dụng lần hai.
- Laptop/phone bắt buộc serial trước shipment; phụ kiện theo `serializationRequired`.
- Return received chỉ vào quarantine, không tự restock.
- Partial refund dùng giá thực trả sau phân bổ discount; shipping mặc định không hoàn.
- Không gọi `refundOrderToWallet` nguyên trạng cho partial return.
- Ảnh hậu mãi không đi qua AI pipeline.
- UI chỉ ở mức tối thiểu để vận hành; API và FSM là nguồn sự thật.

## Review Focus

- Hai receipt/reserve/release replay hoặc concurrent không làm balance lệch movement sum.
- Một serial/IMEI không thể nhập hoặc gán cho hai unit/order khác nhau.
- Hai partial return đồng thời không thể vượt quantity đã mua.
- Tổng phân bổ discount và tổng entitlement hoàn luôn bảo toàn từng đồng VND.
- STAFF không có quyền tài chính không thể duyệt shipping refund, warranty override hoặc đọc audit log.

---

### Task 1: Introduce inventory balance and append-only movement ledger

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_inventory_ledger/migration.sql`
- Create: `src/shared/types/inventory-ledger.ts`
- Create: `src/server/modules/inventory/inventory-ledger.service.ts`
- Test: `tests/inventory-ledger.test.ts`
- Test: `tests/integration/inventory-ledger.test.ts`

**Interfaces:**

```ts
export type MovementKind = 'OPENING_LEGACY' | 'RESERVE' | 'RELEASE' | 'SHIP' | 'RECEIVE' | 'QUARANTINE' | 'RESTOCK' | 'ADJUST';
export interface ApplyMovementInput { operationKey: string; stockKey: string; kind: MovementKind; deltaOnHand: number; deltaReserved: number; deltaQuarantined: number; reason: string; actorId?: string; referenceType: string; referenceId: string }
export async function applyInventoryMovement(tx: TransactionClient, input: ApplyMovementInput): Promise<InventoryBalanceDto>;
```

- [ ] **Step 1: Write failing ledger tests**

Assert reserve 2 from onHand 5 → `{onHand:5,reserved:2,available:3}`; release restores reserved 0; ship consumes onHand/reserved; replay keeps one movement; same key/different payload conflicts; negative/over-reserve fails; movement sum reconciles balance.

- [ ] **Step 2: Verify targeted failure**

Run unit test; expected missing module/schema.

- [ ] **Step 3: Add schema, DB checks and atomic service**

Use canonical stockKey `BASE:<productId>` or `VARIANT:<variantId>`. Store request fingerprint beside operationKey. Update balance using versioned CAS inside transaction; keep Product/Variant.stock as available projection.

- [ ] **Step 4: Backfill opening balances**

Create exactly one `OPENING_LEGACY` movement per stockKey from existing available stock; do not invent historical movements or serials.

- [ ] **Step 5: Run unit/integration and migration reconciliation**

Expected PASS; pre/post total legacy stock equals opening balance total.

- [ ] **Step 6: Commit**

```bash
git add prisma src/shared/types/inventory-ledger.ts src/server/modules/inventory/inventory-ledger.service.ts tests/inventory-ledger.test.ts tests/integration/inventory-ledger.test.ts
git commit -m "feat: add append-only inventory ledger"
```

---

### Task 2: Route all order inventory events through the ledger

**Files:**
- Modify: `src/server/modules/inventory/inventory.service.ts`
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/orders/order-detail.controller.ts`
- Modify: `src/server/modules/orders/expire-orders.controller.ts`
- Modify: `src/server/modules/orders/order-fulfillment.service.ts`
- Modify: `src/server/modules/shipping/ghn-webhook.controller.ts`
- Modify: `src/server/modules/admin/bank-review.controller.ts`
- Modify: `src/server/modules/wallet/wallet.service.ts`
- Test: `tests/inventory.test.ts`
- Test: `tests/order-cancellation-inventory-release.test.ts`
- Test: `tests/integration/inventory-ledger.test.ts`

**Interfaces:**

```ts
reserveOrderStock(tx, items, operationKey): Promise<string | null>;
releaseOrderStock(tx, items, operationKey): Promise<void>;
consumeShippedStock(tx, items, operationKey): Promise<void>;
quarantineReturnedStock(tx, items, operationKey): Promise<void>;
```

- [ ] **Step 1: Write failing lifecycle/replay tests**

Assert stable keys `order:<id>:reserve|release|ship`; expiry/repeated GHN webhook/full refund cannot double-release; shipped cancellation waits for physical return and does not release saleable stock; inactive variant cannot fall back to base.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Move all writers to ledger primitives**

Generate Order ID before reservation inside transaction. Choose one handoff milestone (`shipment created/manual dispatch confirmed`) to consume reserved stock consistently; document it in service tests.

- [ ] **Step 4: Remove direct Product/Variant.stock mutation outside projection updater**

Run `rg` and make any remaining business writer fail review unless it is migration/projection code.

- [ ] **Step 5: Run concurrency/replay integration tests and commit**

```bash
git add src/server/modules tests/inventory.test.ts tests/order-cancellation-inventory-release.test.ts tests/integration/inventory-ledger.test.ts
git commit -m "refactor: route order stock through inventory ledger"
```

---

### Task 3: Add suppliers, purchase orders and idempotent receipts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_procurement/migration.sql`
- Create: `src/shared/types/procurement.ts`
- Create: `src/server/modules/procurement/procurement.service.ts`
- Create: `src/server/modules/procurement/procurement.controller.ts`
- Create: `src/app/api/admin/suppliers/route.ts`
- Create: `src/app/api/admin/purchase-orders/route.ts`
- Create: `src/app/api/admin/purchase-orders/[id]/receipts/route.ts`
- Test: `tests/procurement.test.ts`
- Test: `tests/integration/procurement-receipt.test.ts`

**Interfaces:**

```ts
createPurchaseOrder(tx, {supplierId, items, actorId}): Promise<PurchaseOrderDto>;
receiveGoods(tx, {purchaseOrderId, operationKey, items, actorId}): Promise<GoodsReceiptDto>;
transitionPurchaseOrder(tx, id, expectedStatus, nextStatus, actorId): Promise<PurchaseOrderDto>;
```

`items.unitCost` consumes MoneyVnd at API boundary and bigint internally.

- [ ] **Step 1: Write failing FSM/quantity/money tests**

Assert `DRAFT→ORDERED→PARTIALLY_RECEIVED→RECEIVED`, invalid transition fails, received cumulative <= ordered, partial 2+3 of 5 succeeds, decimal-string cost round-trips.

- [ ] **Step 2: Add failing receipt replay/concurrency integration test**

Two requests with same key return one receipt/movement; different payload same key conflicts; concurrent over-receipt accepts at most remaining quantity.

- [ ] **Step 3: Verify fail, add schema and transaction service**

Receipt, items, inventory movement and balance update are one transaction.

- [ ] **Step 4: Add thin guarded routes and run tests**

Use `inventory` permission; Supplier delete is soft/archive if referenced.

- [ ] **Step 5: Commit**

```bash
git add prisma src/shared/types/procurement.ts src/server/modules/procurement src/app/api/admin tests/procurement.test.ts tests/integration/procurement-receipt.test.ts
git commit -m "feat: receive supplier stock idempotently"
```

---

### Task 4: Track serialized units and gate fulfillment

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_serialized_units/migration.sql`
- Create: `src/server/modules/inventory/serial-identifiers.ts`
- Create: `src/server/modules/inventory/serialized-unit.service.ts`
- Create: `src/server/modules/inventory/serialized-unit.controller.ts`
- Create: `src/app/api/admin/inventory/serials/route.ts`
- Modify: `src/server/modules/procurement/procurement.service.ts`
- Modify: `src/server/modules/orders/order-fulfillment.service.ts`
- Modify: `src/server/modules/admin/fulfillment-review.controller.ts`
- Test: `tests/serialized-unit.test.ts`
- Test: `tests/integration/serialized-fulfillment.test.ts`

**Interfaces:**

```ts
export type IdentifierType = 'SERIAL' | 'IMEI_1' | 'IMEI_2';
assignSerializedUnits(tx, {orderItemId, unitIds, operationKey, actorId}): Promise<void>;
assertOrderSerializationReady(tx, orderId): Promise<SerializationReadiness>;
```

- [ ] **Step 1: Write failing identifier tests**

Assert normalized `(type,value)` unique, one unit can have SERIAL+IMEI_1+IMEI_2, duplicate IMEI rejected, public DTO masks identifiers, receipt quantity equals units for serialized SKU.

- [ ] **Step 2: Write failing assignment/fulfillment integration tests**

Concurrent assignment cannot sell same unit twice; wrong SKU/quantity fails; laptop/phone missing units blocks GHN/manual shipment; non-serialized accessory passes; legacy override requires ADMIN reason/evidence and audit.

- [ ] **Step 3: Verify fail, implement schema/service/gates**

CAS unit `AVAILABLE→ASSIGNED→SOLD`; replacement/return statuses are added in M6 without reusing an available unit incorrectly.

- [ ] **Step 4: Run tests and commit**

```bash
git add prisma src/server/modules/inventory src/server/modules/procurement src/server/modules/orders src/server/modules/admin/fulfillment-review.controller.ts src/app/api/admin/inventory tests/serialized-unit.test.ts tests/integration/serialized-fulfillment.test.ts
git commit -m "feat: require serialized units for device fulfillment"
```

---

### Task 5: Add immutable redacted admin audit and minimal operations pages

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_admin_audit/migration.sql`
- Create: `src/server/modules/admin/audit.service.ts`
- Create: `src/server/modules/admin/audit-logs.controller.ts`
- Create: `src/app/api/admin/audit-logs/route.ts`
- Modify: sensitive controllers/services for products, permissions, reconciliation, fulfillment, procurement and inventory
- Create: `src/client/views/admin/AdminInventoryView.tsx`
- Create: `src/client/views/admin/AdminProcurementView.tsx`
- Create: `src/client/views/admin/AdminAuditView.tsx`
- Create: admin pages for inventory/purchase-orders/audit-logs
- Modify: `src/client/components/admin/layout/AdminSidebar.tsx`
- Test: `tests/audit-privacy.test.ts`
- Test: `tests/operator-guards.test.ts`

**Interfaces:**

```ts
appendAdminAudit(tx, {actorId, role, permission, action, entityType, entityId, before, after, reason, correlationId}): Promise<void>;
redactAuditPayload(action: string, payload: unknown): JsonObject;
```

- [ ] **Step 1: Write failing privacy/immutability tests**

Assert allowlisted fields only; API key/password/token/full prompt/raw payment/identifier plaintext absent; audit rows have no update/delete service; operation replay does not duplicate audit; audit list is ADMIN-only.

- [ ] **Step 2: Verify fail, implement schema/redactor/service**

Write audit in same transaction as domain action. Store MoneyVnd strings, not bigint JSON.

- [ ] **Step 3: Adopt audit in sensitive actions**

Cover price/active, inventory receipt/adjustment, serial override, permission grant, reconciliation/refund and manual fulfillment.

- [ ] **Step 4: Add minimal guarded pages and read-only stock projections**

Remove/disable absolute stock inputs from product editor; page/API guards must agree.

- [ ] **Step 5: Run tests/build and commit**

```bash
git add prisma src/server/modules/admin src/server/modules/products src/server/modules/procurement src/server/modules/inventory src/app/admin src/app/api/admin src/client tests/audit-privacy.test.ts tests/operator-guards.test.ts
git commit -m "feat: audit sensitive store operations"
```

---

### Task 6: Snapshot warranty policy and implement warranty FSM

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_warranty_claims/migration.sql`
- Create: `src/shared/types/warranty.ts`
- Create: `src/server/modules/warranties/warranty-policy.service.ts`
- Create: `src/server/modules/warranties/warranty.fsm.ts`
- Create: `src/server/modules/warranties/warranty.service.ts`
- Create: `src/server/modules/warranties/warranty.controller.ts`
- Create: `src/app/api/warranties/route.ts`
- Create: `src/app/api/warranties/[id]/route.ts`
- Test: `tests/warranty-policy.test.ts`
- Test: `tests/warranty-fsm.test.ts`
- Test: `tests/integration/warranty-ownership.test.ts`

**Interfaces:**

```ts
resolveWarrantyTerms(orderItemSnapshot, completedAt): WarrantyTerms;
createWarrantyClaim(tx, input, customerId): Promise<WarrantyClaimDto>;
transitionWarranty(tx, {claimId, expectedStatus, nextStatus, outcome, actorId, note, evidenceIds, operationKey}): Promise<WarrantyClaimDto>;
```

- [ ] **Step 1: Write failing policy tests**

Laptop/phone without SKU policy gets 12 calendar months from COMPLETED; accessory requires SKU snapshot; drops/liquid/misuse excluded unless policy allows; historical UNKNOWN routes manual review, not auto-approve; leap/calendar boundaries deterministic.

- [ ] **Step 2: Write failing ownership/FSM tests**

Only owner/completed order; serial belongs to OrderItem; one open claim per unit/quantity slot; valid transitions/events; replay no duplicate event; invalid/stale expectedStatus conflicts.

- [ ] **Step 3: Verify fail, implement schema/services/routes**

FSM: SUBMITTED→RECEIVED→INSPECTING→WAITING_PARTS→RESOLVED plus REJECTED/CANCELLED branches. Every transition appends event and audit in one transaction.

- [ ] **Step 4: Run tests and commit**

```bash
git add prisma src/shared/types/warranty.ts src/server/modules/warranties src/app/api/warranties tests/warranty-policy.test.ts tests/warranty-fsm.test.ts tests/integration/warranty-ownership.test.ts
git commit -m "feat: add warranty policy and claim lifecycle"
```

---

### Task 7: Add warranty referral, replacement and private evidence

**Files:**
- Create: `src/server/modules/warranties/warranty-evidence.controller.ts`
- Create: `src/app/api/warranties/[id]/evidence/route.ts`
- Modify: `src/server/modules/warranties/warranty.service.ts`
- Modify: `src/server/modules/upload/upload.service.ts`
- Create: `src/client/views/WarrantiesView.tsx`
- Create: `src/client/views/admin/AdminWarrantiesView.tsx`
- Create: customer/admin warranty pages
- Test: `tests/warranty-resolution.test.ts`
- Test: `tests/warranty-evidence.test.ts`

**Interfaces:**
- Outcomes: `REPAIR | REPLACE | RETURN_NO_PAYMENT | REFUND_REVIEW`.
- Replacement links original/replacement SerializedUnit and defaults to original warranty expiry.

- [ ] **Step 1: Write failing resolution tests**

Assert manufacturer referral stores external reference; replacement requires compatible AVAILABLE unit; original expiry retained; extension requires ADMIN reason/evidence/audit; REFUND_REVIEW creates controlled review, no wallet mutation.

- [ ] **Step 2: Write failing evidence security tests**

Ownership/permission, MIME magic, size and private retrieval; unauthorized URL fails; evidence excluded from assistant payload; retention follows claim lifecycle.

- [ ] **Step 3: Implement services/controllers and minimal pages**

- [ ] **Step 4: Run tests/build and commit**

```bash
git add src/server/modules/warranties src/server/modules/upload src/app/api/warranties src/app/warranties src/app/admin/warranties src/client/views tests/warranty-resolution.test.ts tests/warranty-evidence.test.ts
git commit -m "feat: resolve warranty claims with private evidence"
```

---

### Task 8: Implement partial return FSM and quarantine dispositions

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_returns/migration.sql`
- Create: `src/shared/types/return.ts`
- Create: `src/server/modules/returns/return.fsm.ts`
- Create: `src/server/modules/returns/returns.service.ts`
- Create: `src/server/modules/returns/returns.controller.ts`
- Create: `src/app/api/returns/route.ts`
- Create: `src/app/api/returns/[id]/route.ts`
- Test: `tests/return-fsm.test.ts`
- Test: `tests/integration/return-quantity.test.ts`

**Interfaces:**

```ts
requestReturn(tx, {orderItemId, quantity, unitIds, reason, operationKey, customerId}): Promise<ReturnRequestDto>;
transitionReturn(tx, {requestId, expectedStatus, nextStatus, actorId, reason, evidenceIds, operationKey}): Promise<ReturnRequestDto>;
applyReturnDisposition(tx, {returnItemId, disposition, operationKey, actorId}): Promise<void>;
```

- [ ] **Step 1: Write failing quantity/concurrency tests**

Request 2/3 succeeds; concurrent second 2 fails; cumulative open+refunded <= purchased; serial in one active return only.

- [ ] **Step 2: Write failing lifecycle/disposition tests**

REQUESTED→APPROVED→ITEM_RECEIVED→INSPECTED→RESOLVED plus REJECTED/CANCELLED. ITEM_RECEIVED increments quarantined only; RESTOCKABLE quarantine→onHand once; DEFECTIVE/REFURBISH/RETURN_TO_SUPPLIER/DISPOSED never become saleable automatically.

- [ ] **Step 3: Verify fail, implement CAS balance/FSM/services/routes**

Exchange is return + separately priced new order; no inline price difference.

- [ ] **Step 4: Run unit/integration and commit**

```bash
git add prisma src/shared/types/return.ts src/server/modules/returns src/app/api/returns tests/return-fsm.test.ts tests/integration/return-quantity.test.ts
git commit -m "feat: process partial returns through quarantine"
```

---

### Task 9: Allocate and post partial refunds exactly once

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_refund_operations/migration.sql`
- Create: `src/server/modules/returns/refund-allocation.ts`
- Create: `src/server/modules/wallet/refund-operation.service.ts`
- Refactor: `src/server/modules/wallet/wallet.service.ts`
- Test: `tests/refund-allocation.test.ts`
- Test: `tests/integration/partial-refund.test.ts`

**Interfaces:**

```ts
allocateOrderDiscount(items, merchandiseDiscount): Map<string, bigint[]>;
quotePartialRefund(tx, input): Promise<RefundQuote>;
executeRefundOperation(tx, input): Promise<RefundOperationDto>;
```

- [ ] **Step 1: Write failing allocation conservation tests**

Stable largest-remainder allocation by orderItemId/unit ordinal; 1 VND across 3 equal units → `[1,0,0]`; sum equals exact discount; large BigInt remains exact.

- [ ] **Step 2: Write failing refund policy/concurrency tests**

Net paid per returned unit; cumulative item amount/quantity cap; shipping 0 unless store-fault reason + ADMIN; identical key replay one credit/case; same key/different body conflicts; whole-order refund after partial pays only remaining entitlement.

- [ ] **Step 3: Verify fail, add RefundOperation and extract accounting primitive**

Separate “credit wallet/create guest RefundCase” from “cancel whole order/release all stock/reverse coupon”. Partial path never invokes whole-order lifecycle side effects.

- [ ] **Step 4: Update payment projection**

Add `refundedAmount` and optionally `PARTIALLY_REFUNDED`; update every guard/serializer/test coherently. Do not mutate original subtotal/discount snapshot.

- [ ] **Step 5: Run unit/integration and commit**

```bash
git add prisma src/server/modules/returns/refund-allocation.ts src/server/modules/wallet tests/refund-allocation.test.ts tests/integration/partial-refund.test.ts
git commit -m "feat: post exact idempotent partial refunds"
```

---

### Task 10: Add minimal after-sales UI, authorization and notifications

**Files:**
- Create: customer/admin return pages and views
- Modify: `src/client/components/admin/layout/AdminSidebar.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/server/modules/notifications/notifications.service.ts`
- Modify: `prisma/schema.prisma` and shared NotificationType
- Test: `tests/aftersales-authorization.test.ts`
- Test: `tests/integration/aftersales-e2e.test.ts`

**Interfaces:**
- Customer can list/read own cases only; `warranties` STAFF can operate workflow but cannot approve financial refund/override policy; ADMIN can override with audit.

- [ ] **Step 1: Write failing page/API/Pusher authorization matrix tests**

Customer A cannot access B case/evidence; STAFF permission matrix enforced; audit read/financial action ADMIN-only.

- [ ] **Step 2: Write failing end-to-end test**

One completed order → warranty path + partial return → quarantine → disposition → refund → notification/audit; replay produces no duplicate stock/money/event.

- [ ] **Step 3: Implement minimal pages, notifications and post-commit Pusher events**

Use event/outbox ID to prevent duplicate notification on retry; do not broadcast before DB commit.

- [ ] **Step 4: Run full M5–M6 gate and commit**

```bash
npm run verify
```

```bash
git add prisma src/app src/client src/server src/shared tests/aftersales-authorization.test.ts tests/integration/aftersales-e2e.test.ts
git commit -m "feat: expose guarded after-sales workflows"
```

## M5–M6 Exit Criteria

- [ ] Ledger and projection reconcile for every SKU.
- [ ] PO receipts and serialized units are idempotent/concurrency-safe.
- [ ] Device fulfillment is serial-gated.
- [ ] Audit is immutable, redacted and permissioned.
- [ ] Warranty/return FSMs and ownership rules pass.
- [ ] Return receipt never auto-restocks.
- [ ] Partial refund conservation/cap/replay tests pass.
- [ ] `npm run verify` and migration rehearsal pass.
