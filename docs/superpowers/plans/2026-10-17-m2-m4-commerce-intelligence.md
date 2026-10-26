# M2–M4 Commerce Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây comparison/P/P có provenance, trợ lý AI provider-neutral có grounding và compatibility engine deterministic cho catalog điện tử.

**Architecture:** Intelligence services là nguồn duy nhất cho comparison, scoring và evidence; assistant chỉ diễn giải evidence và bị validator chặn claim không có căn cứ. Compatibility do rule engine quyết định, AI không quyết định; provider transport thật là một task bị block cho đến khi có tài liệu endpoint/request mẫu.

**Tech Stack:** Prisma/PostgreSQL, TypeScript strict, Next.js 16 route facades, Redis/DB quota backend, Node native tests, fake AI adapter.

**Spec:** `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`

## Global Constraints

- M2 bắt đầu sau M0+M1 gates; dùng nguyên tên locked DTOs trong master roadmap.
- Score không dùng doanh số; doanh số chỉ là tín hiệu phổ biến có cửa sổ thời gian.
- External review không được biến thành shop verified review; synthetic luôn được công bố.
- Chỉ ACTIVE source đúng product/variant/market/version tham gia production.
- AI không tính giá/score/sales/compatibility và không mutate domain state.
- Provider transport không được đoán là OpenAI-compatible/Gemini-native.
- AI quota fail closed khi backend quota không chắc chắn; không tái sử dụng helper Redis hiện tại.
- Không stream claim cho user trước khi grounding validation; JSON final là baseline.
- UI chỉ tối thiểu.

## Review Focus

- Revoked/ambiguous/wrong-market evidence bị loại ngay cả khi cache cũ tồn tại.
- Score giữ chính xác BigInt money, abstain khi thiếu coverage và không đổi khi sales đổi.
- Assistant không chấp nhận citation ID/giá/spec/variant ngoài evidence bundle.
- Conversation ownership chống cross-user/cross-anonymous access và retention 30 ngày.
- USB-C giống nhau nhưng thiếu protocol/power phải trả UNKNOWN, không COMPATIBLE.

---

### Task 1: Store and approve external evidence with exact mapping

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_intelligence_sources/migration.sql`
- Create: `src/shared/types/intelligence.ts`
- Create: `src/server/modules/intelligence/sources.service.ts`
- Create: `src/server/modules/intelligence/sources.controller.ts`
- Create: `src/app/api/admin/data-sources/route.ts`
- Test: `tests/intelligence-sources.test.ts`
- Test: `tests/integration/intelligence-sources.test.ts`

**Interfaces:**

```ts
approveSource(input: SourceApprovalInput): Promise<SourceApprovalResult>;
listActiveEvidence(query: EvidenceQuery): Promise<EvidenceRecord[]>;
resolveExternalMapping(candidate: MappingCandidate): MappingDecision;
```

- [ ] **Step 1: Write failing source/mapping tests**

DISCOVERED/REVOKED/unlicensed/ambiguous/synthetic excluded from production; exact brand+model+market+configuration admitted; parent identifier does not fan out; external verified flag stays EXTERNAL.

- [ ] **Step 2: Write failing concurrent approval/revocation integration test**

One auditable state wins; read after revoke returns no evidence even with prior cache.

- [ ] **Step 3: Verify fail, add schema/services/guards**

Models: ExternalReviewSource/Review, BenchmarkSource/Measurement, ReviewAspectSignal and approval events. `knowledge` STAFF prepares review; ADMIN activates source.

- [ ] **Step 4: Run tests/schema validation and commit**

```bash
git add prisma src/shared/types/intelligence.ts src/server/modules/intelligence src/app/api/admin/data-sources tests/intelligence-sources.test.ts tests/integration/intelligence-sources.test.ts
git commit -m "feat: gate electronics evidence by source approval"
```

---

### Task 2: Implement pure use-case scoring and versioned rubric

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_scoring/migration.sql`
- Create: `src/server/modules/intelligence/scoring.engine.ts`
- Create: `src/server/modules/intelligence/scoring-rubric.service.ts`
- Test: `tests/scoring-engine.test.ts`

**Interfaces:**

```ts
scoreProduct(input: ScoreInput, rubric: PublishedRubric): ScoreComputation;
adjustedRating({mean,count,cohortMean,priorCount}): number;
normalizeMetric(metric, cohort, direction: 'HIGHER'|'LOWER'): number;
```

- [ ] **Step 1: Write failing deterministic/math tests**

Same inputs/version same score/source hash; gaming vs office differs; 2×5-star shrinks more than 200×4.7; lower-is-better reverses; missing mandatory metrics abstain; sales perturbation has no effect; >Int32 price exact.

- [ ] **Step 2: Verify fail**

- [ ] **Step 3: Implement rubrics/configured formula**

Start with 0.65 price efficiency + 0.25 experience + 0.10 support, category/use-case specific; support-inapplicable redistribution in versioned config. Normalize comparable cohort only; keep BigInt price until fixed-point ratio conversion.

- [ ] **Step 4: Implement coverage/confidence and Bayesian source separation**

SHOP/EXTERNAL computed separately then weighted by rubric. Below coverage threshold emits `INSUFFICIENT_DATA`, null score, missingEvidence.

- [ ] **Step 5: Run tests and commit**

```bash
git add prisma src/server/modules/intelligence/scoring.engine.ts src/server/modules/intelligence/scoring-rubric.service.ts tests/scoring-engine.test.ts
git commit -m "feat: version use-case scoring with evidence coverage"
```

---

### Task 3: Publish immutable score snapshots and GOOD_VALUE safely

**Files:**
- Create: `src/server/modules/intelligence/scoring.service.ts`
- Create: `src/server/modules/intelligence/scoring.controller.ts`
- Create: `src/app/api/scores/[productId]/route.ts`
- Create: `src/app/api/admin/scoring-rubrics/route.ts`
- Test: `tests/integration/scoring-publication.test.ts`

**Interfaces:**

```ts
recomputeScores({categoryId,useCase,rubricVersion,operationKey,demoMode}): Promise<RecomputeReport>;
getProductScores(productId, variantId?): Promise<ScoreSnapshotDto[]>;
```

- [ ] **Step 1: Write failing publication tests**

Concurrent same operation one snapshot; source/price revision creates new immutable snapshot; revoke/change immediately serves stale/insufficient rather than old GOOD_VALUE; STAFF cannot publish; MoneySnapshot amount string.

- [ ] **Step 2: Verify fail, implement append-only snapshot/current selection**

Use operationKey+sourceSetHash+price revision. Label GOOD_VALUE only when published rubric threshold+coverage pass; ADMIN hide override stores reason and approval event.

- [ ] **Step 3: Run tests and commit**

```bash
git add src/server/modules/intelligence/scoring.service.ts src/server/modules/intelligence/scoring.controller.ts src/app/api/scores src/app/api/admin/scoring-rubrics tests/integration/scoring-publication.test.ts
git commit -m "feat: publish immutable score snapshots"
```

---

### Task 4: Build net sales and separated review-aspect aggregates

**Files:**
- Modify: `prisma/schema.prisma` (Order.completedAt if M6 seam absent)
- Create: migration
- Modify: completion transitions in order/GHN controllers
- Create: `src/server/modules/intelligence/sales.service.ts`
- Create: `src/server/modules/intelligence/review-aggregate.service.ts`
- Create: `tests/fixtures/uci-sentiment-licensed.json`
- Test: `tests/review-aspects.test.ts`
- Test: `tests/integration/net-sales.test.ts`

**Interfaces:**

```ts
getNetSales({productIds,from,to}): Promise<NetSalesDto[]>;
getReviewAspects(productIds): Promise<ReviewSummaryDto[]>;
```

- [ ] **Step 1: Write failing sales tests**

Only COMPLETED at actual completedAt in window; pending/cancelled excluded; resolved returned quantity deducted when M6 seam exists; uncertain legacy returns yield unavailable, not fabricated net sales.

- [ ] **Step 2: Write failing review aggregation tests**

SHOP/EXTERNAL/SYNTHETIC separate; hidden internal/revoked external excluded; analyzerVersion retained; mixed-positive-negative aspects can coexist; shipping complaint not device-quality signal.

- [ ] **Step 3: Implement services and transition timestamp**

UCI fixture is eval-only, never product attribution/score source.

- [ ] **Step 4: Run tests and commit**

```bash
git add prisma src/server/modules/intelligence src/server/modules/orders src/server/modules/shipping tests/review-aspects.test.ts tests/integration/net-sales.test.ts tests/fixtures
git commit -m "feat: aggregate net sales and review evidence"
```

---

### Task 5: Implement one comparison service for API/UI/assistant

**Files:**
- Create: `src/shared/types/comparison.ts`
- Create: `src/server/modules/intelligence/comparison.service.ts`
- Create: `src/server/modules/intelligence/comparison.controller.ts`
- Create: `src/app/api/compare/route.ts`
- Create: `src/app/api/products/[id]/comparison-data/route.ts`
- Create/Modify: minimal compare client component
- Test: `tests/comparison.test.ts`

**Interfaces:**

```ts
compareProducts({selections,window}): Promise<ComparisonDto>;
```

- [ ] **Step 1: Write failing validation/content tests**

Exactly 2–3 distinct selections, same leaf category, exact variant, canonical unit comparisons, UNKNOWN != UNSUPPORTED, live effective prices, score confidence/coverage, sales period, separated review sources, no unsolicited winner.

- [ ] **Step 2: Verify fail, implement service/controller/routes**

All consumers call service; no comparison logic in component/assistant prompt.

- [ ] **Step 3: Add minimal table/selection UI and run build**

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/comparison.ts src/server/modules/intelligence src/app/api/compare src/app/api/products src/client tests/comparison.test.ts
git commit -m "feat: compare products with traceable evidence"
```

---

### Task 6: Define provider-neutral AI contract, fake and fail-closed quota

**Files:**
- Create: `src/server/infrastructure/ai/provider.ts`
- Create: `src/server/infrastructure/ai/fake-provider.ts`
- Create: `src/server/infrastructure/ai/quota.ts`
- Modify: `prisma/schema.prisma` + quota lease migration if DB-backed
- Modify: `.env.example`
- Test: `tests/assistant-provider.test.ts`
- Test: `tests/assistant-quota.test.ts`

**Interfaces:**

```ts
interface AiProvider { generate(input: AiGenerationRequest, options: {signal: AbortSignal}): Promise<AiGenerationResult> }
reserveAiBudget(input): Promise<BudgetLease>;
settleAiBudget(lease, usage): Promise<void>;
releaseAiBudget(lease): Promise<void>;
```

- [ ] **Step 1: Write failing fake/provider behavior tests**

Success, malformed, hallucinated, timeout, cancellation, refusal; zero network calls.

- [ ] **Step 2: Write failing quota concurrency/failure tests**

Per-user/IP/global caps+concurrency; concurrent lease cannot exceed; backend error denies; timeout releases concurrency but settles known usage; TTL recovers orphan lease.

- [ ] **Step 3: Implement contracts/fake/atomic quota**

Do not use current `checkDistributedRateLimit`; use DB transaction or verified atomic Redis script. `.env.example` placeholders only.

- [ ] **Step 4: Run tests and commit**

```bash
git add prisma src/server/infrastructure/ai .env.example tests/assistant-provider.test.ts tests/assistant-quota.test.ts
git commit -m "feat: define safe assistant provider and quota boundary"
```

---

### Task 7: Build evidence bundle and strict grounding validator

**Files:**
- Create: `src/shared/types/assistant.ts`
- Create: `src/server/modules/assistant/evidence.service.ts`
- Create: `src/server/modules/assistant/grounding.service.ts`
- Test: `tests/assistant-grounding.test.ts`

**Interfaces:**

```ts
buildEvidenceBundle(input): Promise<EvidenceBundle>;
validateAssistantAnswer(raw, bundle): GroundingResult;
buildDeterministicAnswer(bundle, reason): AssistantAnswerDto;
```

- [ ] **Step 1: Write failing adversarial grounding tests**

Wrong citation ID, other-market variant, old price, invented RAM/stock/score, arbitrary URL and prompt injection rejected; exact evidence accepted; revoked source fallback; synthetic disclaimer.

- [ ] **Step 2: Verify fail, define strict DTO/claim/evidence allowlists**

Claims carry productId/variantId/evidenceIds/kind/text. Prices/inventory/sales are live evidence, not static RAG cache.

- [ ] **Step 3: Implement deterministic fallback and run tests**

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/assistant.ts src/server/modules/assistant tests/assistant-grounding.test.ts
git commit -m "feat: validate grounded assistant responses"
```

---

### Task 8: Add owned assistant conversations, orchestration and retention

**Files:**
- Modify: `prisma/schema.prisma` + migration
- Create: `src/server/modules/assistant/conversation.service.ts`
- Create: `src/server/modules/assistant/assistant.service.ts`
- Create: `src/server/modules/assistant/assistant.controller.ts`
- Create: assistant API routes
- Create: `src/client/components/assistant/AssistantPanel.tsx`
- Create: retention cron route following existing auth pattern
- Test: `tests/assistant-service.test.ts`
- Test: `tests/integration/assistant-conversations.test.ts`

**Interfaces:**

```ts
createConversation(principal): Promise<ConversationDto>;
appendUserMessage(input): Promise<AssistantMessageDto>;
deleteConversation(id, principal): Promise<boolean>;
purgeExpiredConversations(now): Promise<number>;
answerQuestion(input, provider, signal): Promise<AssistantAnswerDto>;
```

- [ ] **Step 1: Write failing ownership/retention tests**

No cross-user/cross-anon access; anonymous token stored hashed; 30-day purge; early delete idempotent; STAFF metadata-only unless opt-in handoff/ADMIN audited investigation.

- [ ] **Step 2: Write failing orchestration tests**

Overall comparison first then exactly one need question; follow-up applies need; no PII/order history/warranty image in provider payload; quota/provider timeout/malformed response fallback deterministic; usage persisted redacted.

- [ ] **Step 3: Verify fail, add separate schema/services/routes**

Do not reuse human ChatRoom/Message. JSON validated final response baseline; no unvalidated SSE.

- [ ] **Step 4: Add minimal panel with citations/caveats/delete**

- [ ] **Step 5: Run unit/integration/build and commit**

```bash
git add prisma src/server/modules/assistant src/app/api/assistant src/client/components/assistant tests/assistant-service.test.ts tests/integration/assistant-conversations.test.ts
git commit -m "feat: add grounded assistant conversations"
```

---

### Task 9: Build offline assistant eval; keep remote transport blocked

**Files:**
- Create: `tests/fixtures/assistant-eval.json`
- Create: `tests/assistant-eval.test.ts`
- Create: `scripts/eval-assistant.ts`
- Modify: `package.json`
- Create: `docs/verification/assistant-eval.md`

**Interfaces:**
- At least 100 cases with train/dev/held-out labels; default command uses fake provider only; online command needs explicit flag and budget.

- [ ] **Step 1: Create versioned eval cases**

Cover compare, variants, budget/use case, missing/conflicting/revoked evidence, injection, changing price/stock, citations, timeout/quota, out-of-scope, synthetic disclosure.

- [ ] **Step 2: Write evaluator and failing quality thresholds**

Metrics: retrieval accuracy, numeric exactness, citation precision, grounded-claim rate, correct abstention, follow-up relevance, latency/mock cost. Held-out test requires zero unsupported numeric claims.

- [ ] **Step 3: Run offline eval and record results**

No real API spend. Tune only train/dev; do not inspect labels to hand-code held-out answers.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/assistant-eval.json tests/assistant-eval.test.ts scripts/eval-assistant.ts package.json docs/verification/assistant-eval.md
git commit -m "test: add offline assistant grounding evaluation"
```

- [ ] **BLOCKED Step: Implement real provider transport**

Blocked until user supplies actual provider endpoint docs or redacted request/response sample, auth/error/streaming/structured-output/usage semantics, and approves any live-eval budget. Then add focused adapter tests; do not infer protocol from model name.

---

### Task 10: Implement deterministic compatibility rules

**Files:**
- Modify: `prisma/schema.prisma` + migration
- Create: `src/shared/types/compatibility.ts`
- Create: `src/server/modules/compatibility/compatibility.engine.ts`
- Create: `src/server/modules/compatibility/compatibility.service.ts`
- Test: `tests/compatibility-engine.test.ts`
- Test: `tests/integration/compatibility-rules.test.ts`

**Interfaces:**

```ts
evaluateCompatibility({accessory,device,rules}): CompatibilityCheckDto;
checkCompatibility({accessoryVariantId,deviceVariantId}): Promise<CompatibilityCheckDto>;
listCompatibleAccessories(deviceVariantId): Promise<CompatibilityCheckDto[]>;
```

- [ ] **Step 1: Write failing engine tests**

USB-C only unknown; PD65 vs required100 incompatible; connector+protocol+power all sufficient compatible; missing OS/protocol unknown; wrong direction ignored; revoked/wrong-market rule ignored; UNKNOWN != UNSUPPORTED.

- [ ] **Step 2: Write failing approval/revocation integration tests**

STAFF knowledge drafts/reviews; ADMIN activates; actor/reason/version recorded; replay idempotent; revoke removes positive assertion immediately.

- [ ] **Step 3: Implement schema/engine/service and run tests**

Every mandatory predicate needed for COMPATIBLE; warnings cannot imply compatibility; contradictions route UNKNOWN/review unless proven mismatch.

- [ ] **Step 4: Commit**

```bash
git add prisma src/shared/types/compatibility.ts src/server/modules/compatibility tests/compatibility-engine.test.ts tests/integration/compatibility-rules.test.ts
git commit -m "feat: evaluate evidence-backed device compatibility"
```

---

### Task 11: Expose compatibility, add assistant evidence and revalidate cart

**Files:**
- Create: compatibility public/admin controllers and route facades
- Modify: `src/server/modules/assistant/evidence.service.ts`
- Modify: minimal product detail/add-on component
- Modify: `src/client/stores/cart-store.ts`
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/shipping/shipping-quote.service.ts`
- Test: `tests/compatibility-api.test.ts`
- Test: `tests/checkout.test.ts`
- Test: integration checkout test

**Interfaces:**
- Assistant explains engine status/citations only; cart stores independent item IDs; server re-fetches active variant/effective price/revision/availability.

- [ ] **Step 1: Write failing API/cart tests**

Exact variant/source result; forged status ignored; stale price/inactive accessory returns 409; UNKNOWN accessory selectable with caveat; removing accessory preserves main device.

- [ ] **Step 2: Verify fail, implement controllers/routes/evidence integration**

No model call decides compatibility.

- [ ] **Step 3: Add minimal UI and run architecture/build tests**

- [ ] **Step 4: Run full M2–M4 gate and commit**

```bash
npm run verify
```

```bash
git add src/app src/client src/server tests/compatibility-api.test.ts tests/checkout.test.ts tests/integration
git commit -m "feat: expose compatibility and validate add-ons"
```

## M2–M4 Exit Criteria

- [ ] Score deterministic/versioned and abstains under coverage threshold.
- [ ] Comparison service is single source for API/UI/assistant.
- [ ] External/internal/synthetic evidence remains distinct.
- [ ] Fake-provider assistant passes offline eval with zero unsupported numeric claims.
- [ ] Conversation ownership/quota/retention tests pass.
- [ ] Real provider transport remains explicitly blocked unless docs are supplied.
- [ ] Compatibility returns COMPATIBLE only with complete approved evidence.
- [ ] `npm run verify` and migration rehearsal pass.
