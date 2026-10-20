import type { SendTelegramMessageParams } from '@server/infrastructure/telegram';
import type {
  TelegramOutboxDocumentV1,
  TelegramOutboxEventType,
} from '@server/modules/telegram/telegram-outbox.types';

const RETRY_DELAYS_MINUTES = [1, 2, 5, 10, 30, 60] as const;
const OUTBOX_LIFETIME_MS = 24 * 60 * 60 * 1_000;

export function getTelegramOutboxOperationKey(
  eventType: TelegramOutboxEventType,
  orderId: string
): string {
  const eventKey = eventType === 'ORDER_CREATED' ? 'order-created' : 'payment-received';
  return `telegram:${eventKey}:${orderId}`;
}

export function createTelegramOutboxDocument(
  input: { eventType: TelegramOutboxEventType; payload: SendTelegramMessageParams },
  now: Date = new Date()
): TelegramOutboxDocumentV1 {
  return {
    kind: 'TELEGRAM_OUTBOX',
    version: 1,
    status: 'PENDING',
    eventType: input.eventType,
    payload: input.payload,
    attemptCount: 0,
    firstAttemptAt: null,
    lastAttemptAt: null,
    nextAttemptAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + OUTBOX_LIFETIME_MS).toISOString(),
    leaseToken: null,
    leaseExpiresAt: null,
    sentAt: null,
    telegramMessageId: null,
    lastError: null,
    adminAlertedAt: null,
  };
}

export function getNextTelegramAttempt(
  attemptCount: number,
  now: Date,
  expiresAt: Date,
  retryAfterSeconds?: number
): Date | null {
  const scheduleIndex = Math.max(0, Math.min(attemptCount - 1, RETRY_DELAYS_MINUTES.length - 1));
  const scheduledDelayMs = RETRY_DELAYS_MINUTES[scheduleIndex] * 60_000;
  const retryAfterMs = Number.isFinite(retryAfterSeconds) && (retryAfterSeconds as number) > 0
    ? Math.floor(retryAfterSeconds as number) * 1_000
    : 0;
  const next = new Date(now.getTime() + Math.max(scheduledDelayMs, retryAfterMs));
  return next.getTime() < expiresAt.getTime() ? next : null;
}
