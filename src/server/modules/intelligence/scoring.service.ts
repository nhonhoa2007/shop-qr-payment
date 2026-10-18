import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@server/database/prisma.ts';
import { formatVND } from '@shared/utils/index.ts';
import { scoreProduct } from './scoring.engine.ts';
import { getCategoryScoringConfig } from './scoring-config.service.ts';
import type {
  RecomputeInput,
  RecomputeReport,
  ScoreSnapshotDto,
  ScoreInput,
  UseCaseScoringConfig,
} from '@shared/types/intelligence.ts';

export type PrismaClientOrTx = Prisma.TransactionClient | PrismaClient;

interface BenchmarkWithSource {
  id?: string;
  variantId?: string | null;
  metric: string;
  value: number;
  sourceId: string;
  version?: number | null;
  source?: {
    status: string;
  } | null;
}

export function buildRevisionKey(params: {
  productId: string;
  variantId?: string | null;
  useCase: string;
  rubricVersion: number;
  sourceSetHash: string;
  priceSnapshot: string;
}): string {
  const vId = params.variantId || 'base';
  return `${params.productId}:${vId}:${params.useCase}:${params.rubricVersion}:${params.sourceSetHash}:${params.priceSnapshot}`;
}

export function resolveGoodValueBadge(params: {
  finalScore: number;
  priceEfficiency: number;
  coverage: number;
  status: string;
}): boolean {
  if (params.status !== 'ACTIVE') {
    return false;
  }
  if (params.coverage < 0.6) {
    return false;
  }
  return (
    params.finalScore >= 80 ||
    (params.finalScore >= 75 && params.priceEfficiency >= 80)
  );
}

export async function recomputeScores(
  input: RecomputeInput,
  actor?: { id: string; role: string },
  db?: PrismaClientOrTx
): Promise<RecomputeReport> {
  if (actor && actor.role !== 'ADMIN') {
    throw new Error('Forbidden: Only ADMIN can recompute and publish score snapshots');
  }

  const client = db ?? defaultPrisma;
  const report: RecomputeReport = {
    totalProcessed: 0,
    publishedCount: 0,
    abstainedCount: 0,
    supersededCount: 0,
    goodValueCount: 0,
    errors: [],
  };

  const whereProduct: Record<string, unknown> = {};
  if (input.productId) {
    whereProduct.id = input.productId;
  }
  if (input.categoryId) {
    whereProduct.categoryId = input.categoryId;
  }

  const products = await client.product.findMany({
    where: whereProduct,
    include: {
      categoryRef: true,
      variants: true,
      benchmarks: {
        include: { source: true },
      },
    },
  });

  for (const product of products) {
    const categoryId = product.categoryId;
    if (!categoryId) {
      continue;
    }

    let config;
    try {
      config = await getCategoryScoringConfig(
        categoryId,
        client as unknown as { category: { findUnique: (args: unknown) => Promise<{ id: string; kind: string; slug: string; scoringConfig?: unknown } | null>; update: (args: unknown) => Promise<unknown> } }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push(`Failed to get scoring config for category ${categoryId}: ${message}`);
      continue;
    }

    const useCasesToRun = input.useCase
      ? [input.useCase]
      : Object.keys(config.useCases);

    const itemsToScore: Array<{
      variantId?: string | null;
      price: bigint;
      specs: Record<string, unknown>;
      benchmarks: Array<{ metric: string; value: number; sourceId: string; version: number }>;
    }> = [];

    const baseBenchmarks = ((product.benchmarks || []) as unknown as BenchmarkWithSource[])
      .filter((b) => (!b.variantId || b.variantId === null) && (!b.source || b.source.status === 'ACTIVE'))
      .map((b) => ({
        metric: b.metric,
        value: b.value,
        sourceId: b.sourceId,
        version: b.version ?? 1,
      }));

    itemsToScore.push({
      variantId: null,
      price: product.price,
      specs: (product.specs as Record<string, unknown>) || {},
      benchmarks: baseBenchmarks,
    });

    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (input.variantId && variant.id !== input.variantId) {
          continue;
        }
        const variantBenchmarks = ((product.benchmarks || []) as unknown as BenchmarkWithSource[])
          .filter((b) => b.variantId === variant.id && (!b.source || b.source.status === 'ACTIVE'))
          .map((b) => ({
            metric: b.metric,
            value: b.value,
            sourceId: b.sourceId,
            version: b.version ?? 1,
          }));

        const mergedBenchmarks = [...variantBenchmarks];
        for (const bb of baseBenchmarks) {
          if (!mergedBenchmarks.some((mb) => mb.metric === bb.metric)) {
            mergedBenchmarks.push(bb);
          }
        }

        const variantSpecs = {
          ...((product.specs as Record<string, unknown>) || {}),
          ...((variant.specOverrides as Record<string, unknown>) || {}),
        };

        itemsToScore.push({
          variantId: variant.id,
          price: variant.price,
          specs: variantSpecs,
          benchmarks: mergedBenchmarks,
        });
      }
    }

    for (const item of itemsToScore) {
      if (input.variantId && item.variantId !== input.variantId && item.variantId !== null) {
        continue;
      }

      for (const ucName of useCasesToRun) {
        const ucConfig = config.useCases[ucName];
        if (!ucConfig) continue;

        report.totalProcessed++;

        const cohortBenchmarks: Record<string, number[]> = {};
        for (const bm of item.benchmarks) {
          if (!cohortBenchmarks[bm.metric]) {
            cohortBenchmarks[bm.metric] = [];
          }
          cohortBenchmarks[bm.metric].push(bm.value);
        }

        const scoreInput: ScoreInput = {
          productId: product.id,
          variantId: item.variantId,
          useCase: ucName,
          price: item.price,
          specs: item.specs,
          benchmarks: item.benchmarks,
          cohortBenchmarks,
          cohortPrices: [item.price],
          warrantyMonths: 12,
          brandReliabilityScore: 85,
        };

        const computation = scoreProduct(scoreInput, config);

        if (computation.status === 'ABSTAINED') {
          report.abstainedCount++;
          continue;
        }

        const activeSourceRefs = Array.from(
          new Set(item.benchmarks.map((b) => b.sourceId).filter(Boolean))
        ).sort();

        const sourceSetHash = crypto
          .createHash('sha256')
          .update(
            JSON.stringify(
              item.benchmarks
                .map((b) => `${b.sourceId}:${b.metric}:${b.version}`)
                .sort()
            )
          )
          .digest('hex');

        const priceSnapshot = formatVND(item.price);
        const revisionKey = buildRevisionKey({
          productId: product.id,
          variantId: item.variantId,
          useCase: ucName,
          rubricVersion: config.version,
          sourceSetHash,
          priceSnapshot,
        });

        const isGoodValue = resolveGoodValueBadge({
          finalScore: computation.finalScore,
          priceEfficiency: computation.breakdown.priceEfficiency,
          coverage: computation.coverage,
          status: 'ACTIVE',
        });

        const existingWithKey = await client.productScoreSnapshot.findMany({
          where: { revisionKey },
        });

        if (existingWithKey.length > 0) {
          continue;
        }

        const updated = await client.productScoreSnapshot.updateMany({
          where: {
            productId: product.id,
            variantId: item.variantId ?? null,
            useCase: ucName,
            status: 'ACTIVE',
          },
          data: {
            status: 'SUPERSEDED',
          },
        });

        report.supersededCount += updated.count;

        await client.productScoreSnapshot.create({
          data: {
            productId: product.id,
            variantId: item.variantId ?? null,
            useCase: ucName,
            finalScore: computation.finalScore,
            priceEfficiency: computation.breakdown.priceEfficiency,
            experience: computation.breakdown.experience,
            support: computation.breakdown.support,
            coverage: computation.coverage,
            status: 'ACTIVE',
            isGoodValue,
            rubricVersion: config.version,
            rubricSnapshot: ucConfig as unknown as Prisma.InputJsonValue,
            breakdown: computation.breakdown as unknown as Prisma.InputJsonValue,
            sourceRefs: activeSourceRefs as unknown as Prisma.InputJsonValue,
            sourceSetHash,
            priceSnapshot,
            revisionKey,
          },
        });

        report.publishedCount++;
        if (isGoodValue) {
          report.goodValueCount++;
        }
      }
    }
  }

  return report;
}

export async function getProductScores(
  productId: string,
  variantId?: string | null,
  db?: PrismaClientOrTx
): Promise<ScoreSnapshotDto[]> {
  const client = db ?? defaultPrisma;

  const where: Record<string, unknown> = {
    productId,
    variantId: variantId ?? null,
  };

  const snapshots = await client.productScoreSnapshot.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
  });

  const allSourceIds = Array.from(
    new Set(
      snapshots.flatMap((s: { sourceRefs: unknown }) =>
        Array.isArray(s.sourceRefs) ? (s.sourceRefs as string[]) : []
      )
    )
  );

  let revokedSourceIds: string[] = [];
  if (allSourceIds.length > 0 && client.dataSource?.findMany) {
    const revoked = await client.dataSource.findMany({
      where: {
        id: { in: allSourceIds },
        status: 'REVOKED',
      },
      select: { id: true },
    });
    revokedSourceIds = (revoked as Array<{ id: string }>).map((r) => r.id);
  }

  const results: ScoreSnapshotDto[] = [];

  for (const s of snapshots) {
    let currentStatus = s.status;
    let isGoodValue = s.isGoodValue;

    const sourceRefs: string[] = Array.isArray(s.sourceRefs) ? (s.sourceRefs as unknown as string[]) : [];
    const hasRevokedSource = sourceRefs.some((refId) =>
      revokedSourceIds.includes(refId)
    );

    if (hasRevokedSource && currentStatus === 'ACTIVE') {
      currentStatus = 'REVOKED';
      isGoodValue = false;
      if (client.productScoreSnapshot.update) {
        await client.productScoreSnapshot.update({
          where: { id: s.id },
          data: { status: 'REVOKED', isGoodValue: false },
        });
      }
    }

    results.push({
      id: s.id,
      productId: s.productId,
      variantId: s.variantId,
      useCase: s.useCase,
      finalScore: s.finalScore,
      priceEfficiency: s.priceEfficiency,
      experience: s.experience,
      support: s.support,
      coverage: s.coverage,
      status: currentStatus,
      isGoodValue,
      rubricVersion: s.rubricVersion,
      rubricSnapshot: s.rubricSnapshot as unknown as UseCaseScoringConfig,
      breakdown: s.breakdown as Record<string, unknown>,
      sourceRefs,
      missingEvidence: s.missingEvidence as string[] | undefined,
      sourceSetHash: s.sourceSetHash,
      priceSnapshot: s.priceSnapshot,
      publishedAt: s.publishedAt.toISOString ? s.publishedAt.toISOString() : String(s.publishedAt),
    });
  }

  return results;
}

export async function revokeSourceSnapshots(
  sourceId: string,
  db?: PrismaClientOrTx
): Promise<number> {
  const client = db ?? defaultPrisma;

  const activeSnapshots = await client.productScoreSnapshot.findMany({
    where: { status: 'ACTIVE' },
  });

  let revokedCount = 0;
  for (const snap of activeSnapshots) {
    const refs: string[] = Array.isArray(snap.sourceRefs) ? (snap.sourceRefs as unknown as string[]) : [];
    if (refs.includes(sourceId)) {
      await client.productScoreSnapshot.update({
        where: { id: snap.id },
        data: { status: 'REVOKED', isGoodValue: false },
      });
      revokedCount++;
    }
  }

  return revokedCount;
}
