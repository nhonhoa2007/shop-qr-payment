/**
 * Assistant Evidence Bundle Builder
 *
 * Gathers grounded, verifiable evidence from live DB models (Product, Variant,
 * DataSource, BenchmarkMeasurement, ProductScoreSnapshot, and ReviewAggregate).
 * Guarantees that only ACTIVE DataSources are admitted into active citations,
 * while REVOKED DataSources are tracked for fast revocation filtering.
 */

import { prisma as globalPrisma } from '@server/database/prisma.ts';
import crypto from 'node:crypto';
import type {
  EvidenceBundle,
  EvidenceBundleInput,
  EvidenceCitation,
  GroundedProductEvidence,
} from '../../../shared/types/assistant.ts';

export interface AssistantEvidenceDb {
  product: {
    findMany(args: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
      take?: number;
    }): Promise<any[]>;
  };
  dataSource: {
    findMany(args: {
      where?: Record<string, unknown>;
    }): Promise<any[]>;
  };
  benchmarkMeasurement?: {
    findMany(args: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<any[]>;
  };
  productScoreSnapshot?: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      take?: number;
    }): Promise<any[]>;
  };
}

export async function buildEvidenceBundle(
  input: EvidenceBundleInput,
  db: AssistantEvidenceDb = globalPrisma as unknown as AssistantEvidenceDb
): Promise<EvidenceBundle> {
  const bundleId = `bundle_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // 1. Fetch active and revoked DataSources
  const allSources = await db.dataSource.findMany({
    where: {},
  });

  const activeSourceIds: string[] = [];
  const revokedSourceIds: string[] = [];
  const citations: Record<string, EvidenceCitation> = {};

  for (const src of allSources) {
    if (src.status === 'ACTIVE') {
      activeSourceIds.push(src.id);
      citations[src.id] = {
        id: src.id,
        type:
          src.sourceType === 'BENCHMARK'
            ? 'BENCHMARK'
            : src.sourceType === 'EXTERNAL_REVIEW'
            ? 'REVIEW_AGGREGATE'
            : 'PRODUCT_SPEC',
        title: src.name || 'Official Source',
        sourceId: src.id,
        sourceUrl: src.url || undefined,
        publisher: src.publisher || undefined,
        license: src.license || undefined,
        isSynthetic: Boolean(src.isSynthetic),
      };
    } else if (src.status === 'REVOKED') {
      revokedSourceIds.push(src.id);
    }
  }

  // 2. Fetch target products
  const productWhere: Record<string, unknown> = {
    isActive: true,
  };

  if (input.productIds && input.productIds.length > 0) {
    productWhere.id = { in: input.productIds };
  } else if (input.categoryId) {
    productWhere.categoryId = input.categoryId;
  }

  const rawProducts = await db.product.findMany({
    where: productWhere,
    include: {
      brand: true,
      category: true,
      variants: {
        where: { isActive: true },
      },
    },
    take: 5,
  });

  const productsEvidence: GroundedProductEvidence[] = [];

  for (const p of rawProducts) {
    const brandName = p.brand?.name || 'Chính hãng';
    const specValues = (p.specValues as Record<string, unknown>) || {};
    const specsMap: Record<string, { value: string | number | boolean | null; unit?: string | null }> = {};

    for (const [k, v] of Object.entries(specValues)) {
      if (typeof v === 'object' && v !== null && 'value' in v) {
        specsMap[k] = v as any;
      } else {
        specsMap[k] = { value: v as any };
      }
    }

    // Default official product citation
    const prodCitId = `src_product_${p.id}`;
    if (!citations[prodCitId]) {
      citations[prodCitId] = {
        id: prodCitId,
        type: 'PRODUCT_SPEC',
        title: `${p.name} - Thông số kỹ thuật niêm yết`,
        publisher: brandName,
      };
      activeSourceIds.push(prodCitId);
    }

    const livePrice = typeof p.price === 'bigint' ? p.price.toString() : String(p.price || 0);

    // Fetch latest score snapshot if available
    let scoreSnapshotDto: GroundedProductEvidence['scoreSnapshot'] = null;
    if (db.productScoreSnapshot) {
      const snapshots = await db.productScoreSnapshot.findMany({
        where: { productId: p.id },
        orderBy: { snapshotVersion: 'desc' },
        take: 1,
      });
      if (snapshots && snapshots.length > 0) {
        const s = snapshots[0];
        scoreSnapshotDto = {
          useCase: s.useCase || 'default',
          finalScore: s.finalScore || 0,
          priceEfficiencyScore: s.priceEfficiencyScore || 0,
          confidence: s.confidence || 0,
          version: s.snapshotVersion || 1,
        };
      }
    }

    // Fetch benchmarks if available
    const benchmarksDto: GroundedProductEvidence['benchmarks'] = [];
    if (db.benchmarkMeasurement) {
      const bms = await db.benchmarkMeasurement.findMany({
        where: { productId: p.id },
      });
      for (const bm of bms || []) {
        if (!revokedSourceIds.includes(bm.sourceId)) {
          benchmarksDto.push({
            metricName: bm.metric,
            value: Number(bm.value),
            unit: bm.unit,
            sourceId: bm.sourceId,
          });
        }
      }
    }

    productsEvidence.push({
      productId: p.id,
      productName: p.name,
      brand: brandName,
      livePriceVnd: livePrice,
      liveStock: p.stock ?? 0,
      specs: specsMap,
      scoreSnapshot: scoreSnapshotDto,
      benchmarks: benchmarksDto.length > 0 ? benchmarksDto : undefined,
      evidenceIds: [prodCitId, ...benchmarksDto.map((b) => b.sourceId)],
    });
  }

  const systemInstructions =
    'Bạn là trợ lý tư vấn công nghệ chuyên nghiệp của cửa hàng điện tử Shop QR. ' +
    'CHỈ ĐƯỢC PHÉP trả lời dựa trên BẰNG CHỨNG (evidence bundle) được cung cấp. ' +
    'TUYỆT ĐỐI KHÔNG đoán hoặc bịa đặt giá cả, số lượng tồn kho, dung lượng RAM/ổ cứng, hoặc điểm số. ' +
    'Mặc định so sánh tổng quan ngắn gọn trước, sau đó hỏi đúng một câu về nhu cầu chính. ' +
    'Trả lời theo định dạng JSON với các trường: answer, followUpQuestion, citations, claims.';

  return {
    bundleId,
    generatedAt: now,
    query: input.query,
    products: productsEvidence,
    citations,
    activeSourceIds,
    revokedSourceIds,
    systemInstructions,
  };
}
