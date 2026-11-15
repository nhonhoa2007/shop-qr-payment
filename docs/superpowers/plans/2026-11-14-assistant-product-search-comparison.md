# Assistant Product Search and Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Find current shop products in Vietnamese chat, render clickable cards, and compare exactly two products with factual live data.

**Architecture:** Add a bounded commerce resolver before assistant evidence generation, reusing catalog pricing/spec normalization. Persist server-owned references in citation JSON and reconstruct structured commerce payloads for history. Extend the existing panel with compact cards and an accessible comparison view.

**Tech Stack:** Existing Next.js 16.3.4, React 19, TypeScript, Prisma/PostgreSQL, Node native tests and Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-14-assistant-product-search-comparison-design.md` (approved).

## Global Constraints

- No new Prisma models, migrations, vector database or external search dependency.
- Preserve `client` / `server` / `shared` boundaries and pre-existing working-tree changes.
- At most five search cards, exactly two assistant comparison selections, same category.
- Price, availability, links and comparison cells are server-owned; missing data stays unknown.
- No destructive seed/reset. Inspect/prepare catalog changes before database application.
- Work in this authorized checkout, preserve unrelated changes, leave changes uncommitted for review.

## Review Focus

- Variant filters must match price, stock and specs on the same SKU; test in Task 1.
- Two simultaneous conversations must not share references; test in Task 3.
- Delisted products and legacy messages must remain readable on history reload; test in Task 3.
- Vague/model-ambiguous comparisons must request clarification, not pick arbitrary products; test in Task 2.
- Broken image, mobile width and nested card controls must not prevent navigation/selection; verify in Task 4.

### Task 1: Catalog normalization and Vietnamese search

**Files:** Create `src/server/modules/assistant/commerce-search.service.ts`, `src/shared/types/assistant-commerce.ts`, `src/shared/utils/product-specs.ts`, `tests/assistant-commerce.test.ts`.
**Interfaces:** `searchAssistantProducts(query, db, previousQuery?)` returns validated bounded cards and query context; `readProductSpecs` normalizes current and legacy formats; shared DTOs define references/cards/comparison.

- [x] Write failing behavioral tests for budget expressions, accents/aliases, token matching, strict filters, same-SKU matching and bounded results.
- [x] Run the focused suite and observe expected failures.
- [x] Implement parsing, bounded database querying, exact post-filtering and card assembly using existing `normalizeCatalogQuery` / `resolveProductPricing`.
- [x] Verify tests pass and inspect filter results.

### Task 2: Comparison and conversation intent

**Files:** Create `src/server/modules/assistant/commerce.service.ts`; modify existing comparison normalization where needed; extend `tests/assistant-commerce.test.ts`, `tests/comparison.test.ts`.
**Interfaces:** `resolveAssistantCommerce(input, context, db)` returns search/clarification/comparison payload and reference context. `hydrateAssistantCommerce(refs, db)` refreshes live data.

- [x] Write failing tests for explicit two-name comparisons, card IDs, ordinal follow-ups, ambiguity, incompatible categories, variants and unknown specs.
- [x] Observe failures, then implement deterministic intent/reference resolution and factual comparison assembly.
- [x] Align existing comparison service with nested spec values, active variants and effective prices; preserve public 2–3 item API.
- [x] Run new and existing comparison tests.

### Task 3: Assistant orchestration, persistence and ownership

**Files:** Modify `assistant.service.ts`, `evidence.service.ts`, `assistant.controller.ts`, `src/shared/types/assistant.ts`; create `tests/assistant-commerce-conversation.test.ts`.
**Interfaces:** Assistant DTOs gain optional `commerce`; citation entries may carry validated `productRef`; input accepts validated comparison references.

- [x] Write failing conversation tests for search -> cards -> first-two comparison -> history, provider fallback, ownership isolation, legacy citations and stale products.
- [x] Observe failures; integrate commerce resolution before evidence generation, deterministic factual responses and reference persistence.
- [x] Resolve latest context from bounded persisted assistant message references, avoiding shared mutable context/lost metadata updates; carry refinable query metadata with the server-owned reference.
- [x] Validate HTTP input and isolate anonymous sessions with a server-issued cookie.
- [x] Run assistant orchestration/grounding suites and new conversation tests.

### Task 4: Clickable cards and two-product comparison UI

**Files:** Create `AssistantProductCards.tsx`, `AssistantComparison.tsx`, `src/client/lib/assistant-selection.ts`; modify `AssistantPanel.tsx`.
**Interfaces:** Typed commerce payload renders cards/table; selection helper limits references to two compatible items; panel sends comparison selections and preserves commerce on messages.

- [x] Write failing selection/state tests for toggles, max two, category validation and variant identity.
- [x] Implement accessible compact cards with separate detail links and selection controls, visible selection tray, inline responsive comparison and stale/loading/error states.
- [x] Render current prices distinctly when reloading history; preserve existing text/citation display.
- [x] Verify card navigation, comparison and mobile widths in browser with isolated fixtures if live database remains unavailable.

### Task 5: Safe technology catalog preparation

**Files:** Add `scripts/prepare-technology-catalog.ts`, `tests/technology-catalog-preparation.test.ts`, and a generated preparation report under `docs/data/` if appropriate.
**Interfaces:** Read-only manifest/database report of intended imports/updates, legacy visibility changes, data completeness and blockers; optional application only against an identified authorized database with validated inventory invariants.

- [x] Write failing tests for non-destructive planning, incomplete/synthetic source disclosure and history-preserving retirement proposals.
- [x] Implement and run manifest dry-run; attempt read-only database inspection without exposing secrets.
- [x] Apply only when database access and catalog readiness are available; otherwise finish the reviewable report and document the concrete database blocker.

### Task 6: Verify and review

- [x] Run focused and full unit tests, lint, TypeScript/build, architecture check and 35-model registry gate.
- [x] Run integration checks only on a dedicated test database; report skips/limitations.
- [x] Request one fresh code review using the approved spec and current changes; resolve important findings with reproducing tests.
- [x] Update this checklist and verification record, then report the implemented behavior and remaining environment limitations.

## Execution record

- User approved implementation after design review; execute directly in this session without another workflow confirmation.
- Baseline: database `localhost:5432` unreachable. `npm test` reports a pre-existing schema-budget suite failure; investigate runner output before treating it as a regression.
- Ruling: existing citation product references are sufficient to recover the latest results/context. Prefer bounded message history over conversation metadata writes to avoid concurrent read/modify/write loss and schema changes.


## Completion record (2026-11-15)

- All six tasks completed in the authorized checkout; changes remain uncommitted.
- Database access succeeded with approved host execution. Initial database-unavailable/schema-test failures were sandbox process/network restrictions, not missing PostgreSQL or product regressions.
- User explicitly selected demo catalog data. Added a separate transactional demo importer rather than executing the older electronics importer or generic seed. Imported 50 products / 55 variants; hid 36 active legacy listings and preserved all 39 historical product records, their stock balances, order counts and order-item counts.
- Existing citation JSON stores immutable conversation context. No schema/model change was needed.
- Used local group illustrations with visible demo labels. Sources are synthetic; no manufacturer verification or benchmark evidence is claimed.
- Fresh reviewer found accessory alias, duplicate-name comparison and varying-configuration issues. All reproduced with failing tests and corrected; re-review reported no blocking findings.
- Unit suite: 1,123 passing. Integration suite: 77 passing, zero skipped, in isolated PostgreSQL schema `assistant_verify_20261114`. Importer separately verified there for idempotency, price preservation and checksum-conflict rejection.
- TypeScript, scoped lint (zero errors), architecture (416 modules), 35-model registry gate and production Webpack build passed. Default Turbopack build failed with sandbox process/port restrictions; Webpack successfully built the same application.
- Full repository lint remains red with 67 existing errors in three unchanged generated design-runtime files. No lint errors in changed application/scripts/test scope.
- Browser verified live search, Vietnamese accessory aliases, card detail navigation, two-item selection/tray, comparison, restored history and a 390px mobile viewport. Comparison overflows only inside its horizontal scroll region, not the page.
