# M7 Hardening and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng dữ liệu lên 40–60 model có provenance, kiểm chứng toàn hệ thống bằng migration/eval/reconciliation, và đồng bộ tài liệu/demo với code thực tế.

**Architecture:** Release chỉ lấy dữ liệu từ manifest versioned và source ACTIVE; import, migration và seed đều idempotent. Online AI eval tách khỏi default suite và cần opt-in/budget; release evidence gồm test output, migration rehearsal, reconciliation, eval metrics và traceability spec→code.

**Tech Stack:** Existing stack + versioned catalog manifest, Node scripts, GitHub Actions nếu khả dụng, generated UML/docs.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- M0–M6 phải hoàn tất trước release candidate.
- 40–60 là số model, không phải số variant; gồm 10–15 laptop, 10–15 phone, 20–30 accessories.
- Không nhập source có license chưa rõ hoặc mapping mơ hồ vào scoring/RAG production.
- Amazon Reviews 2023 chưa được coi là licensed; UCI sentiment không được gán product; Open Icecat không dùng AI pipeline nếu chưa có commercial license.
- Synthetic records không được giả là dữ liệu thật hoặc sửa nội dung review thật.
- Default verification không gọi provider AI thật.
- Không công bố metric/claim chưa chạy và lưu evidence.
- Migration luôn rehearsal trên clone, backup/rollback và reconcile money/inventory.

## Review Focus

- Import replay không overwrite stock/order/serial hoặc nhân đôi source/variant.
- Revoked source biến mất khỏi scoring/retrieval sau import/cache refresh.
- Migration failure giữa chừng rollback, không để schema/data nửa vời.
- Reconciliation phát hiện lệch movement/balance/refund thay vì tự sửa âm thầm.
- Docs/demo không gọi synthetic là thật hoặc claim provider feature chưa tích hợp.

---

### Task 1: Build a versioned, license-gated catalog manifest and importer

**Files:**
- Create: `prisma/data/electronics-catalog.json`
- Create: `prisma/data/electronics-catalog.schema.json`
- Create: `scripts/import-electronics-catalog.ts`
- Create: `docs/data/electronics-catalog-sources.md`
- Test: `tests/catalog-import.test.ts`
- Test: `tests/integration/catalog-import.test.ts`

**Interfaces:**

```ts
export async function importElectronicsCatalog(db: PrismaClient, manifest: CatalogManifest, options: {demoMode: boolean; dryRun: boolean}): Promise<ImportReport>;
```

- [ ] **Step 1: Write failing manifest/schema tests**

Assert stable brand/model/market/variant IDs, exact source/license/checkedAt/checksum/version, category-required attributes, unique SKU, origin label and no production ACTIVE synthetic source.

- [ ] **Step 2: Write failing import idempotency tests**

Import twice stable counts; changed source checksum returns review-required; revoked source excluded; ambiguous variant/region quarantined; existing order/stock/serial unchanged.

- [ ] **Step 3: Verify fail, implement dry-run and transactional importer**

Dry-run lists create/update/quarantine/no-op. Never activate source based solely on manifest text; require approval record already authorized or explicit ADMIN review workflow.

- [ ] **Step 4: Populate 40–60 model manifest**

Meet category ranges; missing review/benchmark allowed with INSUFFICIENT_DATA. Use only sources whose reuse status is recorded; local/owned demo content marked SYNTHETIC.

- [ ] **Step 5: Run tests and commit**

```bash
git add prisma/data scripts/import-electronics-catalog.ts docs/data/electronics-catalog-sources.md tests/catalog-import.test.ts tests/integration/catalog-import.test.ts
git commit -m "feat: import versioned electronics catalog"
```

---

### Task 2: Reconcile inventory, money and serialized units

**Files:**
- Create: `scripts/reconcile-inventory.ts`
- Create: `scripts/reconcile-money.ts`
- Create: `src/server/modules/admin/reconciliation-report.service.ts`
- Test: `tests/reconciliation-reports.test.ts`
- Test: `tests/integration/release-rehearsal.test.ts`

**Interfaces:**

```ts
reconcileInventory(db, options:{repair:false}): Promise<InventoryReconciliationReport>;
reconcileMoney(db): Promise<MoneyReconciliationReport>;
```

- [ ] **Step 1: Write failing corruption-detection tests**

Detect movement sum != balance, projection mismatch, serial status/order mismatch, reserved > onHand, paid/refunded totals above entitlement, wallet ledger sum mismatch and duplicate operation references.

- [ ] **Step 2: Verify fail, implement read-only reports**

Default never repairs. Report IDs/reasons/counts without secrets/PII. Any repair mode is a separate future reviewed operation, not included now.

- [ ] **Step 3: Add release rehearsal integration test**

Apply migrations/import to disposable clone; inject failure mid-migration/import and assert rollback; compare User/order/wallet/transaction counts and BigInt sums before/after.

- [ ] **Step 4: Run tests and commit**

```bash
git add scripts/reconcile-inventory.ts scripts/reconcile-money.ts src/server/modules/admin/reconciliation-report.service.ts tests/reconciliation-reports.test.ts tests/integration/release-rehearsal.test.ts
git commit -m "test: reconcile release money and inventory"
```

---

### Task 3: Add reproducible offline and opt-in online AI evaluation

**Files:**
- Modify: `scripts/eval-assistant.ts`
- Create: `scripts/eval-commerce-intelligence.ts`
- Modify: `tests/assistant-eval.test.ts`
- Create: `docs/verification/commerce-intelligence-eval.md`
- Modify: `package.json`

**Interfaces:**
- `npm run eval:assistant` is offline/fake, no network.
- `npm run eval:assistant:online -- --budget-usd=<value>` requires explicit env flag/provider configuration and refuses absent budget.

- [ ] **Step 1: Write failing runner safety tests**

Online mode without budget/provider docs/config exits before request; secret never printed; default uses fake; held-out split immutable; results include prompt/model/source/rubric versions.

- [ ] **Step 2: Implement runner and report format**

Metrics: source/retrieval accuracy, numeric exactness, citation precision, grounded claim rate, abstention, follow-up relevance, latency and cost/completed answer.

- [ ] **Step 3: Run offline evaluation**

Record actual metrics. Do not claim real model quality.

- [ ] **Step 4: If provider transport is unblocked, ask for explicit live spend approval before online run**

If still blocked, report it as blocked and continue release without fabricated online metric.

- [ ] **Step 5: Commit**

```bash
git add scripts/eval-commerce-intelligence.ts scripts/eval-assistant.ts tests/assistant-eval.test.ts docs/verification/commerce-intelligence-eval.md package.json
git commit -m "test: make assistant evaluation reproducible"
```

---

### Task 4: Replace unsafe demo seed behavior and create end-to-end fixtures through services

**Files:**
- Modify: `prisma/seed-demo-data.ts`
- Create: `prisma/seed-electronics-demo.ts`
- Test: `tests/demo-seed.test.ts`
- Test: integration demo seed test

**Interfaces:**
- Seed uses public/domain services where feasible and stable synthetic IDs; never rewrites existing human review text.

- [ ] **Step 1: Write failing seed safety tests**

Two runs stable; real review/order untouched; all generated rows synthetic; synthetic excluded from production scoring by default; completed demo order has legitimate OrderItem snapshots and serialized units; warranty/return events valid.

- [ ] **Step 2: Verify fail and remove historical review rewrite**

- [ ] **Step 3: Implement idempotent demo workflow**

Create demo source/catalog/order/payment/shipment/serial/warranty/return/refund through owning services or exact domain fixtures, with explicit demo mode.

- [ ] **Step 4: Run twice on disposable DB and commit**

```bash
git add prisma/seed-demo-data.ts prisma/seed-electronics-demo.ts tests/demo-seed.test.ts tests/integration
git commit -m "fix: isolate synthetic electronics demo data"
```

---

### Task 5: Add CI quality gates and release evidence archive

**Files:**
- Create/Modify: `.github/workflows/quality.yml`
- Create: `docs/verification/2026-10-17-release-candidate.md`
- Modify: `package.json`

**Interfaces:**
- CI unit/lint/arch/build always; integration job uses ephemeral PostgreSQL and migrations; no cloud provider secrets or online AI tests.

- [ ] **Step 1: Add workflow test/static/integration jobs**

Cache dependencies safely; service PostgreSQL isolated; run `npx prisma migrate deploy`, unit/integration/lint/arch/build. Upload test/reconciliation reports without PII.

- [ ] **Step 2: Validate workflow syntax and run local equivalent**

```bash
npm run verify
```

Expected PASS.

- [ ] **Step 3: Create release evidence template with exact commits/commands/results**

No pre-filled “PASS”. Populate only from actual runs.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/quality.yml docs/verification/2026-10-17-release-candidate.md package.json
git commit -m "ci: gate electronics release quality"
```

---

### Task 6: Update installation, architecture, UML, report and defense demo

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/README.md`
- Modify: `docs/academic/HUONG_DAN_DONG_GOI_VA_CAI_DAT.md`
- Modify: `docs/academic/KICH_BAN_DEMO_VA_VAN_DAP_BAO_CAO.md`
- Modify: `docs/academic/BAN_THAO_BAO_CAO_DACS2.md`
- Modify: `scripts/generate-uml.js`
- Regenerate: `docs/uml/`
- Test: `tests/documentation-links.test.ts`

**Interfaces:**
- Docs distinguish SHOP/EXTERNAL/SYNTHETIC, source lifecycle and blocked provider state; `.env.example` placeholders only.

- [ ] **Step 1: Write failing doc consistency/link test**

Assert referenced scripts/routes/files exist, test counts are not hard-coded stale claims, no real secrets, AI/provider claims match implementation, diagrams index links resolve.

- [ ] **Step 2: Update docs from verified code/evidence**

Explain architecture, MoneyVnd, ledger/FSM/scoring/RAG distinction, source license limits, retention and known limitations.

- [ ] **Step 3: Regenerate UML**

```bash
npm run docs:uml
```

Expected generator succeeds and diagrams cover catalog/intelligence/inventory/warranty/return.

- [ ] **Step 4: Perform fresh-install/demo walkthrough on disposable environment**

Flow: filter → compare/P/P → grounded assistant/fallback → compatibility → checkout → payment → serial fulfillment → warranty → partial return/refund → audit. Record actual results.

- [ ] **Step 5: Run tests/build and commit**

```bash
git add README.md .env.example docs scripts/generate-uml.js tests/documentation-links.test.ts
git commit -m "docs: align electronics architecture and defense demo"
```

---

### Task 7: Final release verification and traceability review

**Files:**
- Modify: `docs/verification/2026-10-17-release-candidate.md`
- Create: `docs/verification/electronics-spec-traceability.md`

**Interfaces:**
- Traceability maps each approved spec section → task/commit → tests → evidence.

- [ ] **Step 1: Run complete verification on release candidate**

```bash
npm run verify
```

```bash
npx prisma validate
```

```bash
npx prisma migrate status
```

Run importer dry-run and reconciliation scripts; expected zero critical discrepancies.

- [ ] **Step 2: Rehearse backup/migrate/import/rollback on disposable production-like clone**

Expected users/wallet/orders/financial sums preserved exactly; no fake legacy fields.

- [ ] **Step 3: Complete traceability and evidence with actual output**

List skipped/blocked steps explicitly, especially real provider adapter/online eval.

- [ ] **Step 4: Request whole-branch review**

Use `superpowers:requesting-code-review`; address findings with `superpowers:receiving-code-review`.

- [ ] **Step 5: Run verification-before-completion**

Use `superpowers:verification-before-completion`; rerun required checks after fixes.

- [ ] **Step 6: Commit evidence**

```bash
git add docs/verification
git commit -m "docs: record electronics release evidence"
```

## M7 Exit Criteria

- [ ] Catalog contains 40–60 models in approved ranges with provenance.
- [ ] Source license/mapping gate is enforced; revoked evidence absent.
- [ ] Inventory/money/serial reconciliation clean.
- [ ] Offline eval metrics stored; online result present only if actually run with approval.
- [ ] Demo seed idempotent and synthetic-safe.
- [ ] CI/full local quality gates pass.
- [ ] Docs/UML/demo match implementation and limitations.
- [ ] Migration/rollback rehearsal and spec traceability complete.
