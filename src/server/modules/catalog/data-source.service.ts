import { prisma } from '@server/database/prisma';
import { redis } from '@server/infrastructure/redis';
import type { DataSourceType, SourceStatus } from '@shared/types/catalog';

export interface DataSourceInput {
  id?: string;
  name: string;
  sourceType: DataSourceType;
  publisher: string;
  url?: string | null;
  license?: string | null;
  market?: string | null;
  version?: string | null;
  checksum?: string | null;
  isSynthetic?: boolean;
  status?: SourceStatus | string;
  rejectionReason?: string | null;
  payload?: unknown;
}

export interface SourceTransitionInput {
  id: string;
  targetStatus: SourceStatus;
  reviewerId?: string;
  rejectionReason?: string;
}

export interface DataSourceRecord {
  id: string;
  name: string;
  sourceType: DataSourceType;
  status: SourceStatus;
  publisher: string;
  url: string | null;
  license: string | null;
  market: string | null;
  version: string | null;
  checksum: string | null;
  isSynthetic: boolean;
  reviewerId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSourceDb {
  dataSource: {
    findUnique(args: { where: { id: string } }): Promise<DataSourceRecord | null>;
    findMany(args?: {
      where?: {
        sourceType?: DataSourceType | { in: DataSourceType[] };
        status?: SourceStatus | { in: SourceStatus[] };
      };
    }): Promise<DataSourceRecord[]>;
    create(args: { data: Record<string, unknown> }): Promise<DataSourceRecord>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<DataSourceRecord>;
  };
}

export const ALLOWED_TRANSITIONS: Record<SourceStatus, SourceStatus[]> = {
  DISCOVERED: ['LICENSE_REVIEW', 'REJECTED'],
  LICENSE_REVIEW: ['MAPPING_REVIEW', 'REJECTED'],
  MAPPING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['REVOKED'],
  REJECTED: ['LICENSE_REVIEW'],
  REVOKED: ['LICENSE_REVIEW'],
};

/**
 * Tạo mới một DataSource ở trạng thái DISCOVERED
 */
export async function createDataSource(
  input: DataSourceInput,
  db: DataSourceDb = prisma as unknown as DataSourceDb
): Promise<DataSourceRecord> {
  if (!input.name || !input.name.trim()) {
    throw new Error('DataSource name is required');
  }
  if (!input.publisher || !input.publisher.trim()) {
    throw new Error('DataSource publisher is required');
  }
  if (!input.sourceType) {
    throw new Error('DataSource sourceType is required');
  }

  return await db.dataSource.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      name: input.name.trim(),
      sourceType: input.sourceType,
      status: 'DISCOVERED' as SourceStatus,
      publisher: input.publisher.trim(),
      url: input.url ?? null,
      license: input.license ?? null,
      market: input.market ?? null,
      version: input.version ?? null,
      checksum: input.checksum ?? null,
      isSynthetic: input.isSynthetic ?? false,
      reviewerId: null,
      reviewedAt: null,
      rejectionReason: null,
      payload: input.payload ?? null,
    },
  });
}

/**
 * Chuyển trạng thái DataSource theo state machine nghiêm ngặt
 */
export async function transitionDataSource(
  input: SourceTransitionInput,
  db: DataSourceDb = prisma as unknown as DataSourceDb
): Promise<DataSourceRecord> {
  const existing = await db.dataSource.findUnique({
    where: { id: input.id },
  });

  if (!existing) {
    throw new Error(`DataSource not found: ${input.id}`);
  }

  const currentStatus = existing.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(input.targetStatus)) {
    throw new Error(
      `Invalid transition: cannot transition DataSource from ${currentStatus} to ${input.targetStatus}`
    );
  }

  // 1. Kiểm tra điều kiện REJECTED
  if (input.targetStatus === 'REJECTED') {
    if (!input.rejectionReason || !input.rejectionReason.trim()) {
      throw new Error('rejectionReason is required when rejecting a DataSource');
    }
  }

  // 2. Kiểm tra điều kiện ACTIVE
  if (input.targetStatus === 'ACTIVE') {
    const reviewerId = input.reviewerId ?? existing.reviewerId;
    if (!reviewerId || !reviewerId.trim()) {
      throw new Error('Cannot activate DataSource: reviewer is required');
    }

    const license = existing.license;
    if (!license || !license.trim()) {
      throw new Error('Cannot activate DataSource: non-empty reviewed license is required');
    }

    const checksum = existing.checksum;
    if (!checksum || !checksum.trim()) {
      throw new Error('Cannot activate DataSource: non-empty checksum is required');
    }

    if (!existing.payload || typeof existing.payload !== 'object') {
      throw new Error('Cannot activate DataSource: validated payload is required');
    }
  }

  const updated = await db.dataSource.update({
    where: { id: input.id },
    data: {
      status: input.targetStatus,
      reviewerId: input.reviewerId ?? existing.reviewerId,
      reviewedAt: input.reviewerId ? new Date() : existing.reviewedAt,
      rejectionReason:
        input.targetStatus === 'REJECTED' || input.targetStatus === 'REVOKED'
          ? input.rejectionReason?.trim() ?? existing.rejectionReason
          : null,
    },
  });

  if (input.targetStatus === 'REVOKED') {
    await redis.delPattern('compat:*');
  }

  return updated;
}

/**
 * Cập nhật payload hoặc checksum của DataSource.
 * Nếu nguồn đang ở APPROVED hoặc ACTIVE, nó sẽ tự động bị hạ về MAPPING_REVIEW để kiểm định lại.
 */
export async function updateDataSourcePayloadOrChecksum(
  id: string,
  update: { checksum?: string; payload?: unknown },
  db: DataSourceDb = prisma as unknown as DataSourceDb
): Promise<DataSourceRecord> {
  const existing = await db.dataSource.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error(`DataSource not found: ${id}`);
  }

  const checksumChanged = update.checksum !== undefined && update.checksum !== existing.checksum;
  const payloadChanged = update.payload !== undefined && update.payload !== existing.payload;

  let newStatus = existing.status;
  if ((checksumChanged || payloadChanged) && (existing.status === 'APPROVED' || existing.status === 'ACTIVE')) {
    newStatus = 'MAPPING_REVIEW';
  }

  return await db.dataSource.update({
    where: { id },
    data: {
      ...(update.checksum !== undefined ? { checksum: update.checksum } : {}),
      ...(update.payload !== undefined ? { payload: update.payload } : {}),
      status: newStatus,
    },
  });
}
