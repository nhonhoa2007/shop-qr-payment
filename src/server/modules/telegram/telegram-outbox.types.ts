import type { SendTelegramMessageParams } from '@server/infrastructure/telegram';

export type TelegramOutboxStatus = 'PENDING' | 'PROCESSING' | 'RETRY' | 'SENT' | 'FAILED';
export type TelegramOutboxEventType = 'ORDER_CREATED' | 'PAYMENT_RECEIVED';

export interface TelegramOutboxDocumentV1 {
  kind: 'TELEGRAM_OUTBOX';
  version: 1;
  status: TelegramOutboxStatus;
  eventType: TelegramOutboxEventType;
  payload: SendTelegramMessageParams;
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

const STATUSES = new Set<TelegramOutboxStatus>([
  'PENDING',
  'PROCESSING',
  'RETRY',
  'SENT',
  'FAILED',
]);
const EVENT_TYPES = new Set<TelegramOutboxEventType>(['ORDER_CREATED', 'PAYMENT_RECEIVED']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function parsePayload(value: unknown): SendTelegramMessageParams | null {
  if (!isRecord(value) || typeof value.text !== 'string' || value.text.length === 0) return null;
  const allowed = new Set(['text', 'chatId', 'replyMarkup']);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  if (value.chatId !== undefined && typeof value.chatId !== 'string') return null;
  if (value.replyMarkup !== undefined && !isRecord(value.replyMarkup)) return null;
  return {
    text: value.text,
    ...(typeof value.chatId === 'string' ? { chatId: value.chatId } : {}),
    ...(isRecord(value.replyMarkup) ? { replyMarkup: value.replyMarkup } : {}),
  };
}

export function parseTelegramOutboxDocument(value: unknown): TelegramOutboxDocumentV1 | null {
  if (!isRecord(value)) return null;
  const payload = parsePayload(value.payload);
  if (
    value.kind !== 'TELEGRAM_OUTBOX' ||
    value.version !== 1 ||
    typeof value.status !== 'string' ||
    !STATUSES.has(value.status as TelegramOutboxStatus) ||
    typeof value.eventType !== 'string' ||
    !EVENT_TYPES.has(value.eventType as TelegramOutboxEventType) ||
    !payload ||
    !Number.isInteger(value.attemptCount) ||
    (value.attemptCount as number) < 0 ||
    !isNullableIsoDate(value.firstAttemptAt) ||
    !isNullableIsoDate(value.lastAttemptAt) ||
    !isIsoDate(value.nextAttemptAt) ||
    !isIsoDate(value.expiresAt) ||
    (value.leaseToken !== null && typeof value.leaseToken !== 'string') ||
    !isNullableIsoDate(value.leaseExpiresAt) ||
    !isNullableIsoDate(value.sentAt) ||
    (value.telegramMessageId !== null && !Number.isInteger(value.telegramMessageId)) ||
    (value.lastError !== null && typeof value.lastError !== 'string') ||
    !isNullableIsoDate(value.adminAlertedAt)
  ) {
    return null;
  }

  return {
    kind: 'TELEGRAM_OUTBOX',
    version: 1,
    status: value.status as TelegramOutboxStatus,
    eventType: value.eventType as TelegramOutboxEventType,
    payload,
    attemptCount: value.attemptCount as number,
    firstAttemptAt: value.firstAttemptAt as string | null,
    lastAttemptAt: value.lastAttemptAt as string | null,
    nextAttemptAt: value.nextAttemptAt,
    expiresAt: value.expiresAt,
    leaseToken: value.leaseToken as string | null,
    leaseExpiresAt: value.leaseExpiresAt as string | null,
    sentAt: value.sentAt as string | null,
    telegramMessageId: value.telegramMessageId as number | null,
    lastError: value.lastError as string | null,
    adminAlertedAt: value.adminAlertedAt as string | null,
  };
}
