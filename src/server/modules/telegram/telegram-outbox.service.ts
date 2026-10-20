import { randomUUID as nodeRandomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  formatNewOrderMessage,
  formatPaidOrderMessage,
  sendTelegramMessage,
  type SendTelegramMessageParams,
  type TelegramApiResponse,
} from '@server/infrastructure/telegram';
import { prisma } from '@server/database/prisma';
import { pusherServer } from '@server/infrastructure/pusher';
import {
  createTelegramOutboxDocument,
  getNextTelegramAttempt,
  getTelegramOutboxOperationKey,
} from '@server/modules/telegram/telegram-outbox.policy';
import {
  parseTelegramOutboxDocument,
  type TelegramOutboxDocumentV1,
  type TelegramOutboxEventType,
} from '@server/modules/telegram/telegram-outbox.types';

interface AdminAuditLogRecord {
  id: string;
}

export interface TelegramOutboxEnqueueClient {
  adminAuditLog: {
    findUnique(args: { where: { operationKey: string } }): Promise<AdminAuditLogRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<AdminAuditLogRecord>;
  };
}

export interface EnqueueTelegramOutboxInput {
  eventType: TelegramOutboxEventType;
  orderId: string;
  orderCode: string;
  payload: SendTelegramMessageParams;
  now?: Date;
}

export interface OrderCreatedTelegramInput {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: bigint | number;
  shippingFee: bigint | number;
  discountAmount: bigint | number;
  couponCode?: string | null;
  totalAmount: bigint | number;
  items: Array<{
    productName?: string | null;
    variantTitle?: string | null;
    quantity: number;
    price: bigint | number;
  }>;
}

export interface PaymentReceivedTelegramInput {
  id: string;
  orderCode: string;
  customerName: string;
  totalAmount: bigint | number;
  paymentMethod: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export async function enqueueTelegramOutbox(
  tx: TelegramOutboxEnqueueClient,
  input: EnqueueTelegramOutboxInput
): Promise<{ id: string; created: boolean }> {
  const operationKey = getTelegramOutboxOperationKey(input.eventType, input.orderId);
  const existing = await tx.adminAuditLog.findUnique({ where: { operationKey } });
  if (existing) return { id: existing.id, created: false };

  const payload: SendTelegramMessageParams = {
    text: input.payload.text,
    ...(typeof input.payload.chatId === 'string' ? { chatId: input.payload.chatId } : {}),
    ...(input.payload.replyMarkup ? { replyMarkup: input.payload.replyMarkup } : {}),
  };
  const document = createTelegramOutboxDocument(
    { eventType: input.eventType, payload },
    input.now
  );

  try {
    const created = await tx.adminAuditLog.create({
      data: {
        operationKey,
        actorId: 'system:telegram',
        actorEmail: null,
        actorRole: 'SYSTEM',
        action: 'TELEGRAM_OUTBOX',
        entityType: 'ORDER',
        entityId: input.orderId,
        beforeState: null,
        afterState: document as unknown as Prisma.InputJsonValue,
        reason: null,
        metadata: {
          eventType: input.eventType,
          orderCode: input.orderCode,
        } as Prisma.InputJsonValue,
        ipAddress: null,
        userAgent: null,
      },
    });
    return { id: created.id, created: true };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const replay = await tx.adminAuditLog.findUnique({ where: { operationKey } });
    if (!replay) throw error;
    return { id: replay.id, created: false };
  }
}

export async function enqueueOrderCreatedTelegram(
  tx: TelegramOutboxEnqueueClient,
  order: OrderCreatedTelegramInput
): Promise<{ id: string; created: boolean }> {
  const payload = formatNewOrderMessage({
    orderCode: order.orderCode,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    discountAmount: Number(order.discountAmount),
    couponCode: order.couponCode,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      name: item.productName || item.variantTitle || 'Sản phẩm',
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  });
  return enqueueTelegramOutbox(tx, {
    eventType: 'ORDER_CREATED',
    orderId: order.id,
    orderCode: order.orderCode,
    payload,
  });
}

export async function enqueuePaymentReceivedTelegram(
  tx: TelegramOutboxEnqueueClient,
  order: PaymentReceivedTelegramInput
): Promise<{ id: string; created: boolean }> {
  const payload = formatPaidOrderMessage({
    id: order.id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    totalAmount: Number(order.totalAmount),
    paymentMethod: order.paymentMethod,
  });
  return enqueueTelegramOutbox(tx, {
    eventType: 'PAYMENT_RECEIVED',
    orderId: order.id,
    orderCode: order.orderCode,
    payload,
  });
}

interface TelegramOutboxRow {
  id: string;
  operationKey: string;
  action: string;
  entityId: string;
  afterState: unknown;
  metadata: unknown;
  reason: string | null;
  createdAt: Date;
}

interface TelegramOutboxWorkerClient {
  adminAuditLog: {
    findMany(args: Record<string, unknown>): Promise<TelegramOutboxRow[]>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
  user: {
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string }>>;
  };
  notification: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    count(args: { where: { userId: string; isRead: boolean } }): Promise<number>;
  };
  $transaction<T>(callback: (tx: TelegramOutboxWorkerClient) => Promise<T>): Promise<T>;
}

interface TelegramOutboxPusher {
  trigger(channel: string, event: string, data: unknown): Promise<unknown>;
}

export interface ProcessTelegramOutboxOptions {
  db?: TelegramOutboxWorkerClient;
  sender?: (payload: SendTelegramMessageParams) => Promise<TelegramApiResponse>;
  now?: () => Date;
  randomUUID?: () => string;
  pusher?: TelegramOutboxPusher;
  batchSize?: number;
}

export interface TelegramOutboxProcessResult {
  scanned: number;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

function jsonEquals(value: unknown): Prisma.JsonFilter {
  return { equals: value as Prisma.InputJsonValue };
}

function boundedError(result: TelegramApiResponse): string {
  const category = result.failureKind || 'TELEGRAM_API';
  const description = (result.description || 'Telegram delivery failed').slice(0, 400);
  return `${category}: ${description}`.slice(0, 500);
}

function getMetadata(row: TelegramOutboxRow): { eventType?: string; orderCode?: string } {
  if (!row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) return {};
  const metadata = row.metadata as Record<string, unknown>;
  return {
    eventType: typeof metadata.eventType === 'string' ? metadata.eventType : undefined,
    orderCode: typeof metadata.orderCode === 'string' ? metadata.orderCode : undefined,
  };
}

async function alertAdminsOnce(
  db: TelegramOutboxWorkerClient,
  row: TelegramOutboxRow,
  failedDocument: TelegramOutboxDocumentV1,
  now: Date,
  pusher: TelegramOutboxPusher
): Promise<void> {
  if (failedDocument.adminAlertedAt) return;
  const alertedDocument: TelegramOutboxDocumentV1 = {
    ...failedDocument,
    adminAlertedAt: now.toISOString(),
  };
  const metadata = getMetadata(row);

  const createdNotifications = await db.$transaction(async (tx) => {
    const guarded = await tx.adminAuditLog.updateMany({
      where: {
        id: row.id,
        afterState: jsonEquals(failedDocument),
      },
      data: { afterState: alertedDocument as unknown as Prisma.InputJsonValue },
    });
    if (guarded.count !== 1) return [];

    const admins = await tx.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const notifications: Array<{
      notification: Record<string, unknown>;
      unreadCount: number;
    }> = [];
    for (const admin of admins) {
      const notification = await tx.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM_ALERT',
          title: 'Gửi Telegram thất bại',
          message: `Đã dừng gửi Telegram cho đơn ${metadata.orderCode || row.entityId} sau 24 giờ.`,
          data: {
            outboxId: row.id,
            operationKey: row.operationKey,
            eventType: failedDocument.eventType,
            orderId: row.entityId,
            ...(metadata.orderCode ? { orderCode: metadata.orderCode } : {}),
            attemptCount: failedDocument.attemptCount,
            lastError: failedDocument.lastError,
          },
        },
      });
      const unreadCount = await tx.notification.count({
        where: { userId: admin.id, isRead: false },
      });
      notifications.push({ notification, unreadCount });
    }
    return notifications;
  });

  try {
    for (const { notification, unreadCount } of createdNotifications) {
      await pusher.trigger(
        `private-user-${String(notification.userId)}`,
        'new-notification',
        { ...notification, unreadCount }
      );
    }
    if (createdNotifications.length > 0) {
      await pusher.trigger('private-admin-channel', 'telegram-delivery-failed', {
        outboxId: row.id,
        orderId: row.entityId,
        orderCode: metadata.orderCode,
      });
    }
  } catch (error) {
    console.error('[Telegram Outbox] Pusher alert failed:', {
      outboxId: row.id,
      error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown Pusher error',
    });
  }
}

function isDue(document: TelegramOutboxDocumentV1, now: Date): boolean {
  if (
    (document.status === 'PENDING' || document.status === 'RETRY') &&
    Date.parse(document.nextAttemptAt) <= now.getTime()
  ) {
    return true;
  }
  return (
    document.status === 'PROCESSING' &&
    document.leaseExpiresAt !== null &&
    Date.parse(document.leaseExpiresAt) <= now.getTime()
  );
}

function malformedFailedDocument(row: TelegramOutboxRow, now: Date): TelegramOutboxDocumentV1 {
  const metadata = getMetadata(row);
  return {
    kind: 'TELEGRAM_OUTBOX',
    version: 1,
    status: 'FAILED',
    eventType: metadata.eventType === 'PAYMENT_RECEIVED' ? 'PAYMENT_RECEIVED' : 'ORDER_CREATED',
    payload: { text: '[Malformed Telegram outbox payload]' },
    attemptCount: 0,
    firstAttemptAt: null,
    lastAttemptAt: now.toISOString(),
    nextAttemptAt: now.toISOString(),
    expiresAt: now.toISOString(),
    leaseToken: null,
    leaseExpiresAt: null,
    sentAt: null,
    telegramMessageId: null,
    lastError: 'VALIDATION: Malformed Telegram outbox document',
    adminAlertedAt: null,
  };
}

export async function processTelegramOutbox(
  options: ProcessTelegramOutboxOptions = {}
): Promise<TelegramOutboxProcessResult> {
  const db = options.db ?? (prisma as unknown as TelegramOutboxWorkerClient);
  const sender = options.sender ?? sendTelegramMessage;
  const clock = options.now ?? (() => new Date());
  const makeLeaseToken = options.randomUUID ?? nodeRandomUUID;
  const pusher = options.pusher ?? pusherServer;
  const now = clock();
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 50, 200));
  const activeRows = await db.adminAuditLog.findMany({
    where: {
      action: 'TELEGRAM_OUTBOX',
      OR: ['PENDING', 'RETRY', 'PROCESSING'].map((status) => ({
        afterState: { path: ['status'], equals: status },
      })),
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });
  // Keep a small validation window so malformed documents still fail closed,
  // while the active-status query prevents old terminal rows from starving work.
  const validationRows = await db.adminAuditLog.findMany({
    where: { action: 'TELEGRAM_OUTBOX' },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });
  const rows = Array.from(
    new Map([...activeRows, ...validationRows].map((row) => [row.id, row])).values()
  );
  const result: TelegramOutboxProcessResult = {
    scanned: rows.length,
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const current = parseTelegramOutboxDocument(row.afterState);
    if (!current) {
      const failedDocument = malformedFailedDocument(row, now);
      const marked = await db.adminAuditLog.updateMany({
        where: { id: row.id, afterState: jsonEquals(row.afterState) },
        data: {
          afterState: failedDocument as unknown as Prisma.InputJsonValue,
          reason: failedDocument.lastError,
        },
      });
      if (marked.count === 1) {
        result.failed += 1;
        await alertAdminsOnce(db, row, failedDocument, now, pusher);
      } else {
        result.skipped += 1;
      }
      continue;
    }

    if (!isDue(current, now)) {
      result.skipped += 1;
      continue;
    }

    const leaseToken = makeLeaseToken();
    const claimedDocument: TelegramOutboxDocumentV1 = {
      ...current,
      status: 'PROCESSING',
      attemptCount: current.attemptCount + 1,
      firstAttemptAt: current.firstAttemptAt ?? now.toISOString(),
      lastAttemptAt: now.toISOString(),
      leaseToken,
      leaseExpiresAt: new Date(now.getTime() + 2 * 60_000).toISOString(),
    };
    const claimed = await db.adminAuditLog.updateMany({
      where: { id: row.id, afterState: jsonEquals(current) },
      data: { afterState: claimedDocument as unknown as Prisma.InputJsonValue },
    });
    if (claimed.count !== 1) {
      result.skipped += 1;
      continue;
    }
    result.claimed += 1;

    const delivery = await sender(claimedDocument.payload);
    if (delivery.ok) {
      const sentDocument: TelegramOutboxDocumentV1 = {
        ...claimedDocument,
        status: 'SENT',
        leaseToken: null,
        leaseExpiresAt: null,
        sentAt: now.toISOString(),
        telegramMessageId: delivery.messageId ?? null,
        lastError: null,
      };
      const completed = await db.adminAuditLog.updateMany({
        where: { id: row.id, afterState: jsonEquals(claimedDocument) },
        data: {
          afterState: sentDocument as unknown as Prisma.InputJsonValue,
          reason: null,
        },
      });
      if (completed.count === 1) result.sent += 1;
      else result.skipped += 1;
      continue;
    }

    const lastError = boundedError(delivery);
    const nextAttempt = getNextTelegramAttempt(
      claimedDocument.attemptCount,
      now,
      new Date(claimedDocument.expiresAt),
      delivery.retryAfterSeconds
    );
    const failedDocument: TelegramOutboxDocumentV1 = {
      ...claimedDocument,
      status: nextAttempt ? 'RETRY' : 'FAILED',
      nextAttemptAt: nextAttempt?.toISOString() ?? claimedDocument.nextAttemptAt,
      leaseToken: null,
      leaseExpiresAt: null,
      lastError,
    };
    const failed = await db.adminAuditLog.updateMany({
      where: { id: row.id, afterState: jsonEquals(claimedDocument) },
      data: {
        afterState: failedDocument as unknown as Prisma.InputJsonValue,
        reason: lastError,
      },
    });
    if (failed.count !== 1) {
      result.skipped += 1;
      continue;
    }
    if (nextAttempt) {
      result.retried += 1;
    } else {
      result.failed += 1;
      await alertAdminsOnce(db, row, failedDocument, now, pusher);
    }
  }

  return result;
}
