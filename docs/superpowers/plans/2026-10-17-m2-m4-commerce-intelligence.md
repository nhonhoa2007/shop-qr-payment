# M2–M4 Commerce Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây comparison/P/P có provenance, trợ lý AI grounded và compatibility deterministic trong tám compact catalog/intelligence models.

**Architecture:** M2 thêm `BenchmarkMeasurement` và immutable `ProductScoreSnapshot`; rubric nằm trong `Category.scoringConfig`, review evidence aggregate nằm trong `DataSource.payload`. M3 thêm hai assistant models với citations/usage/claims JSON; M4 chỉ thêm `CompatibilityRule`, còn assertions được tính on-demand và cache Redis.

**Tech Stack:** Prisma/PostgreSQL JSONB, TypeScript strict, Redis atomic quota/cache, Next.js 16 thin facades, fake AI provider, Node native tests.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- M1 gate pass, schema count 25.
- M2 thêm đúng 2 models → 27; M3 thêm đúng 2 → 29; M4 thêm đúng 1 → 30.
- Cấm `ExternalReview`, `ReviewAspectSignal`, `ScoringRubric`, `Citation`, `AssistantUsage`, `CompatibilityAssertion` và quota model.
- External review dùng approved aggregate payload, không copy thành shop Review.
- Rubric/config/payload/citations/usage/conditions JSON phải validated/versioned/canonical.
- Score không dùng sales; live price/stock/sales không nằm trong RAG tĩnh.
- Provider transport thật không được đoán giao thức.
- AI không mutate domain hoặc quyết định compatibility.
- UI chỉ tối thiểu.

## Review Focus

- Revoked/wrong-market/ambiguous DataSource bị loại dù cache cũ còn.
- BigInt price giữ chính xác qua fixed-point scoring và JSON DTO.
- Category scoring config update không rewrite immutable snapshots.
- Assistant rejects invented citation/variant/spec/price và cross-owner access.
- USB-C thiếu protocol/power trả UNKNOWN, không COMPATIBLE.

---

## M2 — Evidence, scoring và comparison (25 → 27 models)

### Task 1: Extend DataSource evidence payloads and add benchmarks

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_compact_intelligence_evidence/migration.sql`
- Create: `src/shared/types/intelligence.ts`
- Create: `src/shared/validations/evidence-json.ts`
- Create: `src/server/modules/intelligence/sources.service.ts`
- Test: `tests/intelligence-sources.test.ts`
- Test: `tests/integration/intelligence-sources.test.ts`
- Modify: model registry

**Interfaces:**

```ts
export interface ReviewAggregatePayload { schemaVersion: number; sampleSize: number; ratingSummary: unknown; aspects: ReviewAspectAggregate[]; analyzerVersion: string }
export interface EvidenceQuery { productId: string; variantId?: string; market: string; sourceTypes: string[] }
export async function listActiveEvidence(query: EvidenceQuery): Promise<EvidenceRecord[]>;
export function resolveExternalMapping(candidate: MappingCandidate): MappingDecision;
```

- [ ] **Step 1: Write failing evidence schema/mapping tests**

Invalid payload, DISCOVERED/REVOKED/unlicensed/ambiguous/synthetic excluded; exact brand/model/market/config admitted; parent ID does not fan out; external verified label stays EXTERNAL.

- [ ] **Step 2: Write concurrent activation/revocation cache test**

One version wins; read after revoke immediately excludes evidence.

- [ ] **Step 3: Add only `BenchmarkMeasurement` model and evidence services**

Measurement has source/product/variant/metric/value/unit/methodology/measuredAt and uniqueness/version keys. Review aspects remain JSON aggregate on DataSource.

- [ ] **Step 4: Validate count 26, tests and commit**

```bash
npm run schema:budget -- --expected=26
```

```bash
git add prisma src/shared/types/intelligence.ts src/shared/validations/evidence-json.ts src/server/modules/intelligence tests docs/architecture/prisma-model-registry.md
git commit -m "feat: store compact commerce evidence"
```

---

### Task 2: Implement versioned scoring config and pure engine

**Files:**
- Create: `src/shared/validations/scoring-config.ts`
- Create: `src/server/modules/intelligence/scoring.engine.ts`
- Create: `src/server/modules/intelligence/scoring-config.service.ts`
- Test: `tests/scoring-engine.test.ts`
- Test: `tests/scoring-config.test.ts`

**Interfaces:**

```ts
export function validateScoringConfig(input: unknown): PublishedScoringConfig;
export function scoreProduct(input: ScoreInput, config: PublishedScoringConfig): ScoreComputation;
export function adjustedRating(input: BayesianRatingInput): number;
export function normalizeMetric(metric: number, cohort: number[], direction: 'HIGHER'|'LOWER'): number;
```

- [ ] **Step 1: Write failing config/math tests**

Same input/version gives same result/hash; office/gaming differ; 2×5-star shrinks more than 200×4.7; lower-is-better reverses; missing mandatory metric abstains; sales perturbation no effect; >Int32 price exact; invalid weights/version rejected.

- [ ] **Step 2: Implement config validation and pure fixed-point engine**

Initial config: 0.65 price efficiency + 0.25 experience + 0.10 support; category/use-case-specific and versioned in Category JSON.

- [ ] **Step 3: Run tests and commit**

```bash
git add src/shared/validations/scoring-config.ts src/server/modules/intelligence/scoring.engine.ts src/server/modules/intelligence/scoring-config.service.ts tests/scoring-engine.test.ts tests/scoring-config.test.ts
git commit -m "feat: calculate versioned use-case scores"
```

---

### Task 3: Publish immutable score snapshots

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_product_score_snapshots/migration.sql`
- Create: scoring service/controller/routes
- Test: `tests/integration/scoring-publication.test.ts`
- Modify: model registry

**Interfaces:**

```ts
export async function recomputeScores(input: RecomputeInput): Promise<RecomputeReport>;
export async function getProductScores(productId: string, variantId?: string): Promise<ScoreSnapshotDto[]>;
```

- [ ] **Step 1: Write failing publication/replay tests**

Concurrent same operation one snapshot; source/price/config revision creates new row; old row immutable; revoke serves stale/insufficient rather than old GOOD_VALUE; STAFF cannot publish; snapshot contains config/breakdown/sourceRefs JSON and MoneySnapshot string.

- [ ] **Step 2: Add only `ProductScoreSnapshot` and service**

GOOD_VALUE is derived only from active snapshot/config coverage and audited override metadata, not separate tag table.

- [ ] **Step 3: Validate M2 count 27 and commit**

```bash
npm run schema:budget -- --expected=27
```

```bash
git add prisma src/server/modules/intelligence src/app/api/scores src/app/api/admin/scoring-rubrics tests/integration/scoring-publication.test.ts docs/architecture/prisma-model-registry.md
git commit -m "feat: publish immutable compact score snapshots"
```

---

### Task 4: Build sales/review aggregates and comparison service

**Files:**
- Modify: Order completion timestamp if absent
- Create: `src/server/modules/intelligence/sales.service.ts`
- Create: `src/server/modules/intelligence/review-aggregate.service.ts`
- Create: comparison shared type/service/controller/routes/minimal UI
- Create: `tests/fixtures/uci-sentiment-licensed.json`
- Test: `tests/review-aspects.test.ts`
- Test: `tests/integration/net-sales.test.ts`
- Test: `tests/comparison.test.ts`

**Interfaces:**

```ts
export async function getNetSales(input: SalesWindowInput): Promise<NetSalesDto[]>;
export async function getReviewAspects(productIds: string[]): Promise<ReviewSummaryDto[]>;
export async function compareProducts(input: CompareInput): Promise<ComparisonDto>;
```

- [ ] **Step 1: Write sales/review tests**

Only completedAt in window; resolved return quantity deducted; SHOP/EXTERNAL/SYNTHETIC separate; hidden/revoked excluded; UCI fixture eval-only.

- [ ] **Step 2: Write comparison tests**

Exactly 2–3 distinct exact variants in same leaf category; canonical units; UNKNOWN != UNSUPPORTED; live price; scores/confidence/sales window/source-separated reviews; no unsolicited winner.

- [ ] **Step 3: Implement services and minimal compare UI**

All consumers call one service.

- [ ] **Step 4: Run M2 gate and commit**

```bash
git add prisma src/shared/types/comparison.ts src/server/modules/intelligence src/app/api src/client tests
git commit -m "feat: compare products with compact evidence"
```

---

## M3 — Grounded assistant (27 → 29 models)

### Task 5: Define provider-neutral contract and Redis atomic quota

**Files:**
- Create: `src/server/infrastructure/ai/provider.ts`
- Create: `src/server/infrastructure/ai/fake-provider.ts`
- Create: `src/server/infrastructure/ai/quota.ts`
- Modify: `.env.example`
- Test: `tests/assistant-provider.test.ts`
- Test: `tests/assistant-quota.test.ts`

**Interfaces:**

```ts
export interface AiProvider { generate(input: AiGenerationRequest, options: { signal: AbortSignal }): Promise<AiGenerationResult> }
export async function reserveAiBudget(input: BudgetInput): Promise<BudgetLease>;
export async function settleAiBudget(lease: BudgetLease, usage: Usage): Promise<void>;
export async function releaseAiBudget(lease: BudgetLease): Promise<void>;
```

- [ ] **Step 1: Write fake/provider and quota failure/concurrency tests**

Malformed/hallucinated/timeout/cancel/refusal; per-user/IP/global caps; backend error denies; TTL orphan recovery; no network.

- [ ] **Step 2: Implement without Prisma quota model**

Use verified atomic Redis primitive/Lua with in-memory test fake; fail closed.

- [ ] **Step 3: Run tests and commit**

```bash
git add src/server/infrastructure/ai .env.example tests/assistant-provider.test.ts tests/assistant-quota.test.ts
git commit -m "feat: define safe assistant provider boundary"
```

---

### Task 6: Build strict evidence bundle and grounding validator

**Files:**
- Create: `src/shared/types/assistant.ts`
- Create: `src/server/modules/assistant/evidence.service.ts`
- Create: `src/server/modules/assistant/grounding.service.ts`
- Test: `tests/assistant-grounding.test.ts`

**Interfaces:**

```ts
export async function buildEvidenceBundle(input: EvidenceBundleInput): Promise<EvidenceBundle>;
export function validateAssistantAnswer(raw: unknown, bundle: EvidenceBundle): GroundingResult;
export function buildDeterministicAnswer(bundle: EvidenceBundle, reason: string): AssistantAnswerDto;
```

- [ ] **Step 1: Write adversarial tests**

Wrong citation, market/variant, old price, invented RAM/stock/score, arbitrary URL and source prompt injection rejected; exact evidence accepted; revoked fallback; synthetic disclosure.

- [ ] **Step 2: Implement strict DTO/claim/citation allowlists and fallback**

- [ ] **Step 3: Run tests and commit**

```bash
git add src/shared/types/assistant.ts src/server/modules/assistant tests/assistant-grounding.test.ts
git commit -m "feat: validate grounded assistant answers"
```

---

### Task 7: Add compact conversations, orchestration and retention

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_assistant_conversations/migration.sql`
- Create: assistant services/controllers/routes/panel/retention cron
- Test: `tests/assistant-service.test.ts`
- Test: `tests/integration/assistant-conversations.test.ts`
- Modify: model registry

**Interfaces:**

```ts
export async function createConversation(principal: Principal): Promise<ConversationDto>;
export async function appendUserMessage(input: AppendMessageInput): Promise<AssistantMessageDto>;
export async function answerQuestion(input: AnswerInput, provider: AiProvider, signal: AbortSignal): Promise<AssistantAnswerDto>;
export async function purgeExpiredConversations(now: Date): Promise<number>;
```

- [ ] **Step 1: Write ownership/retention tests**

No cross-user/anon; anonymous token hash; 30-day purge; early delete idempotent; STAFF metadata-only except handoff/ADMIN audited investigation.

- [ ] **Step 2: Write orchestration/JSON persistence tests**

Overall first then one need question; no PII/order history/warranty image; provider failure fallback; citations/usage/claims JSON validated and redacted.

- [ ] **Step 3: Add exactly `AssistantConversation` and `AssistantMessage`**

No Citation/Usage models, no reuse of ChatRoom/Message.

- [ ] **Step 4: Add minimal panel and validate M3 count 29**

```bash
npm run schema:budget -- --expected=29
```

- [ ] **Step 5: Commit**

```bash
git add prisma src/server/modules/assistant src/app/api/assistant src/client/components/assistant tests docs/architecture/prisma-model-registry.md
git commit -m "feat: add compact grounded assistant conversations"
```

---

### Task 8: Build offline 100-case eval

**Files:**
- Create: `tests/fixtures/assistant-eval.json`
- Create: `tests/assistant-eval.test.ts`
- Create: `scripts/eval-assistant.ts`
- Modify: `package.json`
- Create: `docs/verification/assistant-eval.md`

**Interfaces:**
- Produces `npm run eval:assistant`, a network-free fake-provider evaluation report with immutable train/dev/held-out labels and versioned metrics.

- [ ] **Step 1: Create train/dev/held-out cases**

Cover variants, budgets, conflicting/revoked evidence, injection, live price/stock, citations, timeout/quota/out-of-scope/synthetic.

- [ ] **Step 2: Implement offline evaluator and thresholds**

Metrics include retrieval/numeric/citation/grounded claim/abstention/follow-up/latency/mock cost. Held-out requires zero unsupported numeric claims.

- [ ] **Step 3: Run offline eval, record actual result and commit**

```bash
git add tests/fixtures/assistant-eval.json tests/assistant-eval.test.ts scripts/eval-assistant.ts package.json docs/verification/assistant-eval.md
git commit -m "test: evaluate compact assistant grounding"
```

- [ ] **BLOCKED: Real provider transport**

Wait for actual endpoint/auth/error/structured-output/usage docs and explicit live budget approval; do not infer from model name.

---

## M4 — Compatibility (29 → 30 models)

### Task 9: Add deterministic CompatibilityRule engine

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration
- Create: compatibility shared validation/types/engine/service
- Test: `tests/compatibility-engine.test.ts`
- Test: `tests/integration/compatibility-rules.test.ts`
- Modify: model registry

**Interfaces:**

```ts
export function evaluateCompatibility(input: CompatibilityEngineInput): CompatibilityCheckDto;
export async function checkCompatibility(input: CompatibilityQuery): Promise<CompatibilityCheckDto>;
export async function listCompatibleAccessories(deviceVariantId: string): Promise<CompatibilityCheckDto[]>;
```

- [ ] **Step 1: Write rule JSON/engine tests**

USB-C only unknown; PD65 vs required100 incompatible; all required connector/protocol/power compatible; missing OS/protocol unknown; wrong direction/market/revoked ignored; malformed rule rejected.

- [ ] **Step 2: Write approval/revocation/cache tests**

Knowledge STAFF drafts, ADMIN activates; version/actor/reason stored; revoke invalidates positive cache immediately.

- [ ] **Step 3: Add only `CompatibilityRule` and engine**

No materialized assertion model. Cache key includes rule/spec/source revisions.

- [ ] **Step 4: Validate M4 count 30 and commit**

```bash
npm run schema:budget -- --expected=30
```

```bash
git add prisma src/shared src/server/modules/compatibility tests docs/architecture/prisma-model-registry.md
git commit -m "feat: evaluate compact compatibility rules"
```

---

### Task 10: Expose compatibility, assistant evidence and cart revalidation

**Files:**
- Create: public/admin controllers/routes
- Modify: assistant evidence service, product detail add-on UI, cart store, order/shipping quote services
- Test: `tests/compatibility-api.test.ts`
- Test: `tests/checkout.test.ts`
- Test: integration checkout test

**Interfaces:**
- Consumes `checkCompatibility` from Task 9; assistant exposes its status/evidence only, while checkout re-fetches exact variants, price revision, stock and active state.

- [ ] **Step 1: Write API/cart tests**

Exact variant/source result; forged status ignored; stale price/inactive accessory 409; UNKNOWN selectable only with caveat; removing add-on preserves main device.

- [ ] **Step 2: Implement thin routes and server revalidation**

No model call decides compatibility.

- [ ] **Step 3: Run full M2–M4 gate**

```bash
npm run verify
npx prisma validate
npm run schema:budget -- --expected=30
```

- [ ] **Step 4: Commit**

```bash
git add src/app src/client src/server tests docs/architecture/prisma-model-registry.md
git commit -m "feat: expose grounded compatibility checks"
```

## M2–M4 Exit Criteria

- [ ] M2 count 27, M3 count 29, M4 count 30.
- [ ] No forbidden review/rubric/citation/usage/assertion/quota models.
- [ ] Score deterministic/versioned and abstains under coverage threshold.
- [ ] Comparison is single source for API/UI/assistant.
- [ ] Conversation ownership/quota/retention and offline eval pass.
- [ ] Compatibility only COMPATIBLE with complete active evidence.
- [ ] Full quality, migration and schema-budget gates pass.
