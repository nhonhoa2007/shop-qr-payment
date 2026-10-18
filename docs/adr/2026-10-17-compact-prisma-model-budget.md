# Architecture Decision Record: Compact Prisma Model Budget & Schema Boundaries

- **Status:** APPROVED & LOCKED
- **Date:** 2026-10-17 / 2026-10-18
- **Context:** Milestone 7 (Hardening, Verification & Release)
- **Deciders:** Architecture Team, Engineering Lead
- **Technical Constraints:** Hard Cap = 40 models, Target Ceiling = 37 models, Final Locked Budget = 34 models.

---

## 1. Context and Problem Statement

As the electronics commerce intelligence platform expanded from basic shopping (M0) through specifications (M1), scoring (M2), AI conversations (M3), compatibility engine (M4), procurement/serialization (M5), and warranty/returns (M6), naive relational modeling would have exploded the schema past 60–80 tables.

In enterprise relational architectures, patterns like Entity-Attribute-Value (EAV), fragmented option tables, per-rubric scoring tables, and separate operational event logs cause:
1. Massive join penalties across catalog and checkout queries.
2. Migrations that lock tables and degrade availability.
3. High cognitive overhead and leaky domain boundaries.

We required an immutable model budget enforcement mechanism to maintain high performance, strict ACID guarantees on financial and inventory flows, and zero database bloat.

---

## 2. Decision: Compact-Schema Architecture with JSONB Bounded Documents

We locked the database schema to **exactly 34 Prisma models** partitioned into three coherent bounded domains:
1. **Core Commerce & Account (18 models):**
   `User`, `StaffPermission`, `OtpCode`, `Product`, `ProductVariant`, `Order`, `BankTransfer`, `RefundCase`, `OrderItem`, `Coupon`, `Review`, `Wishlist`, `ChatRoom`, `Message`, `Notification`, `Shipment`, `UserWallet`, `WalletTransaction`.
2. **Catalog & Intelligence (8 models):**
   `Brand`, `Category`, `DataSource`, `BenchmarkMeasurement`, `ProductScoreSnapshot`, `AssistantConversation`, `AssistantMessage`, `CompatibilityRule`.
3. **Operations & After-Sales (8 models):**
   `InventoryMovement`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `SerializedUnit`, `AdminAuditLog`, `WarrantyClaim`, `ReturnRequest`.

### JSON-vs-Relational Decision Matrix

| Dimension | Keep Relational Model | Embed in JSONB Column |
|---|---|---|
| **Identity & Foreign Keys** | Aggregate roots (`Product`, `Order`, `User`) | Child fragments without independent lifecycle (`specs`, `optionValues`, `images`) |
| **ACID & Concurrency** | Balances, stock reservations, financial transactions | Frozen audit snapshots, rubric weights, rule conditions |
| **High Cardinality Lookups** | Filterable indexed properties (`sku`, `brandId`, `categoryId`, `price`) | Category-specific hierarchical technical specifications |
| **Append-Only Auditing** | `InventoryMovement`, `WalletTransaction`, `AdminAuditLog` | Structured reason codes, evidence URIs, timeline arrays |
| **Query Frequency** | Main listing and checkout queries | Secondary views (deep inspection, compatibility notes) |

---

## 3. Peak M5 Count & Legacy Model Retirement Evidence

During Milestone 5 (Procurement & Serialization), the schema expanded to a peak of **36 models** with the addition of procurement and serialization models.

To respect the target ceiling (<37) and preserve architectural cleanliness, four redundant legacy models were formally consolidated and dropped during the M5 contraction phase:
1. `StockAdjustment` (RETIRED) -> Consolidated into `InventoryMovement` with `kind = ADJUST` and atomic compare-and-swap balance updates.
2. `Transaction` (RETIRED) -> Consolidated into `BankTransfer` with `status = APPLIED_ORDER` and idempotent VietQR transaction tracking.
3. `CouponUsage` (RETIRED) -> Consolidated into `Order.couponId`, `Order.userId`, and `Order.usageClaimedAt` with transactional uniqueness.
4. `ChatRoomParticipant` (RETIRED) -> Consolidated into direct 1:1 references on `ChatRoom` (`customerId`, `assignedStaffId`).

Following M5 exit (32 models), Milestone 6 added exactly 2 models (`WarrantyClaim` and `ReturnRequest`), reaching the final 34 models.

---

## 4. Milestone 7 Hardening Rules & Invariants

1. **Zero New Prisma Models in M7:**
   Milestone 7 imports 40–60 electronics product models via the versioned catalog manifest. These are product entities (rows in `Product`), **not database tables**. The schema remains locked at 34 models.
2. **Schema Budget Gate:**
   `npm run schema:budget -- --expected=34 --lock-registry` is enforced in local development, git hooks, and CI quality workflows. Any addition of a 35th model immediately fails the build.
3. **Forbidden Models Protection:**
   The 24 candidate model names identified in `FORBIDDEN_MODELS` (including EAV tables, separate image tables, and duplicate refund ledgers) are permanently barred.
4. **Read-Only Reconciliation:**
   Inventory and financial reconciliation scripts inspect discrepancies without silent writes.

---

## 5. Consequences and Trade-offs

- **Positive:**
  - Fast query execution with zero N+1 joins on complex product specifications.
  - Transparent auditing through compact immutable ledgers (`InventoryMovement`, `WalletTransaction`).
  - Total CI verification time remains low (<60s).
- **Negative / Mitigations:**
  - JSON payload validation cannot rely solely on database types; must be enforced by Zod / domain service guards at application boundaries.
  - JSON indexing requires PostgreSQL GIN indexes for query performance on nested fields where necessary.
