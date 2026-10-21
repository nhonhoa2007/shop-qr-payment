/**
 * Assistant Evidence Bundle Builder
 *
 * Gathers grounded, verifiable evidence from live DB models (Product, Variant,
 * DataSource, BenchmarkMeasurement, ProductScoreSnapshot, and ReviewAggregate).
 * Guarantees that only ACTIVE DataSources are admitted into active citations,
 * while REVOKED DataSources are tracked for fast revocation filtering.
 */

import { prisma as globalPrisma } from '@server/database/prisma';
import crypto from 'node:crypto';
import type {
  EvidenceBundle,
  EvidenceBundleInput,
  EvidenceCitation,
  GroundedProductEvidence,
} from '@shared/types/assistant';

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
  compatibilityRule?: {
    findMany(args: {
      where?: Record<string, unknown>;
    }): Promise<any[]>;
  };
}

/**
 * Detects whether a query is a greeting, introduction, or general conversational opener
 * rather than a specific product specification or comparison query.
 */
export function isGreetingQuery(query?: string | null): boolean {
  if (!query) return true;
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[!?.,:;~_`'"]/g, '')
    .replace(/\s+/g, ' ');

  if (!normalized) return true;

  const greetings = new Set([
    'hi',
    'hello',
    'hey',
    'helo',
    'hê lô',
    'hế lô',
    'alo',
    'alô',
    'chao',
    'chào',
    'chào bạn',
    'chao ban',
    'chào shop',
    'chao shop',
    'xin chào',
    'xin chao',
    'good morning',
    'good afternoon',
    'good evening',
    'bạn là ai',
    'ban la ai',
    'bạn có thể làm gì',
    'ban co the lam gi',
    'giúp tôi',
    'giup toi',
    'tư vấn giúp tôi',
    'tu van giup toi',
    'có ai không',
    'co ai khong',
    'test',
  ]);

  if (greetings.has(normalized)) {
    return true;
  }

  const words = normalized.split(' ');
  if (words.length <= 4) {
    const firstWord = words[0];
    if (['hi', 'hello', 'hey', 'alo', 'chào', 'chao'].includes(firstWord)) {
      const productKeywords = [
        'laptop',
        'máy tính',
        'may tinh',
        'pc',
        'chuột',
        'chuot',
        'bàn phím',
        'ban phim',
        'tai nghe',
        'loa',
        'điện thoại',
        'dien thoai',
        'phone',
        'iphone',
        'samsung',
        'macbook',
        'dell',
        'asus',
        'acer',
        'hp',
        'lenovo',
        'giá',
        'gia',
        'mua',
        'bán',
        'ban',
        'áo',
        'ao',
        'quần',
        'quan',
        'giày',
        'giay',
      ];
      if (!productKeywords.some((pk) => normalized.includes(pk))) {
        return true;
      }
    }
  }

  return false;
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

  // 1.5. Fetch active compatibility rules for accessory / compatibility questions
  if (db.compatibilityRule) {
    const activeRules = await db.compatibilityRule.findMany({
      where: { status: 'ACTIVE' },
    });
    for (const rule of activeRules) {
      if (rule.sourceId && revokedSourceIds.includes(rule.sourceId)) {
        continue;
      }
      citations[rule.id] = {
        id: rule.id,
        type: 'COMPATIBILITY_RULE',
        title: `Quy tắc tương thích: ${rule.name}`,
        sourceId: rule.sourceId || undefined,
        publisher: 'Shop Compatibility Engine',
        license: 'Internal Rule Engine',
        isSynthetic: false,
      };
    }
  }

  // 2. Fetch target products
  const isGreeting = isGreetingQuery(input.query);
  const productWhere: Record<string, unknown> = {
    isActive: true,
  };

  let rawProducts: any[] = [];

  if (!isGreeting) {
    if (input.productIds && input.productIds.length > 0) {
      productWhere.id = { in: input.productIds };
    } else if (input.categoryId) {
      productWhere.categoryId = input.categoryId;
    } else if (input.query && input.query.trim().length > 0) {
      const trimmedQuery = input.query.trim();
      const words = trimmedQuery.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length > 0) {
        productWhere.OR = [
          { name: { contains: trimmedQuery, mode: 'insensitive' } },
          { description: { contains: trimmedQuery, mode: 'insensitive' } },
          ...words.map((w) => ({ name: { contains: w, mode: 'insensitive' } })),
        ];
      }
    }

    rawProducts = await db.product.findMany({
      where: productWhere,
      include: {
        brand: true,
        categoryRef: true,
        variants: {
          where: { isActive: true },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true, comment: true },
          take: 5,
        },
      },
      take: 5,
    });
  }

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

    const reviewsDto = Array.isArray(p.reviews)
      ? p.reviews.map((r: any) => ({
          rating: typeof r.rating === 'number' ? r.rating : 5,
          comment: typeof r.comment === 'string' ? r.comment : null,
        }))
      : undefined;

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
        orderBy: { publishedAt: 'desc' },
        take: 1,
      });
      if (snapshots && snapshots.length > 0) {
        const s = snapshots[0];
        scoreSnapshotDto = {
          useCase: s.useCase || 'default',
          finalScore: s.finalScore || 0,
          priceEfficiencyScore: s.priceEfficiency ?? s.priceEfficiencyScore ?? 0,
          confidence: s.confidence ?? s.coverage ?? 0.9,
          version: s.rubricVersion ?? s.snapshotVersion ?? 1,
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
      reviews: reviewsDto,
      evidenceIds: [prodCitId, ...benchmarksDto.map((b) => b.sourceId)],
    });
  }

  const systemInstructions = isGreeting
    ? 'Bạn là Clawd Chef 🦀👨‍🍳 - trợ lý mua sắm AI thông minh, thân thiện của Shop QR. ' +
      'Khách hàng đang chào hỏi hoặc bắt đầu cuộc trò chuyện. ' +
      'Hãy chào lại một cách ấm áp và tự nhiên, giới thiệu bạn là Clawd Chef và sẵn sàng hỗ trợ tìm kiếm sản phẩm, kiểm tra thông số kỹ thuật (RAM, CPU, màn hình, pin...), so sánh cấu hình và tra cứu giá niêm yết chính hãng. ' +
      'Hỏi khách hàng đang quan tâm đến dòng sản phẩm nào. ' +
      'Không bịa đặt hay liệt kê bảng so sánh sản phẩm khi khách chưa hỏi cụ thể. ' +
      'Trả lời dưới dạng JSON với cấu trúc: {"answer": "...", "followUpQuestion": "...", "citations": [], "claims": []}.'
    : 'Bạn là trợ lý tư vấn công nghệ chuyên nghiệp của cửa hàng điện tử Shop QR. ' +
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
