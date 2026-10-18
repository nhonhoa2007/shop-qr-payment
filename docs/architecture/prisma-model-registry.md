# Prisma Model Registry and Database Budget

This registry tracks all Prisma models across project milestones in accordance with the database budget rules defined in `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md` (Section 3 and Section 4).

## 1. Budget Rules

- **Hard Cap:** `40 models` — exceeding 40 is a spec violation; CI and `npm run schema:budget` must fail.
- **Design Target Ceiling:** `37 models` — maximum design buffer, allowed only after ADR and architecture review.
- **Milestone Target Counts:**
  - **M0 Current Baseline:** 22 models
  - **M1 Catalog & Specifications:** 25 models (+ `Brand`, `Category`, `DataSource`)
  - **M2 Benchmarks & Scoring:** 27 models (+ `BenchmarkMeasurement`, `ProductScoreSnapshot`)
  - **M3 Assistant Conversation:** 29 models (+ `AssistantConversation`, `AssistantMessage`)
  - **M4 Compatibility Rules:** 30 models (+ `CompatibilityRule`)
  - **M5 Operations & Procurement (Expand):** 36 models peak (+ `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `InventoryMovement`, `SerializedUnit`, `AdminAuditLog`)
  - **M5 Operations & Procurement (Contract):** 32 models exit (− `StockAdjustment`, `Transaction`, `CouponUsage`, `ChatRoomParticipant`)
  - **M6 Aftersales & RMA:** 34 models final (+ `WarrantyClaim`, `ReturnRequest`)
  - **M7 Hardening & Release:** 34 models final (zero added models)

---

## 2. Active Registry (M1 Catalog — 25 Models)

<!-- REGISTRY_MODELS_START -->
| # | Model | Status | Milestone | Role / Description |
|---:|---|---|---|---|
| 1 | `User` | ACTIVE | M0 | Customer, Staff, and Admin identity |
| 2 | `StaffPermission` | ACTIVE | M0 | Granular staff RBAC permission matrix |
| 3 | `OtpCode` | ACTIVE | M0 | Transactional OTP registration and password reset |
| 4 | `Product` | ACTIVE | M0 | Product aggregate root and catalog metadata |
| 5 | `ProductVariant` | ACTIVE | M0 | SKU, price, variant stock, and option dimensions |
| 6 | `StockAdjustment` | TRANSITIONAL | M0 (Retire M5) | Stock adjustment history; to be merged into InventoryMovement |
| 7 | `Order` | ACTIVE | M0 | Order aggregate, state machine, payment, fulfillment |
| 8 | `BankTransfer` | ACTIVE | M0 | VietQR / Casso webhook transactions and reconciliation |
| 9 | `RefundCase` | ACTIVE | M0 | Order refund operations with idempotent source keys |
| 10 | `OrderItem` | ACTIVE | M0 (Updated M1) | Order line items with frozen commercial, warranty, and packing snapshots |
| 11 | `Coupon` | ACTIVE | M0 | Discount voucher policies and usage constraints |
| 12 | `CouponUsage` | TRANSITIONAL | M0 (Retire M5) | Coupon usage counter; to be absorbed into Order claim fields |
| 13 | `Review` | ACTIVE | M0 | Verified purchaser product reviews and ratings |
| 14 | `Wishlist` | ACTIVE | M0 | Customer bookmarked items |
| 15 | `Transaction` | TRANSITIONAL | M0 (Retire M5) | Legacy payment ledger; to be consolidated into BankTransfer |
| 16 | `ChatRoom` | ACTIVE | M0 | Support chat sessions between buyer and assigned staff |
| 17 | `ChatRoomParticipant` | TRANSITIONAL | M0 (Retire M5) | Chat participant join table; to be flattened into ChatRoom |
| 18 | `Message` | ACTIVE | M0 | Realtime human-to-human support chat messages |
| 19 | `Notification` | ACTIVE | M0 | In-app user notifications |
| 20 | `Shipment` | ACTIVE | M0 | GHN shipping waybills and delivery lifecycle |
| 21 | `UserWallet` | ACTIVE | M0 | Internal customer wallet balance projection |
| 22 | `WalletTransaction` | ACTIVE | M0 | Internal customer wallet double-entry ledger |
| 23 | `Brand` | ACTIVE | M1 | Electronics brand / manufacturer |
| 24 | `Category` | ACTIVE | M1 | Category hierarchy with versioned spec/scoring/warranty schemas |
| 25 | `DataSource` | ACTIVE | M1 | Unified provenance, licensing, and approved evidence payload |
<!-- REGISTRY_MODELS_END -->

---

## 3. Four Legacy Models Scheduled for Consolidation (M5)

| Legacy Model | Target Replacement | Milestone | Consolidation Strategy |
|---|---|---|---|
| `StockAdjustment` | `InventoryMovement(kind=ADJUST)` | M5 | Backfill via `operationKey`, reconcile inventory delta, redirect writers, drop table. |
| `Transaction` | `BankTransfer(status=APPLIED_ORDER)` | M5 | Backfill bank transaction fingerprint, update all readers, drop table. |
| `CouponUsage` | `Order.couponId` / `userId` / `usageClaimedAt` | M5 | Enforce unique order claim within transaction, reconcile counts, drop table. |
| `ChatRoomParticipant` | `ChatRoom.customerId` / `assignedStaffId` | M5 | Constrain chat rooms to 1:1 buyer-staff model, backfill direct IDs, drop table. |

---

## 4. Compact-Schema Forbidden Model List

The following 24 candidate model names are strictly **FORBIDDEN** from being created as Prisma models. Instead, bounded, versioned, validated JSON columns (with GIN indexes where required) or existing ledger models must be used:

1. **EAV Child Tables:**
   - `AttributeDefinition` (use `Category.specSchema Json`)
   - `CategoryAttribute` (use `Category.specSchema Json`)
   - `ProductAttributeValue` (use `Product.specs Json`)

2. **Option / Image Child Tables:**
   - `ProductOptionDefinition` (use `Category.specSchema Json`)
   - `ProductOptionValue` (use `ProductVariant.optionValues Json`)
   - `ProductImage` (use `Product.images Json` / `ProductVariant.images Json`)

3. **Source Fragmentation:**
   - `ProductSource` (use unified `DataSource` model)
   - `ExternalReviewSource` (use unified `DataSource` model)
   - `BenchmarkSource` (use unified `DataSource` model)

4. **Raw Review Decomposition:**
   - `ExternalReview` (use `DataSource` approved payload JSON)
   - `ReviewAspectSignal` (use `DataSource` approved payload JSON)

5. **Rubric / Citation / Usage Child Tables:**
   - `ScoringRubric` (use `Category.scoringConfig Json`)
   - `Citation` (use `AssistantMessage.citations Json`)
   - `AssistantUsage` (use `AssistantMessage.usage Json` + Redis token quota)

6. **Materialized Compatibility:**
   - `CompatibilityAssertion` (use `CompatibilityRule` evaluated on demand)

7. **Procurement Duplication:**
   - `GoodsReceipt` (use `InventoryMovement(kind=RECEIPT)`)
   - `GoodsReceiptItem` (use `InventoryMovement(kind=RECEIPT)`)

8. **Duplicate Stock Store:**
   - `InventoryBalance` (use `ProductVariant.stock` projection + `InventoryMovement` ledger)

9. **Serial Child Identifier:**
   - `SerializedUnitIdentifier` (use direct columns on `SerializedUnit`)

10. **Policy / Event / Item Fragmentation:**
    - `WarrantyPolicy` (use `Category.warrantyConfig Json`)
    - `WarrantyEvent` (use `WarrantyClaim.timeline Json`)
    - `ReturnItem` (use `ReturnRequest.items Json`)
    - `ReturnEvent` (use `ReturnRequest.timeline Json`)

11. **Duplicate Refund Ledger:**
    - `RefundOperation` (use existing `RefundCase` + `WalletTransaction` / BankTransfer)
