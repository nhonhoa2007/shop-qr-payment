import { prisma } from '@server/database/prisma.ts';
import {
  isEvidenceApplicable,
  resolveEvidenceProvenance,
} from '@shared/validations/evidence-json.ts';
import type {
  EvidenceQuery,
  EvidenceRecord,
  BenchmarkMeasurementDto,
} from '@shared/types/intelligence.ts';

export interface RawDataSource {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  publisher: string;
  url?: string | null;
  license?: string | null;
  market?: string | null;
  version?: string | null;
  checksum?: string | null;
  isSynthetic: boolean;
  payload?: unknown;
}

export interface RawBenchmarkMeasurement {
  id: string;
  sourceId: string;
  productId: string;
  variantId?: string | null;
  metric: string;
  value: number;
  unit: string;
  methodology?: string | null;
  measuredAt?: Date | string | null;
  version: number;
  sampleSize: number;
  source?: RawDataSource;
}

export interface IntelligenceDb {
  dataSource: {
    findMany(args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
    }): Promise<RawDataSource[]>;
  };
  benchmarkMeasurement?: {
    findMany(args?: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<RawBenchmarkMeasurement[]>;
  };
}

// In-memory cache for fast retrieval with TTL
interface CacheEntry {
  records: EvidenceRecord[];
  expiresAt: number;
}

const evidenceCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function buildCacheKey(query: EvidenceQuery): string {
  return [
    query.productId,
    query.variantId || '',
    query.market || '',
    (query.sourceTypes || []).sort().join(','),
    query.includeSynthetic ? '1' : '0',
  ].join('::');
}

/**
 * Xóa cache bằng chứng khi có sự kiện active hoặc revoke DataSource
 */
export async function invalidateEvidenceCache(productId?: string): Promise<void> {
  if (!productId) {
    evidenceCache.clear();
    return;
  }
  for (const key of evidenceCache.keys()) {
    if (key.startsWith(productId + '::')) {
      evidenceCache.delete(key);
    }
  }
}

/**
 * Liệt kê tất cả các bằng chứng hợp lệ, còn hiệu lực và được cấp phép
 */
export async function listActiveEvidence(
  query: EvidenceQuery,
  dbClient?: IntelligenceDb
): Promise<EvidenceRecord[]> {
  const cacheKey = buildCacheKey(query);
  const cached = evidenceCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.records;
  }

  const client = dbClient || (prisma as unknown as IntelligenceDb);

  // 1. Fetch active data sources
  const dataSources = await client.dataSource.findMany({
    where: {
      status: 'ACTIVE',
      ...(query.sourceTypes && query.sourceTypes.length > 0
        ? { sourceType: { in: query.sourceTypes } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch benchmark measurements if benchmark table exists in client
  let benchmarkRows: RawBenchmarkMeasurement[] = [];
  if (client.benchmarkMeasurement && typeof client.benchmarkMeasurement.findMany === 'function') {
    benchmarkRows = await client.benchmarkMeasurement.findMany({
      where: {
        productId: query.productId,
        ...(query.variantId ? { variantId: query.variantId } : {}),
      },
      include: {
        source: true,
      },
    });
  }

  // 3. Filter data sources according to evidence applicability rules
  const eligibleSources = dataSources.filter((source: RawDataSource) =>
    isEvidenceApplicable(source, query)
  );

  // 4. Map and group benchmarks by sourceId
  const benchmarksBySource = new Map<string, BenchmarkMeasurementDto[]>();
  for (const b of benchmarkRows) {
    // Only accept benchmarks from active and licensed sources
    const src = b.source;
    if (src && src.status !== 'ACTIVE') continue;
    if (src && (!src.license || !src.license.trim())) continue;
    if (src && src.isSynthetic && !query.includeSynthetic) continue;

    const dto: BenchmarkMeasurementDto = {
      id: b.id,
      sourceId: b.sourceId,
      productId: b.productId,
      variantId: b.variantId ?? null,
      metric: b.metric,
      value: Number(b.value),
      unit: b.unit,
      methodology: b.methodology ?? null,
      measuredAt: b.measuredAt ? new Date(b.measuredAt).toISOString() : null,
      version: b.version,
      sampleSize: b.sampleSize,
    };

    if (!benchmarksBySource.has(b.sourceId)) {
      benchmarksBySource.set(b.sourceId, []);
    }
    benchmarksBySource.get(b.sourceId)!.push(dto);
  }

  // 5. Construct EvidenceRecord results
  const records: EvidenceRecord[] = [];

  for (const source of eligibleSources) {
    const benchmarks = benchmarksBySource.get(source.id) || [];

    records.push({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      status: source.status,
      publisher: source.publisher,
      url: source.url ?? null,
      license: source.license ?? null,
      market: source.market ?? null,
      version: source.version ?? null,
      checksum: source.checksum ?? null,
      isSynthetic: source.isSynthetic,
      provenance: resolveEvidenceProvenance(source),
      payload: source.payload,
      benchmarks: benchmarks.length > 0 ? benchmarks : undefined,
    });
  }

  // Cache results
  evidenceCache.set(cacheKey, {
    records,
    expiresAt: now + CACHE_TTL_MS,
  });

  return records;
}
