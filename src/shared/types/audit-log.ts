export interface AdminAuditInput {
  operationKey: string;
  actorId: string;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminAuditLogDto {
  id: string;
  operationKey: string;
  actorId: string;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}
