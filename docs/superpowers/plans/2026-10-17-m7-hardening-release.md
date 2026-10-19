# M7 Hardening and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng catalog lên 40–60 product models, kiểm chứng migration/eval/reconciliation và phát hành mà giữ nguyên đúng 34 Prisma models.

**Architecture:** Release data đi qua versioned manifest và M1/M2 services; M7 không tạo database model. Reconciliation là read-only mặc định; online AI eval opt-in và có budget; release evidence bao gồm model registry, test/migration outputs và traceability spec→code.

**Tech Stack:** Existing stack, JSON manifest/schema, Node scripts, CI PostgreSQL service, generated UML/docs.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- M0–M6 hoàn tất và entry schema đúng 34 models.
- M7 **không được thêm Prisma model**; mọi migration chỉ index/constraint/field correction có review.
- 40–60 là số product models, không phải Prisma models hay variants.
- Không nhập nguồn license/mapping mơ hồ vào production score/RAG.
- Amazon Reviews 2023 chưa mặc định licensed; UCI chỉ eval; Open Icecat không vào AI pipeline nếu chưa có quyền.
- Synthetic không giả dữ liệu thật và mặc định bị loại production scoring.
- Default verify không gọi provider thật.
- Không công bố metric chưa chạy/lưu evidence.
- Migration rehearsal trên clone với backup/rollback/reconcile.

## Review Focus

- Import replay không overwrite stock/order/serial hoặc duplicate source/SKU.
- Schema diff M7 không có `model` addition và registry vẫn đúng 34.
- Revoked source bị loại sau import/cache refresh.
- Reconciliation phát hiện mismatch thay vì tự sửa âm thầm.
- Docs/demo không nhầm product model count với database table count.

---

### Task 1: Lock the final 34-model schema registry

**Files:**
- Modify: `scripts/check-prisma-model-budget.mjs`
- Modify: `docs/architecture/prisma-model-registry.md`
- Create: `tests/final-prisma-model-registry.test.ts`
- Create: `docs/adr/2026-10-17-compact-prisma-model-budget.md`

**Interfaces:**
- `npm run schema:budget -- --expected=34 --lock-registry` fails on any added/removed/renamed model or forbidden name.

- [ ] **Step 1: Write failing exact-registry tests**

Assert exact 34 names grouped 18 core + 8 intelligence + 8 operations; hard cap 40; target ceiling 37; forbidden list absent.

- [ ] **Step 2: Implement lock mode and ADR**

ADR documents JSON-vs-relational criteria, peak M5 count and model retirement evidence.

- [ ] **Step 3: Run gate and commit**

```bash
npm run schema:budget -- --expected=34 --lock-registry
```

```bash
git add scripts/check-prisma-model-budget.mjs docs/architecture/prisma-model-registry.md docs/adr tests/final-prisma-model-registry.test.ts
git commit -m "docs: lock compact Prisma model registry"
```

---

### Task 2: Build versioned license-gated catalog manifest/importer

**Files:**
- Create: `prisma/data/electronics-catalog.json`
- Create: `prisma/data/electronics-catalog.schema.json`
- Create: `scripts/import-electronics-catalog.ts`
- Create: `docs/data/electronics-catalog-sources.md`
- Test: `tests/catalog-import.test.ts`
- Test: `tests/integration/catalog-import.test.ts`

**Interfaces:**

```ts
export async function importElectronicsCatalog(db: PrismaClient, manifest: CatalogManifest, options: { demoMode: boolean; dryRun: boolean }): Promise<ImportReport>;
```

- [ ] **Step 1: Write manifest/JSON contract tests**

Stable brand/product/market/variant IDs, valid category schema versions/specs/options, exact source/license/checksum, unique SKU and explicit origin.

- [ ] **Step 2: Write import idempotency/isolation tests**

Two imports stable; checksum change returns review-required; revoked excluded; ambiguous mapping quarantined; existing order/stock/serial unchanged.

- [ ] **Step 3: Implement dry-run and transactional importer via domain services**

Never activate source solely from manifest text.

- [ ] **Step 4: Populate 40–60 product models**

10–15 laptops, 10–15 phones, 20–30 accessories; missing evidence yields INSUFFICIENT_DATA.

- [ ] **Step 5: Verify model registry unchanged and commit**

```bash
npm run schema:budget -- --expected=34 --lock-registry
```

```bash
git add prisma/data scripts/import-electronics-catalog.ts docs/data tests/catalog-import.test.ts tests/integration/catalog-import.test.ts
git commit -m "feat: import versioned electronics catalog"
```

---

### Task 3: Reconcile inventory, money and serialized units

**Files:**
- Create: `scripts/reconcile-inventory.ts`
- Create: `scripts/reconcile-money.ts`
- Create: `src/server/modules/admin/reconciliation-report.service.ts`
- Test: `tests/reconciliation-reports.test.ts`
- Test: `tests/integration/release-rehearsal.test.ts`

**Interfaces:**

```ts
export async function reconcileInventory(db: PrismaClient, options: { repair: false }): Promise<InventoryReconciliationReport>;
export async function reconcileMoney(db: PrismaClient): Promise<MoneyReconciliationReport>;
```

- [ ] **Step 1: Write corruption-detection tests**

Movement sum/projection mismatch, reserved>onHand, serial/order mismatch, refund above entitlement, wallet ledger mismatch, duplicate source/reference and residual legacy-table dependency.

- [ ] **Step 2: Implement read-only redacted reports**

No silent repair. A repair workflow is future ADR/review.

- [ ] **Step 3: Rehearse all migrations/import with injected failure/rollback**

Compare User/Order/wallet/bank/refund/movement counts and BigInt sums before/after.

- [ ] **Step 4: Commit**

```bash
git add scripts/reconcile-inventory.ts scripts/reconcile-money.ts src/server/modules/admin/reconciliation-report.service.ts tests/reconciliation-reports.test.ts tests/integration/release-rehearsal.test.ts
git commit -m "test: reconcile compact commerce release"
```

---

### Task 4: Add reproducible offline and opt-in online AI eval

**Files:**
- Modify: `scripts/eval-assistant.ts`
- Create: `scripts/eval-commerce-intelligence.ts`
- Modify: `tests/assistant-eval.test.ts`
- Create: `docs/verification/commerce-intelligence-eval.md`
- Modify: `package.json`

**Interfaces:**
- `npm run eval:assistant`: offline fake, no network.
- `npm run eval:assistant:online -- --budget-usd=<value>`: explicit provider config/flag/budget required.

- [ ] **Step 1: Write runner safety/reproducibility tests**

No online request without docs/config/budget; secret never printed; held-out split immutable; report includes model/prompt/source/scoring versions.

- [ ] **Step 2: Implement metrics/report**

Source accuracy, numeric exactness, citation precision, grounded claim, abstention, follow-up, latency and cost/completed answer.

- [ ] **Step 3: Run offline and record actual metrics**

- [ ] **Step 4: Run online only after explicit spend approval; otherwise mark blocked**

- [ ] **Step 5: Commit**

```bash
git add scripts tests/assistant-eval.test.ts docs/verification/commerce-intelligence-eval.md package.json
git commit -m "test: make commerce intelligence eval reproducible"
```

---

### Task 5: Build idempotent synthetic end-to-end fixtures

**Files:**
- Modify: `prisma/seed-demo-data.ts`
- Create: `prisma/seed-electronics-demo.ts`
- Test: `tests/demo-seed.test.ts`
- Test: integration demo seed test

**Interfaces:**
- Seed uses stable synthetic IDs and owning domain services where feasible; it never rewrites existing human data and remains excluded from production scoring by default.

- [ ] **Step 1: Write seed safety tests**

Two runs stable; real review/order untouched; all generated rows synthetic; production score excludes them; completed demo order has legitimate snapshots/serials/warranty/return/refund timeline.

- [ ] **Step 2: Remove any historical human review rewrite**

- [ ] **Step 3: Seed through owning services/exact validated fixtures**

- [ ] **Step 4: Run twice, assert database model count 34 and commit**

```bash
git add prisma/seed-demo-data.ts prisma/seed-electronics-demo.ts tests/demo-seed.test.ts tests/integration
git commit -m "fix: isolate synthetic electronics demo data"
```

---

### Task 6: Add CI quality and schema-budget gates

**Files:**
- Create/Modify: `.github/workflows/quality.yml`
- Create: `docs/verification/2026-10-17-release-candidate.md`
- Modify: `package.json`

**Interfaces:**
- CI always runs unit/lint/architecture/build/schema-budget; its integration job uses ephemeral PostgreSQL and never receives provider secrets or runs online AI eval.

- [ ] **Step 1: Add unit/lint/arch/build/schema-budget jobs**

Integration uses isolated PostgreSQL and `prisma migrate deploy`; no provider secrets/online AI.

- [ ] **Step 2: Add exact final registry and forbidden-model checks**

CI fails any 35th model unless spec/ADR/registry intentionally updated; still always fails >40.

- [ ] **Step 3: Validate workflow/local equivalent**

```bash
npm run verify
npx prisma validate
npm run schema:budget -- --expected=34 --lock-registry
```

- [ ] **Step 4: Create evidence template without pre-filled PASS and commit**

```bash
git add .github/workflows/quality.yml docs/verification/2026-10-17-release-candidate.md package.json
git commit -m "ci: gate compact commerce release"
```

---

### Task 7: Update architecture, UML, report and defense demo

**Files:**
- Modify: `README.md`, `.env.example`, docs index/academic docs
- Modify: `scripts/generate-uml.js`
- Regenerate: `docs/uml/`
- Test: `tests/documentation-links.test.ts`
- Test: `tests/documentation-model-count.test.ts`

**Interfaces:**
- Documentation and generated UML consume the locked 34-model registry and distinguish database models, product models, variants and synthetic/external/shop evidence.

- [ ] **Step 1: Write doc/link/count consistency tests**

All scripts/routes/files exist; docs say 34 Prisma models and 40–60 product models; no stale 50+ table/EAV diagrams; no secret or unverified AI claim.

- [ ] **Step 2: Update docs from verified code/evidence**

Explain compact JSONB model, schema validation/indexing, model budget, MoneyVnd, ledger/FSM/scoring/RAG, license and retention.

- [ ] **Step 3: Regenerate UML**

```bash
npm run docs:uml
```

Diagrams show exactly 34 models and no forbidden child table.

- [ ] **Step 4: Fresh-install demo walkthrough**

Filter → compare/P/P → grounded assistant/fallback → compatibility → checkout → payment → PO/serial fulfillment → warranty → partial return/refund → audit → schema budget.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example docs scripts/generate-uml.js tests/documentation-links.test.ts tests/documentation-model-count.test.ts
git commit -m "docs: align compact electronics architecture"
```

---

### Task 8: Final release verification and traceability

**Files:**
- Modify: release candidate report
- Create: `docs/verification/electronics-spec-traceability.md`

**Interfaces:**
- Produces a traceability matrix from each approved spec requirement to task/commit/tests/evidence, including explicit blocked or skipped provider steps.

- [ ] **Step 1: Run complete gates**

```bash
npm run verify
npx prisma validate
npx prisma migrate status
npm run schema:budget -- --expected=34 --lock-registry
```

Run importer dry-run and reconciliation; expected zero critical discrepancies.

- [ ] **Step 2: Rehearse backup/migrate/import/rollback on production-like clone**

Users/wallet/orders/financial sums preserved; four legacy tables absent; no fake legacy fields.

- [ ] **Step 3: Complete traceability with actual outputs and blocked steps**

- [ ] **Step 4: Whole-branch review and verification-before-completion**

- [ ] **Step 5: Commit evidence**

```bash
git add docs/verification
git commit -m "docs: record compact electronics release evidence"
```

## M7 Exit Criteria

- [ ] Catalog has 40–60 product models in approved ranges.
- [ ] Prisma registry stays exactly 34; M7 added zero models; hard cap/forbidden checks pass.
- [ ] Source license/mapping/revocation enforced.
- [ ] Inventory/money/serial/refund reconciliation clean.
- [ ] Offline eval stored; online only if actually approved/run.
- [ ] Demo seed idempotent/synthetic-safe.
- [ ] CI/local quality gates, UML/docs and migration rollback pass.
