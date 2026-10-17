# Electronics Commerce Expansion Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển Shop QR Payment thành cửa hàng điện tử có catalog cấu trúc, so sánh/P/P có căn cứ, trợ lý AI được grounding, kho nhập hàng và hậu mãi có thể truy vết mà không làm yếu các bất biến tiền–kho hiện tại.

**Architecture:** Triển khai theo chuỗi M0–M7 với các contract ổn định giữa catalog, scoring, assistant, inventory và after-sales. Mỗi workstream có plan riêng, tạo ra phần mềm chạy được và quality gate độc lập; workstream sau chỉ bắt đầu khi exit criteria của workstream trước đã đạt.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Prisma 6/PostgreSQL, Redis/Upstash, Zustand, Pusher, Node native test runner, dependency-cruiser.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- Không redesign UI; chỉ bổ sung UI tối thiểu để sử dụng và kiểm chứng feature.
- Không chuyển thành marketplace đa người bán.
- `@client` không import `@server` hoặc `@prisma/client`; `@shared` không phụ thuộc ngược client/server.
- Đọc guide phù hợp trong `node_modules/next/dist/docs/` trước mỗi thay đổi Next.js.
- Mọi giá/tồn/doanh số/quyền được backend quyết định; AI không phải nguồn sự thật và không được mutate domain state.
- Model cấu hình mặc định là `ag/gemini-3.8-flash-high`; transport thật bị block cho đến khi có tài liệu endpoint/request mẫu.
- Chỉ nguồn `ACTIVE` đã qua license review mới tham gia scoring/retrieval production.
- External, internal và synthetic review không được trộn provenance hoặc nhãn.
- Tiền VND được migrate thống nhất sang BigInt; không dùng JavaScript `number` cho amount domain sau migration.
- Mọi movement/refund/receipt/recompute nhạy cảm phải idempotent bằng operation key hoặc source/version key duy nhất.
- Bảo tồn User, wallet, orders và lịch sử tài chính; migration dùng maintenance window có backup/rehearsal/rollback.
- Chưa chạy quality gate thì không được tuyên bố feature hoàn tất.

## Review Focus

- Hai request wallet payment/expiry đồng thời phải chỉ tạo một kết quả tài chính và không double debit.
- SKU điện tử có tất cả variant inactive không được quay lại đường bán base product.
- Mapping review/benchmark mơ hồ hoặc license bị revoke phải bị loại khỏi score/retrieval ngay.
- Assistant phải từ chối claim số học/citation không có trong evidence bundle và không leak dữ liệu hội thoại người khác.
- Return/receipt/webhook replay phải không double refund, double restock hoặc tạo trùng serial.

---

## Plan Set và Dependency Graph

```text
M0 Safety foundation
  └── M1 Electronics catalog vertical slice
        └── M2 Comparison & scoring
              └── M3 Assistant
                    └── M4 Compatibility
        └── M5 Procurement, inventory ledger & audit
              └── M6 Warranty & returns
                    └── M7 Hardening, data expansion & defense docs
```

| Thứ tự | Plan | Deliverable độc lập | Điều kiện bắt đầu |
|---|---|---|---|
| 1 | `2026-10-17-m0-commerce-safety-foundation.md` | Tiền, wallet, kho biến thể và vận chuyển an toàn cho thiết bị giá trị cao | Worktree sạch, baseline được ghi nhận |
| 2 | `2026-10-17-m1-electronics-catalog.md` | Vertical slice 2 laptop + 2 điện thoại + 6 phụ kiện, catalog cấu trúc và provenance | M0 pass toàn bộ gate |
| 3 | `2026-10-17-m2-m4-commerce-intelligence.md` | Comparison, scoring, assistant provider-neutral và compatibility engine | M1 schema/API ổn định |
| 4 | `2026-10-17-m5-m6-operations-aftersales.md` | Supplier/PO/ledger/serial/audit, warranty và partial return/refund | M0 + M1; procurement/ledger có thể triển khai song song với M2–M4 sau khi shared contracts được khóa |
| 5 | `2026-10-17-m7-hardening-release.md` | 40–60 model, migration rehearsal, eval online, UML/report/demo | M0–M6 hoàn tất |

## Execution Protocol

1. Không implement trực tiếp trên checkout hiện có vì đang có nhiều thay đổi chưa commit.
2. Khi bắt đầu thực thi, dùng `superpowers:using-git-worktrees` để tạo isolated worktree từ baseline mà người dùng chọn.
3. Mỗi task tuân thủ TDD: failing test → xác nhận fail đúng lý do → minimal implementation → targeted test → quality gate liên quan → commit.
4. Mỗi task được review trước khi task tiếp theo bắt đầu; task schema/migration và transaction cần reviewer chú trọng rollback/idempotency.
5. Không chạy eval gọi model thật nếu chưa có phê duyệt ngân sách và provider credentials; unit test dùng fake adapter.
6. Nếu actual provider thiếu structured output/streaming/usage, cập nhật adapter plan nhưng không đổi domain contract.

## Milestone Gates

### Gate M0

- Wallet payment CAS và payment-vs-expiry integration tests pass.
- Amount BigInt migration rehearsal/rollback pass trên database clone.
- Base/variant inventory mode không còn ambiguous; admin không overwrite reservation.
- Quote và fulfillment dùng cùng packing snapshot; high-value order vào manual review đúng policy.
- `npm run test`, `npm run test:integration`, lint, arch, build pass.

### Gate M1

- 10 model vertical slice có brand/category/typed attributes/options/images/sources.
- Search/filter/sort/detail hoạt động với effective SKU price.
- Legacy products còn đọc được nhưng không giả dữ liệu mới.
- Checkout/order snapshots vẫn đúng sau schema migration.

### Gate M2–M4

- Score deterministic, versioned, coverage/confidence rõ và abstain khi thiếu data.
- Comparison dùng một service chung cho API/UI/assistant.
- Assistant không có unsupported claim trong offline eval; provider thật vẫn có thể block.
- Compatibility chỉ trả `COMPATIBLE` khi rule đủ bằng chứng; còn lại `INCOMPATIBLE` hoặc `UNKNOWN` có lý do.

### Gate M5–M6

- Inventory movement/receipt/return replay không lệch balance.
- Laptop/phone không fulfillment nếu chưa gán serial/IMEI, trừ luồng legacy có audit.
- Warranty/return FSM chặn transition sai và kiểm tra ownership.
- Partial refund allocation có conservation invariant và cumulative cap.

### Gate M7

- 40–60 model đạt data coverage được công bố; nguồn ngoài có hồ sơ license.
- Online eval có cost report và kết quả được lưu; không có claim “AI chính xác nhất” nếu metric không chứng minh.
- Backup/migrate/rollback rehearsal và data reconciliation pass.
- README, UML, báo cáo học thuật, seed demo và kịch bản bảo vệ phản ánh đúng code.

## Cross-Plan Interfaces (Locked)

Các tên sau là contract giữa các plan; thay đổi phải cập nhật tất cả plan phụ trước khi implement tiếp:

```ts
export type MoneyVnd = string; // decimal integer JSON representation
export type DataAvailability = 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'UNKNOWN';
export type EvidenceOrigin = 'SHOP' | 'EXTERNAL' | 'SYNTHETIC';
export type CompatibilityStatus = 'COMPATIBLE' | 'INCOMPATIBLE' | 'UNKNOWN';

export interface MoneySnapshot {
  amount: MoneyVnd;
  currency: 'VND';
  revision: string;
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

export interface EvidenceRef {
  id: string;
  origin: EvidenceOrigin;
  label: string;
  sourceUrl: string | null;
  checkedAt: string;
}
```

## Master Completion Checklist

- [ ] M0 plan complete and gate passed.
- [ ] M1 plan complete and gate passed.
- [ ] M2–M4 plan complete and gate passed.
- [ ] M5–M6 plan complete and gate passed.
- [ ] M7 plan complete and release evidence archived.
- [ ] Run full verification: `npm run test && npm run test:integration && npm run lint && npm run arch:check && npm run build`.
- [ ] Run `npx prisma validate` and migration rehearsal against a disposable PostgreSQL clone.
- [ ] Review spec-to-code traceability and update documentation.
- [ ] Use `superpowers:requesting-code-review` for whole-branch review.
- [ ] Use `superpowers:verification-before-completion` before any completion claim.
- [ ] Use `superpowers:finishing-a-development-branch` to decide integration.
