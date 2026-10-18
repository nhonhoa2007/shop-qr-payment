import { maskIdentifier } from '@server/modules/inventory/serialized-unit.service';
import type { AdminAuditInput, AdminAuditLogDto } from '@shared/types/audit-log';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /otp/i,
  /apiKey/i,
  /auth(orization)?/i,
  /rawWebhook/i,
  /cookie/i,
  /creditCard/i,
  /cvv/i,
  /accountNo/i,
];

const IDENTIFIER_KEYS = ['serialNumber', 'imei1', 'imei2'];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactAuditPayload(action: string, payload: unknown): any {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactAuditPayload(action, item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (IDENTIFIER_KEYS.includes(key) && typeof value === 'string') {
      result[key] = maskIdentifier(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactAuditPayload(action, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function appendAdminAudit(
  tx: any,
  input: AdminAuditInput
): Promise<void> {
  const existing = await tx.adminAuditLog.findUnique({
    where: { operationKey: input.operationKey },
  });

  if (existing) {
    // Idempotent replay: already recorded
    return;
  }

  const redactedBefore = input.beforeState ? redactAuditPayload(input.action, input.beforeState) : null;
  const redactedAfter = input.afterState ? redactAuditPayload(input.action, input.afterState) : null;
  const redactedMeta = input.metadata ? redactAuditPayload(input.action, input.metadata) : null;

  await tx.adminAuditLog.create({
    data: {
      operationKey: input.operationKey,
      actorId: input.actorId,
      actorEmail: input.actorEmail ?? null,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: redactedBefore,
      afterState: redactedAfter,
      reason: input.reason ?? null,
      metadata: redactedMeta,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function listAdminAuditLogs(
  tx: any,
  filter: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: AdminAuditLogDto[]; total: number }> {
  const where: any = {};
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.actorId) where.actorId = filter.actorId;
  if (filter.action) where.action = filter.action;

  const [logs, total] = await Promise.all([
    tx.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    }),
    tx.adminAuditLog.count({ where }),
  ]);

  return { logs, total };
}
