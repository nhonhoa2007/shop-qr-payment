# Trusted Electronics Decision Engine

## Intent

Make the existing shop help a customer choose the right electronic device with confidence. The product should combine catalog facts, compatibility rules, benchmark evidence and grounded assistant responses into a short path from a need to a purchase decision.

The project keeps its current PostgreSQL/Prisma schema. This is a product and experience direction built from existing records and services, not a data-model expansion.

## Goals

- Help a customer express a need, budget and constraints, then reach a small set of suitable products.
- Make comparison, scoring, compatibility and evidence visible in one coherent journey.
- Let the assistant explain recommendations with citations and abstain when evidence is missing.
- Increase useful product discovery, accessory attachment and checkout completion.
- Establish funnel measurements that show whether the direction works.

## Non-goals

- Marketplace, multi-tenant shops, multi-branch inventory or subscriptions.
- New loyalty ledger, recommendation database, event warehouse or product-graph tables.
- Replacing the current payment, shipping, order, inventory or admin workflows.
- Making unsupported product claims from unverified external data.

## Constraints

- No new Prisma models, migrations or database tables.
- Reuse `Product`, `ProductVariant`, `Category`, `Brand`, `DataSource`, `BenchmarkMeasurement`, `CompatibilityRule`, `ProductScoreSnapshot`, `AssistantConversation`, `Wishlist`, `Coupon` and existing order/payment records.
- Reuse JSON fields such as `specs`, `editorialTags`, `scoringConfig` and `warrantyConfig` for bounded configuration where needed.
- Preserve current server-side price, stock, payment and compatibility validation.
- Keep the current clean architecture: thin App Router routes, module services for business logic and shared validation/types.

## Approaches considered

### A. Trusted electronics decision engine — selected

Build a guided discovery flow, evidence-backed comparison, compatibility explanations and context-aware accessory bundles on top of the current catalog and intelligence modules. This gives the project a clear customer-facing difference while requiring mostly service composition and UI work.

### B. Operations-first control tower

Invest primarily in alerts, reconciliation, low-stock queues and fulfillment automation. This would reduce operating cost quickly, but it would not create as strong a customer-facing reason to choose the shop.

### C. QR Commerce OS for other shops

Extract payment, reconciliation, inventory and staff workflows into a SaaS product. The upside is larger, but tenant isolation, onboarding, merchant-specific configuration and billing would change the product boundary and eventually require new persistence models.

## Proposed experience

1. The customer starts with a need such as work, gaming, study or a budget range.
2. The shop asks only the constraints needed for that category and returns a short ranked set.
3. Each result shows the score, decisive criteria, evidence coverage and known limitations.
4. A comparison view explains trade-offs in plain language and links each claim to a source or benchmark.
5. Compatibility checks identify required or useful accessories already in the catalog.
6. The assistant answers follow-up questions using the same evidence boundary as the comparison view.
7. The customer can add the selected product and compatible bundle to the existing cart and checkout flow.

## Measurement

Use existing analytics and operational records where possible. Add lightweight event capture through the existing application/infrastructure path without introducing a new database table. Track:

- assisted session → product detail rate;
- compare → add-to-cart rate;
- compatibility check → accessory attach rate;
- assistant answer helpfulness and citation coverage;
- unsupported-answer rate;
- return/cancellation rate for assisted orders.

The first release should define a baseline, then compare the guided journey with the current catalog journey for one electronics category.

## Phasing

- **Phase 1:** choose one category, normalize the visible evidence contract, improve comparison and compatibility presentation, and instrument the funnel.
- **Phase 2:** add guided intent questions, ranked recommendations and accessory bundle rules using existing catalog/configuration fields.
- **Phase 3:** refine assistant explanations, feedback handling and admin review tools; use measured conversion and return data to decide whether to expand to another category.

## Builder decisions

The builder may choose the concrete UI composition, route boundaries, event transport and exact copy as long as the constraints, evidence boundary and existing checkout invariants remain intact. The first category should be selected based on current catalog completeness and benchmark coverage.

## Initial release calls

- **First category:** laptop. The current seed catalog has 50 electronics products, and laptop has the clearest comparable spec schema, active manufacturer sources and benchmark shape for a first vertical slice.
- **Ranking contract:** reuse current `ProductScoreSnapshot` values with `status: 'ACTIVE'`. A product without an active snapshot for the selected use case stays visible in catalog/comparison but is excluded from ranked recommendations and marked as insufficient data. The displayed score remains the existing 0–100 score and its current coverage/source provenance fields.
- **Evidence policy:** use active `DataSource` records and existing grounding validation. Numeric claims must match live catalog values or benchmark values; revoked or unknown citations invalidate the answer; insufficient evidence causes a deterministic abstention/fallback. Synthetic evidence remains explicitly disclosed.
- **Compatibility and bundles:** compatibility is advisory and variant-aware. `COMPATIBLE`, `INCOMPATIBLE` and `UNKNOWN` remain distinct. Accessories are suggested with reasons; nothing is auto-added to the cart. Current price and stock are read at add-to-cart/checkout using existing server validation.
- **Assistant runtime:** retain the current provider abstraction, prompt/evidence contract and anonymous conversation behavior. The feature should work with the deterministic fallback when no online provider is configured.
- **Measurement:** begin with a feature-flagged guided flow for the laptop category and compare it with the current catalog flow. Events may use the existing analytics/infrastructure path or structured logs; the builder chooses the transport without adding a persistence model.

