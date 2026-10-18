# Electronics Commerce Expansion Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển Shop QR Payment thành cửa hàng điện tử có catalog JSONB được kiểm soát, comparison/P/P có căn cứ, trợ lý AI grounded, và lifecycle kho/hậu mãi truy vết được trong đúng 34 Prisma models.

**Architecture:** Product/Variant tiếp tục là aggregate bán hàng; catalog biến đổi nhanh nằm trong validated JSONB, còn lifecycle/ledger/high-cardinality measurements dùng relational models. Các milestone tăng dần đến peak 36 trong M5 expand, retire bốn bảng legacy để còn 32, rồi kết thúc M6/M7 ở 34; automated budget gate ngăn schema vượt hard cap 40.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Prisma 6/PostgreSQL JSONB+GIN, Redis/Upstash, Pusher, Node native test runner, dependency-cruiser.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- Không redesign UI; chỉ bổ sung UI tối thiểu để dùng và kiểm chứng feature.
- `@client` không import `@server`/Prisma; `@shared` không phụ thuộc ngược.
- Đọc local Next.js 16 guide trước khi sửa route/page/cache/streaming.
- AI không tính hoặc mutate price/stock/sales/score/compatibility/domain state.
- Chỉ DataSource `ACTIVE` đúng product/variant/market/version tham gia production.
- VND dùng BigInt trong domain/DB và MoneyVnd decimal string ở JSON.
- Mọi movement/refund/receipt/recompute có idempotency key/fingerprint.
- **Registry đích đúng 34 Prisma models; ADR cần có khi vượt 34; target ceiling 37; hard cap 40.**
- Forbidden-model list trong spec không được xuất hiện; JSON domain phải validated/versioned/canonical và indexed khi query.
- Mỗi schema migration phải chạy `npm run schema:budget`, rehearsal và reconciliation.
- Không tuyên bố gate pass nếu chưa chạy và đọc output thật.

## Review Focus

- Expand/contract migration không vượt 37 models và không mất Transaction/CouponUsage/chat/stock history.
- JSONB filter chỉ dùng allowlisted path/operator/unit; malformed/stale schema version bị chặn.
- Source revoke loại evidence khỏi score/retrieval/cache ngay.
- Assistant không chấp nhận citation/numeric claim ngoài evidence hoặc leak conversation khác.
- Receipt/return/webhook replay không double stock/refund/serial assignment.

---

## Locked Model Registry và Budget

### Core sau compaction — 18

`User`, `StaffPermission`, `OtpCode`, `Product`, `ProductVariant`, `Order`, `BankTransfer`, `RefundCase`, `OrderItem`, `Coupon`, `Review`, `Wishlist`, `ChatRoom`, `Message`, `Notification`, `Shipment`, `UserWallet`, `WalletTransaction`.

### Catalog & intelligence — 8

`Brand`, `Category`, `DataSource`, `BenchmarkMeasurement`, `ProductScoreSnapshot`, `AssistantConversation`, `AssistantMessage`, `CompatibilityRule`.

### Operations & after-sales — 8

`Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `InventoryMovement`, `SerializedUnit`, `WarrantyClaim`, `ReturnRequest`, `AdminAuditLog`.

### Retirement map

- `StockAdjustment` → `InventoryMovement(ADJUST)`;
- `Transaction` → `BankTransfer(APPLIED_ORDER)`;
- `CouponUsage` → coupon claims on `Order` + CAS counters;
- `ChatRoomParticipant` → direct 1:1 fields on `ChatRoom`.

### Count progression

| Gate | Count | Assertion |
|---|---:|---|
| M0 | 22 | Current safety baseline |
| M1 | 25 | +Brand/Category/DataSource |
| M2 | 27 | +BenchmarkMeasurement/ProductScoreSnapshot |
| M3 | 29 | +AssistantConversation/AssistantMessage |
| M4 | 30 | +CompatibilityRule |
| M5 expand | 36 | +six operation models; peak <=37 |
| M5 contract | 32 | −four legacy models |
| M6 | 34 | +WarrantyClaim/ReturnRequest |
| M7 | 34 | No model additions |

---

## Dependency Graph

```text
M0 COMPLETE (22)
  └── M1 Catalog JSONB + provenance (25)
        ├── M2 Scoring/comparison (27)
        │     └── M3 Grounded assistant (29)
        │           └── M4 Compatibility (30)
        └── M5 Procurement/ledger/serial/audit + compaction (36→32)
              └── M6 Warranty/return/refund (34)
                    └── M7 hardening/data/docs (34)
```

| Plan | Deliverable | Entry condition | Exit count |
|---|---|---|---:|
| `2026-10-17-m0-commerce-safety-foundation.md` | Money/inventory/shipping safety seams | Complete | 22 |
| `2026-10-17-m1-electronics-catalog.md` | 10-product vertical slice, JSON catalog/provenance/order snapshots | M0 | 25 |
| `2026-10-17-m2-m4-commerce-intelligence.md` | Comparison/scoring/assistant/compatibility | M1 | 30 |
| `2026-10-17-m5-m6-operations-aftersales.md` | PO/ledger/serial/audit/compaction/warranty/returns | M1; shared contracts locked | 34 |
| `2026-10-17-m7-hardening-release.md` | 40–60 product models, reconciliation/eval/docs | M0–M6 | 34 |

## Execution Protocol

1. Thực thi trong isolated worktree theo project workflow.
2. Mỗi task: failing test → đúng failure → minimal implementation → targeted tests → budget/quality gate → commit.
3. Task schema phải review migration SQL, rollback, count transition và forbidden models.
4. Schema count assertion lấy từ parser/DMMF, không hard-code bằng tài liệu thủ công duy nhất.
5. Không gọi AI thật nếu chưa có transport docs, credentials và live budget approval.
6. Mỗi milestone cập nhật `docs/architecture/prisma-model-registry.md` bằng actual count.

## Milestone Gates

### Gate M1 — 25 models

- Category spec/scoring/warranty JSON được validate và version;
- Product specs/options/images JSON round-trip và JSON filter query đúng;
- DataSource lifecycle/provenance enforced;
- 10-product vertical slice + immutable OrderItem snapshots;
- Model registry exactly 25.

### Gate M2–M4 — 30 models

- Scores deterministic/immutable/coverage-aware;
- Comparison service là nguồn chung cho UI/API/assistant;
- Assistant grounding/ownership/quota/retention tests pass;
- Compatibility chỉ COMPATIBLE khi đủ predicates;
- Model counts M2=27, M3=29, M4=30.

### Gate M5–M6 — 34 models

- M5 expand peak exactly 36, never >37;
- Four legacy tables reconciled và dropped, M5 exit exactly 32;
- Movement/projection/PO/serial/audit pass concurrency tests;
- Warranty/return/refund pass ownership/conservation/replay;
- M6 exit exactly 34.

### Gate M7 — 34 models

- 40–60 means product models, not Prisma models;
- No migration creates a model;
- Import/reconciliation/eval/CI/docs traceability complete;
- Registry remains exactly 34 and hard cap gate passes.

## Cross-Plan Interfaces (Locked)

```ts
export type MoneyVnd = string;
export type KnowledgeState = 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';
export type EvidenceOrigin = 'SHOP' | 'EXTERNAL' | 'SYNTHETIC';
export type CompatibilityStatus = 'COMPATIBLE' | 'INCOMPATIBLE' | 'UNKNOWN';

export interface VersionedJson<T> {
  schemaVersion: number;
  value: T;
}

export interface MoneySnapshot {
  amount: MoneyVnd;
  currency: 'VND';
  revision: string;
}

export interface EvidenceRef {
  id: string;
  origin: EvidenceOrigin;
  label: string;
  sourceUrl: string | null;
  checkedAt: string;
  version: string;
}

export interface ScoreSnapshotDto {
  productId: string;
  variantId: string | null;
  useCase: string;
  status: 'SCORED' | 'INSUFFICIENT_DATA';
  score: number | null;
  confidence: number;
  coverage: number;
  price: MoneySnapshot;
  rubricVersion: string;
  calculatedAt: string;
  missingEvidence: string[];
}
```

## Master Completion Checklist

- [ ] M0 complete and its unresolved baseline failures recorded truthfully.
- [ ] M1 complete, model count 25.
- [ ] M2–M4 complete, model count progression 27→29→30.
- [ ] M5 expand peak 36, contract exit 32 with reconciliation evidence.
- [ ] M6 complete, final count 34.
- [ ] M7 complete without new model, count remains 34.
- [ ] `npm run verify`, `npx prisma validate`, `npm run schema:budget` pass.
- [ ] Migration rehearsal/rollback passes on disposable PostgreSQL.
- [ ] Spec-to-code traceability and model registry updated.
- [ ] Whole-branch code review and verification-before-completion performed.
