# Coupon discovery implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let customers discover, save and select coupons while preserving direct code entry.
**Architecture:** Add public visibility and account bookmarks to existing aggregates. Shared pure policy provides consistent UI availability and savings; authenticated HTTP endpoints own saved-code mutations.
**Tech Stack:** Next.js 16.3.4, React, Prisma/PostgreSQL, Tailwind, Node test runner.
**Spec:** `docs/superpowers/specs/2026-11-15-coupon-discovery-design.md`

## Global constraints

- Preserve unrelated uncommitted work, including checkout changes.
- No new Prisma models; existing codes default private.
- Saving never consumes or reserves usage; direct entry never requires saving.
- Account saves are atomic, unique, and limited to 100.
- Client imports no server/Prisma modules. Money stays decimal strings across HTTP.

## Review focus

- Private codes must never appear in public discovery.
- Concurrent saves must preserve every distinct bookmark without duplicates.
- Account changes must not expose another account's saved list.
- Checkout previews must respect caps, expiry, usage and order minimums.
- Hidden/expired codes and network errors need truthful UI states.

### Task 1: Coupon policy, schema and customer API

**Files:** `prisma/schema.prisma`, additive migration, `src/shared/types/coupon.ts`, `src/shared/utils/coupon.ts`, `src/server/modules/coupon/customer-coupons.service.ts`, customer controller and `/api/coupons`/`saved` routes, validate route.
**Interfaces:** `CustomerCoupon` serializable DTO; `getCouponAvailability(coupon, subtotal?, now?)`; `getCouponSavings(coupon, subtotal, shippingFee)`; `listCustomerCoupons(userId, savedOnly, db?)`, `saveCustomerCoupon(userId, couponId, db?)`, `removeCustomerCoupon(userId, couponId, db?)`.

- [x] Write and run failing policy/service tests for the five review concerns, typed money, saving without usage mutation, private direct validation.
- [x] Add schema fields/migration, shared policy, selected DTO service, atomic save/remove, authenticated saved API, no-store responses and serialized validation results.
- [x] Generate Prisma client, run targeted tests and validate schema/model budget. Expected: pass, 35 models.

### Task 2: Customer discovery and checkout

**Files:** coupon card, list hook, homepage offers, checkout picker, `src/client/views/CouponsView.tsx`, `/coupons/page.tsx`, Header, HomeView, CheckoutForm, CheckoutView, CartSummary.
**Interfaces:** Consume Task 1 DTO/API and shared policy. Picker callback supplies a code to existing server validation.

- [x] Build cards, hub tabs, guest login prompt, save/remove, empty/error/loading states and homepage preview.
- [x] Add desktop/mobile navigation and cart discovery link.
- [x] Integrate checkout selection; preserve manual entry, show savings and reasons, clear invalid selection after cart/account changes.
- [x] Browser finding: synchronize sidebar totals from the form so applying a voucher cannot leave a conflicting independent total.
- [x] Run targeted tests, TypeScript, lint and architecture checks. Expected: no new errors.

### Task 3: Admin publishing and verification

**Files:** admin coupon controller/view, verification record.
**Interfaces:** Admin POST/PATCH accept boolean `isPublic`; default false.

- [x] Add explicit publishing checkbox and publish/unpublish action, independent from active status.
- [x] Run unit/integration tests, lint, architecture, build and schema checks; inspect rendered customer screens if available. See verification record for build/environment limitations.
- [x] Review final feature diff independently; resolve significant findings and record actual verification results and deployment migration requirements.
