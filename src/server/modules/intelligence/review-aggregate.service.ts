import { prisma as globalPrisma } from '@server/database/prisma.ts';
import type { PrismaClientOrTx } from './scoring.service.ts';
import type {
  ReviewSummaryDto,
  ReviewSourceGroup,
  AspectSentimentSummary,
  ReviewAggregatePayload,
} from '@shared/types/intelligence.ts';

// RegEx patterns for delivery/logistics complaints
const SHIPPING_PATTERNS = [
  /giao hàng/i,
  /vận chuyển/i,
  /shipper/i,
  /ghn/i,
  /hộp bị móp/i,
  /hộp nát/i,
  /chậm \d+ ngày/i,
  /delivery.*late/i,
  /delivery.*slow/i,
  /crushed by (shipper|courier|carrier)/i,
  /smashed by carrier/i,
  /package arrived.*smashed/i,
  /worst delivery/i,
];

export function isShippingComplaint(text?: string | null): boolean {
  if (!text) return false;
  return SHIPPING_PATTERNS.some((pattern) => pattern.test(text));
}

interface AspectKeywordDef {
  aspect: string;
  keywords: string[];
}

const ASPECT_DEFINITIONS: AspectKeywordDef[] = [
  {
    aspect: 'performance',
    keywords: ['hiệu năng', 'mượt', 'nhanh', 'snappy', 'fast', 'cpu', 'multitask', 'lag', 'chơi game', 'render'],
  },
  {
    aspect: 'battery',
    keywords: ['pin', 'battery', 'thời lượng', 'sạc', 'dùng được', 'lasts'],
  },
  {
    aspect: 'display',
    keywords: ['màn hình', 'oled', 'ips', 'display', 'screen', 'độ sáng', 'nits', 'màu sắc', 'vibrant'],
  },
  {
    aspect: 'camera',
    keywords: ['camera', 'chụp', 'ảnh', 'webcam', 'quay video', 'photos'],
  },
  {
    aspect: 'build_quality',
    keywords: ['thiết kế', 'bản lề', 'vỏ', 'build quality', 'nhôm', 'chắc chắn', 'cứng cáp', 'mát', 'bàn phím'],
  },
];

export function extractAspectSentiments(
  reviews: Array<{ comment?: string | null; rating: number }>
): AspectSentimentSummary[] {
  const aspectStats = new Map<
    string,
    {
      positiveCount: number;
      totalCount: number;
      ratings: number[];
    }
  >();

  for (const def of ASPECT_DEFINITIONS) {
    aspectStats.set(def.aspect, {
      positiveCount: 0,
      totalCount: 0,
      ratings: [],
    });
  }

  for (const rev of reviews) {
    const text = rev.comment ?? '';
    // Skip reviews that are primarily shipping complaints from contaminating hardware quality
    if (isShippingComplaint(text)) {
      continue;
    }

    const lower = text.toLowerCase();
    const isPositiveReview = rev.rating >= 4;

    for (const def of ASPECT_DEFINITIONS) {
      const mentionsAspect = def.keywords.some((kw) => lower.includes(kw));
      if (mentionsAspect) {
        const stats = aspectStats.get(def.aspect)!;
        stats.totalCount += 1;
        stats.ratings.push(rev.rating);
        if (isPositiveReview) {
          stats.positiveCount += 1;
        }
      }
    }
  }

  const summaries: AspectSentimentSummary[] = [];
  for (const [aspect, stats] of aspectStats.entries()) {
    if (stats.totalCount === 0) continue;

    const positiveRate = stats.positiveCount / stats.totalCount;
    const avgRating = stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length;
    // Composite positiveScore (0 - 100) weighting positive sentiment and 5-star normalized rating
    const ratingNormalized = (avgRating / 5) * 100;
    const positiveScore = Math.round(positiveRate * 60 + ratingNormalized * 0.4);

    const confidence = Math.min(1.0, 0.5 + stats.totalCount * 0.1);

    summaries.push({
      aspect,
      positiveScore: Math.min(Math.max(positiveScore, 0), 100),
      confidence,
      sampleCount: stats.totalCount,
    });
  }

  return summaries;
}

interface RawShopReview {
  id: string;
  productId: string;
  userId?: string | null;
  orderId?: string | null;
  rating: number;
  comment?: string | null;
  isApproved: boolean;
}

interface RawDataSource {
  id: string;
  sourceType: string;
  status: string;
  publisher: string;
  url?: string | null;
  license?: string | null;
  isSynthetic: boolean;
  payload: unknown;
}

export async function getReviewAspects(
  productIds: string[],
  db?: PrismaClientOrTx
): Promise<ReviewSummaryDto[]> {
  const client = db || globalPrisma;

  // 1. Fetch internal shop reviews strictly where isApproved = true
  const shopReviews = (await (client as unknown as {
    review: {
      findMany(args: {
        where: { productId: { in: string[] }; isApproved: boolean };
      }): Promise<RawShopReview[]>;
    };
  }).review.findMany({
    where: {
      productId: { in: productIds },
      isApproved: true,
    },
  })) as RawShopReview[];

  // 2. Fetch active external and synthetic review aggregates
  const dataSources = (await (client as unknown as {
    dataSource: {
      findMany(args: {
        where: { sourceType: string; status: string };
      }): Promise<RawDataSource[]>;
    };
  }).dataSource.findMany({
    where: {
      sourceType: 'REVIEW_AGGREGATE',
      status: 'ACTIVE',
    },
  })) as RawDataSource[];

  // Group shop reviews by productId
  const shopMap = new Map<string, RawShopReview[]>();
  for (const pid of productIds) {
    shopMap.set(pid, []);
  }
  for (const r of shopReviews) {
    const list = shopMap.get(r.productId);
    if (list) list.push(r);
  }

  const results: ReviewSummaryDto[] = [];

  for (const pid of productIds) {
    const pShopReviews = shopMap.get(pid) || [];
    const totalShopCount = pShopReviews.length;
    const avgShopRating =
      totalShopCount > 0
        ? Number((pShopReviews.reduce((sum, r) => sum + r.rating, 0) / totalShopCount).toFixed(1))
        : 0;

    const shopGroup: ReviewSourceGroup = {
      provenance: 'SHOP',
      averageRating: avgShopRating,
      totalReviews: totalShopCount,
      aspects: extractAspectSentiments(pShopReviews),
      sourceAttribution: {
        publisher: 'Shop QR Payment Verified Buyers',
      },
    };

    const externalGroups: ReviewSourceGroup[] = [];
    const syntheticGroups: ReviewSourceGroup[] = [];

    for (const ds of dataSources) {
      const payload = ds.payload as ReviewAggregatePayload | null;
      if (!payload || !payload.mapping || payload.mapping.productId !== pid) {
        continue;
      }

      const group: ReviewSourceGroup = {
        provenance: ds.isSynthetic ? 'SYNTHETIC' : 'EXTERNAL',
        averageRating: payload.ratingSummary?.averageRating ?? 0,
        totalReviews: payload.ratingSummary?.totalReviews ?? payload.sampleSize ?? 0,
        aspects: (payload.aspects || []).map((a) => ({
          aspect: a.aspect,
          positiveScore: a.positiveScore,
          confidence: a.confidence,
          sampleCount: a.sampleCount,
          summary: a.summary,
        })),
        analyzerVersion: payload.analyzerVersion,
        sourceAttribution: {
          publisher: ds.publisher,
          license: ds.license ?? undefined,
          url: ds.url ?? undefined,
        },
      };

      if (ds.isSynthetic) {
        syntheticGroups.push(group);
      } else {
        externalGroups.push(group);
      }
    }

    results.push({
      productId: pid,
      shop: shopGroup,
      external: externalGroups,
      synthetic: syntheticGroups,
      overallRating: avgShopRating,
      totalReviewCount: totalShopCount,
    });
  }

  return results;
}
