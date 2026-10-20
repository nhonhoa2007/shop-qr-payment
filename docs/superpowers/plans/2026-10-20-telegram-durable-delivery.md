# Telegram Durable Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unreliable fire-and-forget Telegram order notifications with a durable, observable, retrying outbox that does not make checkout or payment depend on Telegram availability.

**Architecture:** Reuse `AdminAuditLog` as a compact JSON outbox, enqueue the rendered Telegram payload in the same Prisma transaction as each business mutation, and process due entries through an authenticated cron worker with compare-and-swap leases. Keep Telegram delivery at-least-once, retry for 24 hours, and create one durable in-app admin alert when retries are exhausted.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript, Prisma 6/PostgreSQL, Node test runner, Vercel cron, Pusher.

**Spec:** `docs/superpowers/specs/2026-10-20-telegram-durable-delivery-design.md`

## Global Constraints

- Do not add a Prisma model; the locked model count remains exactly 34.
- Persist notification intent atomically with order creation/payment, but never fail the business flow because Telegram itself is unavailable.
- Delivery is at-least-once; do not claim exactly-once behavior.
- Retry for at most 24 hours, honor Telegram `retry_after`, and retain exhausted records as `FAILED`.
- Never persist or log the Telegram bot token or full customer message payload.
- Existing inbound Telegram callback behavior remains unchanged.
- Preserve all unrelated uncommitted changes in the working tree.

## Review Focus

- A worker crashes after Telegram accepts a message but before `SENT` is persisted: stale lease recovery may resend, but the row must never remain permanently stuck.
- Missing credentials, timeout, malformed/non-JSON Telegram responses, HTTP 429, 4xx, and 5xx must all become bounded structured failures without leaking the token.
- Two workers see the same due row: only one exact-document compare-and-swap claim may send it.
- An expired task is processed repeatedly: database alerts and `adminAlertedAt` must remain one-time/idempotent even when Pusher fails.
- Replayed Casso/wallet/order operations must not create duplicate outbox rows for the same event/order key.

---

### Task 1: Telegram transport failure metadata

**Files:**
- Modify: `src/server/infrastructure/telegram.ts`
- Modify: `tests/telegram-infra.test.ts`

**Interfaces:**
- Produces: `TelegramApiResponse` with `ok`, optional `messageId`, `description`, `httpStatus`, `retryAfterSeconds`, and `failureKind`; `sendTelegramMessage(params, options?)` with an injectable timeout.
- Consumes: Existing formatted payloads and environment variables.

- [ ] **Step 1: Write failing transport tests** for timeout/network failure, non-JSON response, 429 `retry_after`, 4xx/5xx metadata, success metadata, and token redaction.
- [ ] **Step 2: Run `tests/telegram-infra.test.ts` and verify the new assertions fail because structured failure fields and timeout handling are absent.**
- [ ] **Step 3: Implement the smallest transport hardening** using `AbortSignal.timeout`, safe response parsing, bounded/redacted descriptions, and the structured response fields.
- [ ] **Step 4: Run `tests/telegram-infra.test.ts`; expected: all Telegram infrastructure tests pass.**
- [ ] **Step 5: Commit transport and tests.**

### Task 2: Versioned outbox document and retry policy

**Files:**
- Create: `src/server/modules/telegram/telegram-outbox.types.ts`
- Create: `src/server/modules/telegram/telegram-outbox.policy.ts`
- Create: `tests/telegram-outbox-policy.test.ts`

**Interfaces:**
- Produces: `TelegramOutboxDocumentV1`, `parseTelegramOutboxDocument(value)`, `createTelegramOutboxDocument(input, now)`, `getTelegramOutboxOperationKey(eventType, orderId)`, and `getNextTelegramAttempt(attemptCount, now, expiresAt, retryAfterSeconds?)`.
- Consumes: `SendTelegramMessageParams` from Task 1.

- [ ] **Step 1: Write failing policy tests** for strict validation, deterministic keys, 1/2/5/10/30/60 minute backoff, longer 429 delay, 24-hour cutoff, and malformed JSON.
- [ ] **Step 2: Run `tests/telegram-outbox-policy.test.ts`; expected: module-not-found or missing-export failure.**
- [ ] **Step 3: Implement versioned document parsing and deterministic retry helpers** without adding dependencies.
- [ ] **Step 4: Run the policy test; expected: all cases pass.**
- [ ] **Step 5: Commit types, policy, and tests.**

### Task 3: Atomic enqueue service

**Files:**
- Create: `src/server/modules/telegram/telegram-outbox.service.ts`
- Create: `tests/telegram-outbox-enqueue.test.ts`

**Interfaces:**
- Consumes: Task 2 document/key helpers and a Prisma transaction-like client.
- Produces: `enqueueTelegramOutbox(tx, { eventType, orderId, orderCode, payload, now? })`, idempotently creating `AdminAuditLog` rows with action `TELEGRAM_OUTBOX`.

- [ ] **Step 1: Write failing enqueue tests** for the exact audit-log document, deterministic unique key, replay idempotency, no secret persistence, and propagation of persistence failure to the surrounding transaction.
- [ ] **Step 2: Run `tests/telegram-outbox-enqueue.test.ts`; expected: missing-export failure.**
- [ ] **Step 3: Implement minimal enqueue logic** with `findUnique` plus create/P2002-safe replay semantics and strict payload/document construction.
- [ ] **Step 4: Run the enqueue test; expected: all cases pass.**
- [ ] **Step 5: Commit enqueue service and tests.**

### Task 4: Lease-based delivery worker and one-time admin alert

**Files:**
- Modify: `src/server/modules/telegram/telegram-outbox.service.ts`
- Modify: `src/server/modules/notifications/notifications.service.ts`
- Modify: `src/server/infrastructure/pusher.ts` only if its public type prevents dependency injection.
- Create: `tests/telegram-outbox-worker.test.ts`

**Interfaces:**
- Consumes: Task 1 sender result, Task 2 parser/retry policy, Prisma `adminAuditLog`, `user`, and `notification` delegates.
- Produces: `processTelegramOutbox(options?) -> { scanned, claimed, sent, retried, failed, skipped }` and transaction-aware admin-alert persistence.

- [ ] **Step 1: Write failing worker tests** for exact-document CAS claims, competing workers, success, retry, stale lease recovery, malformed rows, expiry, one-time admin alert, and Pusher failure isolation.
- [ ] **Step 2: Run `tests/telegram-outbox-worker.test.ts`; expected: missing worker exports.**
- [ ] **Step 3: Implement bounded candidate scanning and two-minute lease claims** guarded by row ID plus exact prior JSON.
- [ ] **Step 4: Implement lease-token-guarded `SENT`, `RETRY`, and `FAILED` transitions**, including `retry_after` and bounded/redacted error metadata.
- [ ] **Step 5: Implement one-transaction admin notification creation plus `adminAlertedAt`, then best-effort Pusher events after commit.**
- [ ] **Step 6: Run worker tests; expected: all worker state-machine cases pass.**
- [ ] **Step 7: Commit worker, alert support, and tests.**

### Task 5: Cron controller and deployment schedule

**Files:**
- Create: `src/server/modules/telegram/telegram-outbox.controller.ts`
- Create: `src/app/api/cron/process-telegram-outbox/route.ts`
- Modify: `vercel.json`
- Create: `tests/telegram-outbox-controller.test.ts`

**Interfaces:**
- Consumes: `verifyCronAuth(req)` and Task 4 worker.
- Produces: authenticated `GET`/`POST` handlers returning aggregate counts only.

- [ ] **Step 1: Write failing controller tests** for missing `CRON_SECRET`, invalid bearer, valid bearer, aggregate response, and worker failure status.
- [ ] **Step 2: Run the controller test; expected: missing route/controller failure.**
- [ ] **Step 3: Implement fail-closed handlers and add a once-per-minute Vercel cron entry.**
- [ ] **Step 4: Run the controller test; expected: all authorization and response cases pass.**
- [ ] **Step 5: Commit controller, route, schedule, and tests.**

### Task 6: Atomic new-order enqueue

**Files:**
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `tests/checkout.test.ts`

**Interfaces:**
- Consumes: Task 3 `enqueueTelegramOutbox` and existing `formatNewOrderMessage`.
- Produces: Order creation transaction that also persists `ORDER_CREATED`; removes direct post-transaction Telegram send.

- [ ] **Step 1: Add a failing checkout test** proving the outbox write uses frozen `OrderItem.productName`, occurs inside the transaction, rolls back on enqueue failure, and has no direct `sendMessage` side effect.
- [ ] **Step 2: Run focused checkout tests; expected: missing outbox write or generic product-name failure.**
- [ ] **Step 3: Move payload rendering/enqueue into the existing order transaction** after the frozen item snapshots are created and remove the fire-and-forget call.
- [ ] **Step 4: Run focused checkout tests; expected: all new-order atomicity cases pass.**
- [ ] **Step 5: Commit order integration and tests.**

### Task 7: Atomic Casso and wallet-payment enqueue

**Files:**
- Modify: `src/server/modules/payment/casso-webhook.controller.ts`
- Modify: `src/server/modules/wallet/wallet.service.ts`
- Modify: `src/server/modules/wallet/wallet-pay.controller.ts`
- Modify: `tests/wallet-vietqr-topup-idempotency.test.ts`
- Modify: `tests/wallet.test.ts` if wallet payment coverage lives there, otherwise the existing focused wallet-payment test.

**Interfaces:**
- Consumes: Task 3 enqueue API and existing paid-order formatter.
- Produces: Atomic/idempotent `PAYMENT_RECEIVED` outbox entries for the one successful Casso CAS and wallet payment transaction; removes both direct sends.

- [ ] **Step 1: Add failing Casso and wallet tests** proving enqueue is in the successful transaction, replay-safe, absent on rejected/no-op payment, and causes rollback when persistence fails.
- [ ] **Step 2: Run the focused payment tests; expected: missing outbox writes and surviving direct-send behavior.**
- [ ] **Step 3: Enqueue in the Casso transaction immediately after the payment claim/ledger update and remove its direct send.**
- [ ] **Step 4: Enqueue in `payOrderWithWallet` before returning success and remove the controller direct send.**
- [ ] **Step 5: Run focused payment tests; expected: all atomicity/idempotency cases pass.**
- [ ] **Step 6: Commit payment integrations and tests.**

### Task 8: Durable failure notification type and UI

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261020_add_system_alert_notification_type/migration.sql`
- Modify: `src/shared/types/index.ts`
- Modify: `src/client/components/notification/NotificationItem.tsx`
- Modify: `tests/telegram-outbox-worker.test.ts`

**Interfaces:**
- Consumes: Task 4 admin-alert writer.
- Produces: `SYSTEM_ALERT` as a database/shared notification type with a visible warning icon.

- [ ] **Step 1: Tighten the failing worker/UI type test** to require `SYSTEM_ALERT` persistence and client rendering compatibility.
- [ ] **Step 2: Run the focused tests/type check; expected: enum/type rejection.**
- [ ] **Step 3: Add the enum migration, Prisma enum value, shared union member, and alert icon case.**
- [ ] **Step 4: Run Prisma validation/generation and focused tests; expected: success with the model count still 34.**
- [ ] **Step 5: Commit schema/type/UI changes and tests.**

### Task 9: Fast path and full verification

**Files:**
- Modify: `src/server/modules/orders/orders.controller.ts`
- Modify: `src/server/modules/payment/casso-webhook.controller.ts`
- Modify: `src/server/modules/wallet/wallet-pay.controller.ts`
- Modify: relevant focused tests

**Interfaces:**
- Consumes: Next.js 16 `after()` and Task 4 bounded worker.
- Produces: best-effort post-response processing accelerator; durability remains owned by DB plus cron.

- [ ] **Step 1: Write failing tests around an injectable/schedulable fast-path helper** proving enqueue success schedules one bounded pass and fast-path failure cannot alter the business response.
- [ ] **Step 2: Run focused tests; expected: no scheduled worker pass.**
- [ ] **Step 3: Add a small `after()`-backed scheduling helper** and call it only after the transaction commits.
- [ ] **Step 4: Run all focused Telegram, checkout, Casso, and wallet tests; expected: success.**
- [ ] **Step 5: Run `npm run test`, `npm run test:integration`, `npm run lint`, `npm run arch:check`, `npm run schema:budget`, `npx prisma validate`, `npx prisma generate`, and `npm run build`; record every pre-existing or new failure exactly.**
- [ ] **Step 6: Commit the fast path and any verification-only corrections.**
