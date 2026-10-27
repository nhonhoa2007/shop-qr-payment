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
      select?: Record<string, unknown>;
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

export function isCatalogOverviewQuery(query?: string | null): boolean {
  if (!query) return false;
  const normalized = query.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[!?.,:;]+/g, '').replace(/\s+/g, ' ').trim();
  return /^(?:shop|cua hang|ben minh)\s+(?:(?:hien|dang|hien dang)\s+)?(?:co|ban)\s+(?:(?:nhung|cac|loai)\s+)?(?:san pham|mat hang|loai hang|danh muc|gi)(?:\s+(?:gi|nao|vay))?$/.test(normalized) ||
    /^(?:nhung|cac)\s+(?:san pham|mat hang)\s+(?:shop|cua hang)\s+(?:dang|hien dang)\s+ban$/.test(normalized);
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
  const isOverview = !input.productIds?.length && !input.categoryId && isCatalogOverviewQuery(input.query);
  if (isOverview) {
    const catalog = await db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true, categoryRef: { select: { name: true } } },
    });
    const grouped = new Map<string, { name: string; count: number; examples: Array<{ id: string; name: string }> }>();
    for (const product of catalog) {
      const name = product.categoryRef?.name || product.category || 'Chưa phân loại';
      const group = grouped.get(name) || { name, count: 0, examples: [] as Array<{ id: string; name: string }> };
      group.count++;
      if (group.examples.length < 2) {
        group.examples.push({ id: product.id, name: product.name });
        const citationId = `src_product_${product.id}`;
        citations[citationId] = {
          id: citationId,
          type: 'PRODUCT_SPEC',
          title: `${product.name} - thông tin niêm yết tại Shop QR`,
          publisher: 'Shop QR',
        };
        activeSourceIds.push(citationId);
      }
      grouped.set(name, group);
    }
    return {
      bundleId,
      generatedAt: now,
      query: input.query,
      products: [],
      catalogOverview: {
        totalProducts: catalog.length,
        categories: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      },
      citations,
      activeSourceIds,
      revokedSourceIds,
      systemInstructions: 'Trả lời tổng quan danh mục bằng dữ liệu sản phẩm đang bán.',
    };
  }
  const productWhere: Record<string, unknown> = {
    isActive: true,
  };

  let rawProducts: any[] = [];
  let hasSearchTerms = false;

  if (!isGreeting) {
    if (input.productIds && input.productIds.length > 0) {
      productWhere.id = { in: input.productIds };
    } else if (input.categoryId) {
      productWhere.categoryId = input.categoryId;
    } else if (input.query && input.query.trim().length > 0) {
      const stopWords = new Set([
        'shop', 'cửa', 'hàng', 'có', 'bán', 'những', 'các', 'sản', 'phẩm',
        'gì', 'nào', 'cho', 'tôi', 'mình', 'xem', 'muốn', 'giá', 'bao', 'nhiêu',
        'hiện', 'đang', 'loại', 'không', 'vậy',
      ]);
      const words = input.query.toLowerCase().replace(/[!?.,:;]+/g, ' ')
        .split(/\s+/).filter((word) => word.length >= 2 && !stopWords.has(word));
      if (words.length > 0) {
        const phrase = words.join(' ');
        productWhere.OR = [
          { name: { contains: phrase, mode: 'insensitive' } },
          { description: { contains: phrase, mode: 'insensitive' } },
          { category: { contains: phrase, mode: 'insensitive' } },
          { categoryRef: { is: { name: { contains: phrase, mode: 'insensitive' } } } },
        ];
        hasSearchTerms = true;
      }
    }

    rawProducts = !hasSearchTerms && !input.productIds?.length && !input.categoryId
      ? []
      : await db.product.findMany({
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
    const specValues = (p.specs?.values as Record<string, unknown>) ||
      (p.specValues as Record<string, unknown>) || {};
    const specsMap: Record<string, { value: string | number | boolean | null; unit?: string | null }> = {};

    for (const [k, v] of Object.entries(specValues)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'object' && v !== null && 'value' in v) {
        if ('state' in v && v.state !== 'KNOWN') continue;
        const value = v.value;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          specsMap[k] = {
            value,
            ...('unit' in v && typeof v.unit === 'string' ? { unit: v.unit } : {}),
          };
        }
      } else {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          specsMap[k] = { value: v };
        }
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
    : 'Bạn là trợ lý mua sắm của Shop QR. ' +
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
