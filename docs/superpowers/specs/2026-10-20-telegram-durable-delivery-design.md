# Telegram Durable Delivery Design

**Date:** 2026-10-20
**Status:** Approved in conversation, pending builder review
**Scope:** Outbound Telegram notifications for new orders and successful order payments

## Intent

Telegram notifications currently use unawaited fire-and-forget calls from route handlers. On serverless deployments those calls may be terminated after the HTTP response, and missing credentials return an ignored `{ ok: false }` result. The feature must become observable and durable without making order creation or payment fail merely because Telegram is unavailable.

The desired behavior is:

- Persist every outbound Telegram notification before the associated successful business transaction is committed.
- Deliver it asynchronously so checkout/payment latency and success do not depend on Telegram.
- Retry failures for up to 24 hours and resume after process restart or redeploy.
- After 24 hours, preserve the failed task for manual inspection/replay and alert administrators through the in-app database notification system plus Pusher.

## Goals

1. New-order and payment-success Telegram notifications survive server restarts.
2. The business mutation and the intent to notify are atomic: either both commit or neither commits.
3. Delivery retries use bounded exponential backoff and honor Telegram `retry_after` when present.
4. Concurrent cron invocations cannot intentionally process the same task at the same time.
5. Missing credentials, Telegram API errors, non-JSON responses, network failures, and timeouts are recorded visibly.
6. Administrators receive one in-app/Pusher alert when a task exhausts its 24-hour retry window.
7. Existing inbound Telegram callback behavior remains unchanged.
8. New-order messages use the frozen `OrderItem.productName` rather than the generic `Sản phẩm` placeholder.

## Non-goals

- Providing exactly-once delivery, which the Telegram Bot API does not support because it accepts no idempotency key.
- Building a general-purpose job queue or adding Redis as the durable source of truth.
- Retrying inbound Telegram webhook callbacks.
- Adding Telegram notifications to every manual admin order transition in this change.
- Building the manual replay UI in this change. Failed entries remain queryable in the database and can be replayed through a later admin operation.

## Constraints and architectural decision

The project has a locked 34-model Prisma schema. Adding a dedicated `TelegramOutbox` model would violate that lock. The durable queue will therefore reuse the existing `AdminAuditLog` table as an append/update operational ledger, without adding a model:

- `operationKey`: deterministic unique key `telegram:<event>:<orderId>`; provides enqueue idempotency.
- `action`: `TELEGRAM_OUTBOX`.
- `entityType`: `ORDER`.
- `entityId`: order ID.
- `actorId`: stable system actor such as `system:telegram`.
- `actorRole`: `SYSTEM`.
- `beforeState`: null.
- `afterState`: a versioned, strictly validated JSON document containing the queue state and Telegram payload.
- `reason`: final/last failure summary, redacted and length-bounded.
- `metadata`: immutable event metadata such as event type and order code.

Although `AdminAuditLog` was originally append-oriented, this use is intentionally a compact-schema exception: only records with `action = TELEGRAM_OUTBOX` may update their `afterState` state-machine document. Existing administrative audit-log writers/readers keep their append-only behavior. The registry count remains 34.

## Queue document

The `afterState` JSON document uses a discriminator and version so malformed or legacy rows fail closed:

```ts
interface TelegramOutboxDocumentV1 {
  kind: 'TELEGRAM_OUTBOX';
  version: 1;
  status: 'PENDING' | 'PROCESSING' | 'RETRY' | 'SENT' | 'FAILED';
  eventType: 'ORDER_CREATED' | 'PAYMENT_RECEIVED';
  payload: {
    text: string;
    chatId?: string;
    replyMarkup?: Record<string, unknown>;
  };
  attemptCount: number;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string;
  expiresAt: string;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  sentAt: string | null;
  telegramMessageId: number | null;
  lastError: string | null;
  adminAlertedAt: string | null;
}
```

Secrets are never persisted. Only the rendered message, optional target chat ID, and reply markup are stored. In normal use the chat ID is omitted and resolved from configuration at delivery time.

## Enqueue flow

### New order

Inside the existing order-creation Prisma transaction:

1. Reserve inventory.
2. Create the order and frozen order-item snapshots.
3. Apply coupon usage.
4. Render the Telegram payload from the committed order snapshot (`productName`, `variantTitle`, quantity, unit price).
5. Upsert/create the `AdminAuditLog` outbox record with operation key `telegram:order-created:<orderId>`.
6. Commit.

If outbox persistence fails, the order transaction rolls back. This is required to guarantee durable notification intent. Telegram availability or credentials are not checked at enqueue time.

### Casso payment

Inside the same transaction that atomically changes `UNPAID -> PAID` and applies the `BankTransfer`:

1. Claim and update the order.
2. Apply the bank transfer.
3. Enqueue `telegram:payment-received:<orderId>` with the rendered paid-order payload.
4. Commit.

Duplicate/replayed Casso webhooks do not enqueue duplicate messages because both the payment state CAS and unique operation key are idempotent.

### Wallet payment

`payOrderWithWallet` already executes inside a Prisma transaction. After the order CAS and financial ledger writes, it enqueues `telegram:payment-received:<orderId>` through the transaction client before returning success. The wallet controller no longer sends Telegram directly.

## Delivery worker

A new authenticated route, `GET|POST /api/cron/process-telegram-outbox`, calls a domain service that processes a bounded batch. `vercel.json` schedules it every minute. The existing `verifyCronAuth` fail-closed authorization is reused.

The service accepts a clock and sender dependency for unit tests. Default values are the real clock and `sendTelegramMessage`.

### Claiming

The worker queries candidate `TELEGRAM_OUTBOX` records whose validated document is:

- `PENDING` or `RETRY` with `nextAttemptAt <= now`, or
- `PROCESSING` with an expired lease.

Because the queue fields live in JSON, candidate rows are fetched in a bounded oldest-first window and validated/filtered in application code. For each candidate the worker claims with an atomic `updateMany` compare-and-swap over the row ID and exact previous `afterState` JSON. A successful claim replaces the document with:

- `status = PROCESSING`
- a random `leaseToken`
- `leaseExpiresAt = now + 2 minutes`
- incremented `attemptCount`
- updated attempt timestamps

Only `count === 1` owns the lease. The worker reclaims stale leases after two minutes, allowing recovery after process termination.

### Sending and completion

The sender has a finite timeout. It returns structured data including HTTP status, Telegram description, and optional `retryAfterSeconds`.

On success, an atomic update guarded by the lease token changes the record to `SENT`, clears the lease, records `sentAt` and `telegramMessageId`, and clears the last error.

A process can crash after Telegram accepts a message but before `SENT` is persisted. The stale lease will later retry, so duplicate messages remain possible. This is an explicit at-least-once trade-off and should be rare; exact once cannot be guaranteed with Telegram's API.

## Retry policy and 24-hour deadline

`expiresAt` is fixed to enqueue time plus 24 hours. A failed attempt is retryable while the computed next attempt is before that deadline.

The default backoff is exponential with a cap and deterministic upper bounds suitable for a one-minute cron, for example:

- attempt 1: 1 minute
- attempt 2: 2 minutes
- attempt 3: 5 minutes
- attempt 4: 10 minutes
- attempt 5: 30 minutes
- later attempts: 60 minutes

For HTTP 429, `retry_after` is honored when it is longer than the normal delay, bounded by the 24-hour deadline. Network failures, timeouts, missing credentials, non-JSON responses, and Telegram `5xx` are retryable. Permanent-looking `4xx` errors are also retained and retried during the 24-hour window because configuration, chat membership, markup, or bot authorization can be corrected without recreating the business event.

When no next retry fits before `expiresAt`, the record becomes `FAILED` and the worker performs the admin alert step.

## Administrator failure alert

After marking a record `FAILED`, the worker finds all users with role `ADMIN` and creates one notification per administrator:

- type: new `SYSTEM_ALERT` enum value
- title: `Gửi Telegram thất bại`
- message: identifies the event/order and states that retrying stopped after 24 hours
- data: outbox record ID, operation key, event type, order ID/order code, attempt count, and redacted last error

`createNotification` persists the notification and sends `new-notification` to each administrator's private Pusher channel. In addition, the worker sends a lightweight `telegram-delivery-failed` event on `private-admin-channel` for admin dashboard consumers. Pusher failures are logged but do not roll the queue record back or duplicate database notifications.

Alert idempotency is controlled by `adminAlertedAt`. The worker creates database notifications and records `adminAlertedAt` in one Prisma transaction. Replayed workers skip notification creation when that field is already set. Pusher is best-effort after commit.

The shared notification type and icon renderer are extended for `SYSTEM_ALERT`.

## Telegram transport hardening

`sendTelegramMessage` will:

- distinguish missing configuration from network/API errors;
- use an abort timeout;
- safely parse non-JSON responses;
- expose HTTP status and Telegram `retry_after`;
- redact the bot token from all error strings/log output;
- return a structured failure rather than throwing for expected transport failures.

Inbound `editTelegramMessage` and `answerCallbackQuery` retain their existing behavior unless shared parsing can be reused without changing semantics.

## Processing triggers

1. **Primary:** Vercel cron invokes the worker every minute.
2. **Best-effort fast path:** after an outbox row commits, a Next.js `after()` callback may invoke one bounded worker pass so notifications usually arrive without waiting for cron. This callback is only an accelerator; durability and recovery rely solely on the database plus cron. Errors are logged and left for cron.
3. **Restart behavior:** no in-memory state is required. At the next cron invocation, due and stale-leased records are discovered from the database.

## Observability

Each cron response reports aggregate counts only:

- scanned
- claimed
- sent
- retried
- failed
- skipped/malformed

Logs include outbox ID, operation key, attempt number, next retry time, and redacted failure category. They never include the bot token or full customer message payload.

Malformed outbox JSON is marked `FAILED` with a bounded validation error and follows the same one-time administrator alert path.

## Tests

### Unit tests

- Queue document validation and rejection of malformed JSON.
- Deterministic operation keys and idempotent enqueue.
- Backoff sequence and 24-hour cutoff.
- Telegram timeout, network error, non-JSON response, 429 `retry_after`, 4xx, 5xx, and success metadata.
- Claim CAS: two workers cannot both own the same current document.
- Stale lease recovery after a simulated restart.
- Success transition guarded by lease token.
- Failure transition and one-time admin alert.
- Product names come from the frozen order item snapshot.

### Controller/integration tests

- Order creation transaction includes outbox persistence.
- Casso payment transition and outbox enqueue are atomic/idempotent.
- Wallet payment and outbox enqueue are atomic/idempotent.
- Cron auth fails closed without `CRON_SECRET` and rejects invalid credentials.
- Cron handler returns processing counts.
- Existing inbound Telegram webhook tests continue passing.

### Verification

Run focused Telegram/outbox tests first, then:

- full unit suite
- integration suite
- lint
- architecture boundary check
- Prisma validation/generation
- production build

The schema model count remains exactly 34, so the locked schema-budget checks must continue to pass unchanged.

## Builder-owned implementation details

The builder may choose exact helper/function names, batch/window sizes, timeout within a reasonable serverless limit, and bounded log/error lengths, provided all invariants above remain true. No new dependency or Prisma model should be introduced unless this design is explicitly revisited.
