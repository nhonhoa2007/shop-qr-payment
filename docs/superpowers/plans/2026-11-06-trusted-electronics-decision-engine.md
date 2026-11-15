# Trusted Electronics Decision Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a laptop-focused guided buying journey that ranks only active, evidence-backed products, explains trade-offs and compatibility, and routes the selected product into the existing cart without changing the Prisma schema.

**Architecture:** Add a pure recommendation contract and service under the existing intelligence module. Expose it through a thin App Router API route, then compose a new discovery page from client components that call the recommendation, comparison and compatibility APIs already present. Keep evidence validation in the existing assistant/grounding path and emit allowlisted discovery events through a non-persistent structured event endpoint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL reads, existing Redis/rate-limit utilities, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-06-trusted-electronics-decision-engine-design.md`

## Global Constraints

- Do not add Prisma models, migrations or database tables.
- First release targets the `laptop` category (`cat-laptop`) and existing use cases such as `office_study`, `gaming`, `creative`, `programming` and `everyday`.
- Reuse current `ProductScoreSnapshot` values with `status: 'ACTIVE'`; products without an active snapshot stay visible only in comparison/catalog and are excluded from ranked recommendations.
- Use active `DataSource` records and the existing grounding validator; revoked/unknown citations or unsupported numeric claims must fall back safely.
- Compatibility remains variant-aware and advisory; suggestions never auto-add products to the cart.
- Reuse server-side price, stock, cart and checkout validation.
- Preserve the current App Router → controller → service/module layering.

## Review Focus

- A laptop with no active score snapshot must not appear in ranked recommendations; test in Task 1.
- A revoked or synthetic evidence source must not become an unqualified recommendation claim; test in Task 3.
- A compatibility result of `UNKNOWN` must remain visibly unknown and must not be treated as compatible; test in Task 2.
- A variant's current price/stock must win at add-to-cart time even when the recommendation response is stale; test in Task 2.
- An anonymous user must complete discovery without an account or assistant conversation; test in Task 2.

### Task 1: Recommendation contract and laptop ranking service

**Files:**
- Create: `src/shared/types/recommendations.ts`
- Create: `src/server/modules/intelligence/recommendation.service.ts`
- Create: `src/server/modules/intelligence/recommendation.controller.ts`
- Create: `src/app/api/products/recommendations/route.ts`
- Create: `tests/recommendation-service.test.ts`

**Interfaces:**
- Consumes: existing `Product`, `ProductVariant`, `Category`, `ProductScoreSnapshot`, `DataSource` reads and `ScoreSnapshotDto` fields.
- Produces: `POST /api/products/recommendations` and `getLaptopRecommendations(input, db?)`.

- [ ] **Step 1: Write the failing service tests**

  Add tests for `getLaptopRecommendations` covering:

  - `categorySlug: 'laptop'` and `useCase: 'office_study'` returns only active laptop products with `ACTIVE` score snapshots.
  - `budgetMaxVnd` is parsed as a decimal string and filters by the selected base/variant price without converting VND to an unsafe JavaScript number.
  - products with no snapshot, non-active snapshots, inactive products or zero available stock are omitted from ranked candidates and reported in `excludedReasons`.
  - candidates are ordered by `finalScore DESC`, then `coverage DESC`, then price ascending.
  - invalid category/use case, malformed budget and empty candidate sets return typed validation errors instead of querying broadly.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/recommendation-service.test.ts`

  Expected: FAIL because the recommendation types and service do not exist.

- [ ] **Step 3: Define the shared recommendation types**

  In `src/shared/types/recommendations.ts`, define:

  ```ts
  export type LaptopUseCase = 'office_study' | 'gaming' | 'creative' | 'programming' | 'everyday';
  export interface RecommendationInput {
    categorySlug: 'laptop';
    useCase: LaptopUseCase;
    budgetMaxVnd?: string;
    requiredSpecFilters?: Record<string, string | number | boolean>;
    limit?: number;
  }
  export interface RecommendationCandidate {
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    priceVnd: string;
    stock: number;
    score: number;
    coverage: number;
    missingEvidence: string[];
    sourceRefs: string[];
  }
  export interface RecommendationResult {
    categorySlug: 'laptop';
    useCase: LaptopUseCase;
    candidates: RecommendationCandidate[];
    excludedReasons: Array<{ productId: string; reason: 'NO_SCORE' | 'INSUFFICIENT_DATA' | 'OUT_OF_BUDGET' | 'OUT_OF_STOCK' | 'SPEC_MISMATCH' }>;
  }
  ```

- [ ] **Step 4: Implement `getLaptopRecommendations(input: RecommendationInput, db?: PrismaClientOrTx): Promise<RecommendationResult>`**

  Query active products in the laptop category with active variants and `status: 'ACTIVE'` score snapshots for the requested use case. Create one candidate per active snapshot variant (or the base product when `variantId` is null), use the existing availability projection (`onHandStock - reservedStock - quarantinedStock`, with the established inventory fallback for legacy rows), and keep prices as `bigint` until serializing to `priceVnd`. Apply required spec filters to the normalized `Product.specs`/variant overrides, omit candidates lacking an active snapshot or available stock, and cap `limit` to 6. Do not create or update records.

- [ ] **Step 5: Add `POST /api/products/recommendations`**

  In the controller, validate the JSON body against the allowed category/use-case/limit/budget contract, call `getLaptopRecommendations`, and return `{ success: true, result }`. Return HTTP 400 for input errors and 500 for unexpected service errors. The route file only re-exports `POST` from the controller.

- [ ] **Step 6: Run the focused tests to verify they pass**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/recommendation-service.test.ts`

  Expected: PASS with all ranking, exclusion and bigint-price cases green.

- [ ] **Step 7: Commit the recommendation slice**

  ```bash
  git add src/shared/types/recommendations.ts src/server/modules/intelligence/recommendation.service.ts src/server/modules/intelligence/recommendation.controller.ts src/app/api/products/recommendations/route.ts tests/recommendation-service.test.ts
  git commit -m "feat: add evidence-backed laptop recommendations"
  ```

### Task 2: Anonymous discovery flow and safe cart handoff

**Files:**
- Create: `src/app/discover/page.tsx`
- Create: `src/client/views/DiscoveryView.tsx`
- Create: `src/client/components/discovery/LaptopDiscoveryFlow.tsx`
- Create: `src/client/components/discovery/RecommendationCard.tsx`
- Create: `src/client/components/discovery/CompatibilitySuggestions.tsx`
- Create: `src/client/components/discovery/discovery-flow-helpers.ts`
- Modify: `src/client/views/HomeView.tsx`
- Test: `tests/discovery-flow.test.ts`

**Interfaces:**
- Consumes: `POST /api/products/recommendations`, `GET/POST /api/products/compare`, `POST /api/compatibility/check`, existing `useCartStore` actions and `ProductComparisonModal` types.
- Produces: `/discover` with a laptop intent form, ranked cards, comparison handoff, advisory accessory suggestions and cart handoff.
- Helper interfaces: `buildRecommendationRequest(form): RecommendationInput`, `compatibilityPresentation(status): { label: string; tone: 'positive' | 'negative' | 'neutral' }`, and `buildCartSelection(candidate): { productId: string; variantId: string | null }`.

- [ ] **Step 1: Write the failing pure-flow tests**

  Add tests for exported helpers from `src/client/components/discovery/discovery-flow-helpers.ts`:

  - build a request with `categorySlug: 'laptop'`, selected use case, decimal budget string and normalized filters.
  - keep `UNKNOWN` compatibility separate from `COMPATIBLE` and render no “tương thích” claim for unknown results.
  - build a cart line from the selected `productId`/`variantId` without trusting recommendation price or stock fields.
  - anonymous state can submit recommendations without `userId`, session or assistant conversation.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/discovery-flow.test.ts`

  Expected: FAIL because the flow helpers and components do not exist.

- [ ] **Step 3: Implement the flow helpers and components**

  Keep request state local to `LaptopDiscoveryFlow`. Start with use-case chips and optional budget input, fetch recommendations on submit, show up to six `RecommendationCard` items, and expose “So sánh” for two or three selected products. `RecommendationCard` displays score, coverage, source provenance, price, current stock and missing-evidence state. `CompatibilitySuggestions` calls the existing compatibility endpoint only after a product/variant is selected and renders `COMPATIBLE`, `INCOMPATIBLE` and `UNKNOWN` as separate states.

- [ ] **Step 4: Implement safe cart handoff**

  Use the existing cart store with product/variant identity only. Fetch or rely on the existing product-detail/cart validation path for the current price and stock; never write the recommendation's serialized price into the cart. Accessory suggestions remain opt-in buttons.

- [ ] **Step 5: Add `/discover` and the storefront entry point**

  `src/app/discover/page.tsx` renders `DiscoveryView`. Add a single CTA in `HomeView` near the hero/catalog controls linking to `/discover` with copy that describes choosing a laptop by need and budget. Do not replace the existing catalog filters or checkout flow.

- [ ] **Step 6: Run the focused tests and lint the changed files**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/discovery-flow.test.ts`

  Run: `node ./node_modules/eslint/bin/eslint.js src/app/discover/page.tsx src/client/views/DiscoveryView.tsx src/client/components/discovery src/client/views/HomeView.tsx`

  Expected: tests PASS and ESLint reports no errors in changed files.

- [ ] **Step 7: Commit the discovery slice**

  ```bash
  git add src/app/discover/page.tsx src/client/views/DiscoveryView.tsx src/client/components/discovery src/client/views/HomeView.tsx tests/discovery-flow.test.ts
  git commit -m "feat: add anonymous laptop discovery flow"
  ```

### Task 3: Evidence, comparison and assistant handoff

**Files:**
- Modify: `src/client/components/product/ProductComparisonModal.tsx`
- Create: `src/client/components/product/comparison-evidence.ts`
- Modify: `src/client/components/assistant/AssistantPanel.tsx`
- Modify: `src/server/modules/intelligence/comparison.service.ts`
- Modify: `src/server/modules/assistant/evidence.service.ts` only if the existing bundle omits recommendation product IDs or score coverage.
- Test: `tests/discovery-evidence.test.ts`, `tests/comparison.test.ts`

**Interfaces:**
- Consumes: `RecommendationCandidate`, existing `ComparisonDto`, `EvidenceBundle`, `AssistantAnswerDto` and current grounding validator.
- Produces: comparison and assistant surfaces that expose evidence state without inventing claims.
- Helper interface: `buildComparisonEvidenceState(comparison: ComparisonDto): ComparisonEvidenceState`, where each product state contains `score: number | null`, `coverage: number | null`, `sourceCount: number`, `missingEvidence: string[]`, and `label: 'Đủ dữ liệu' | 'Chưa đủ dữ liệu' | 'Nguồn đã thu hồi'`.

- [ ] **Step 1: Write the failing evidence tests**

  Add tests for `buildComparisonEvidenceState` and the existing grounding validator that:

  - show an active score snapshot's coverage and source references in the comparison view model;
  - label missing score/evidence as “Chưa đủ dữ liệu” and never render a numeric score fallback;
  - reject revoked/unknown citations through the existing `validateAssistantAnswer` path;
  - preserve synthetic-source disclosure text when a benchmark is synthetic.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/discovery-evidence.test.ts`

  Expected: FAIL because the new view model/state is not exposed.

- [ ] **Step 3: Extend the comparison presentation**

  In `comparison.service.ts`, query score snapshots with `status: 'ACTIVE'`, resolve their `sourceRefs` against `DataSource`, and omit or mark snapshots that reference revoked sources. In `comparison-evidence.ts`, define `ComparisonEvidenceState` and implement `buildComparisonEvidenceState`. A product is `Nguồn đã thu hồi` when any source reference is revoked, `Đủ dữ liệu` when it has an active score and at least 0.6 coverage, and `Chưa đủ dữ liệu` otherwise. In `ProductComparisonModal.tsx`, render score coverage, source count and missing-evidence labels from this helper. Keep `UNKNOWN`/`UNSUPPORTED` canonical spec states visible and avoid declaring a winner when the comparison lacks sufficient evidence.

- [ ] **Step 4: Add recommendation context to the assistant handoff**

  Pass selected product IDs from discovery into the existing `AssistantPanel` `defaultProductIds` prop. Keep the current provider abstraction, citation validation, deterministic fallback and anonymous conversation behavior. Only change `evidence.service.ts` if the selected product IDs are not already included in its bundle query.

- [ ] **Step 5: Run the focused evidence and existing grounding/comparison tests**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/discovery-evidence.test.ts tests/assistant-grounding.test.ts tests/comparison.test.ts`

  Expected: PASS with existing grounding and comparison behavior preserved.

- [ ] **Step 6: Commit the evidence slice**

  ```bash
  git add src/client/components/product/ProductComparisonModal.tsx src/client/components/product/comparison-evidence.ts src/client/components/assistant/AssistantPanel.tsx src/server/modules/intelligence/comparison.service.ts src/server/modules/assistant/evidence.service.ts tests/discovery-evidence.test.ts tests/comparison.test.ts
  git commit -m "feat: expose evidence state in discovery"
  ```

### Task 4: Non-persistent funnel measurement and rollout guard

**Files:**
- Create: `src/shared/types/discovery-events.ts`
- Create: `src/server/modules/intelligence/discovery-events.controller.ts`
- Create: `src/app/api/analytics/discovery/route.ts`
- Create: `src/client/lib/discovery-analytics.ts`
- Modify: `src/client/components/discovery/LaptopDiscoveryFlow.tsx`
- Test: `tests/discovery-events.test.ts`

**Interfaces:**
- Consumes: discovery state transitions and existing rate-limit/structured logging utilities.
- Produces: allowlisted `POST /api/analytics/discovery` events and client helpers `trackDiscoveryEvent(event)` / `createDiscoverySessionId()`.
- Server interface: `validateDiscoveryEvent(input: unknown): DiscoveryEvent` returns a sanitized discriminated union or throws a 400-safe validation error.

- [ ] **Step 1: Write the failing event-contract tests**

  Test that the event validator accepts only `DISCOVERY_VIEWED`, `INTENT_SUBMITTED`, `RECOMMENDATIONS_SHOWN`, `COMPARE_OPENED`, `COMPATIBILITY_CHECKED`, `ASSISTANT_OPENED`, `ADD_TO_CART_CLICKED`, `CHECKOUT_STARTED`, and `PURCHASE_COMPLETED`; rejects arbitrary fields, oversized strings and missing session/event IDs; and redacts product names or free-form assistant text from the payload.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/discovery-events.test.ts`

  Expected: FAIL because the event contract and endpoint do not exist.

- [ ] **Step 3: Implement the shared event contract and server endpoint**

  Define a discriminated union with only IDs, category/use case, result counts, compatibility status and coarse numeric values. `validateDiscoveryEvent` strips unknown keys and rejects free-form text. The controller validates input, applies the existing IP rate-limit helper, writes one structured log line per accepted event and returns `204`. It must not persist to Prisma or include payment/customer PII.

- [ ] **Step 4: Implement the client tracker and wire the flow**

  Generate an anonymous session ID in memory/local storage, emit view/intent/result/compare/compatibility/assistant/cart events at the corresponding transitions, and swallow telemetry failures so discovery and checkout remain functional. Do not send assistant message text or bank/payment data.

- [ ] **Step 5: Run event tests and lint**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/discovery-events.test.ts`

  Run: `node ./node_modules/eslint/bin/eslint.js src/app/api/analytics/discovery/route.ts src/server/modules/intelligence/discovery-events.controller.ts src/client/lib/discovery-analytics.ts src/client/components/discovery/LaptopDiscoveryFlow.tsx`

  Expected: tests PASS and no lint errors.

- [ ] **Step 6: Commit the measurement slice**

  ```bash
  git add src/shared/types/discovery-events.ts src/server/modules/intelligence/discovery-events.controller.ts src/app/api/analytics/discovery/route.ts src/client/lib/discovery-analytics.ts src/client/components/discovery/LaptopDiscoveryFlow.tsx tests/discovery-events.test.ts
  git commit -m "feat: instrument laptop discovery funnel"
  ```

### Task 5: Verification and release gate

**Files:**
- Modify: `docs/HE-THONG-CHUC-NANG.md` with the `/discover` flow and no-schema-expansion note.
- Modify: `README.md` with the laptop discovery demo step if the existing demo sequence is updated.
- Test: existing full suite and schema-budget checks.

- [ ] **Step 1: Run all focused tests together**

  Run: `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/recommendation-service.test.ts tests/discovery-flow.test.ts tests/discovery-evidence.test.ts tests/discovery-events.test.ts tests/comparison.test.ts tests/assistant-grounding.test.ts`

  Expected: PASS.

- [ ] **Step 2: Verify the schema stayed unchanged**

  Run: `git diff -- prisma/schema.prisma prisma/migrations`

  Expected: no output.

  Run: `npm run schema:budget`

  Expected: existing model-budget gate PASS with no model-count increase.

- [ ] **Step 3: Run repository checks**

  Run: `npm run lint`

  Run: `npm run test`

  Run: `npm run build`

  Expected: all commands complete successfully; any pre-existing warning must be recorded without weakening the new tests.

- [ ] **Step 4: Review the user journey manually**

  Start the app with `npm run dev`, open `/discover`, submit each laptop use case with and without a budget, inspect score/evidence states, test `UNKNOWN` compatibility, open comparison and assistant context, and add a recommended variant to the cart. Confirm anonymous use and current-price/stock validation.

- [ ] **Step 5: Commit documentation and verification updates**

  ```bash
  git add docs/HE-THONG-CHUC-NANG.md README.md
  git commit -m "docs: document laptop discovery journey"
  ```

