import { prisma as globalPrisma } from '@server/database/prisma.ts';
import type { PrismaClientOrTx } from './scoring.service.ts';
import { getNetSales } from './sales.service.ts';
import { getReviewAspects } from './review-aggregate.service.ts';
import type {
  CompareInput,
  ComparisonDto,
  ComparisonProductDetail,
  ComparisonAttributeRow,
  CanonicalSpecValue,
} from '@shared/types/comparison.ts';
import type { ScoreSnapshotDto } from '@shared/types/intelligence.ts';

const SPEC_LABELS_AND_UNITS: Record<string, { label: string; unit?: string }> = {
  ram_gb: { label: 'RAM', unit: 'GB' },
  weight_kg: { label: 'Trọng lượng', unit: 'kg' },
  battery_wh: { label: 'Dung lượng pin', unit: 'Wh' },
  battery_mah: { label: 'Dung lượng pin', unit: 'mAh' },
  screen_size_inch: { label: 'Kích thước màn hình', unit: 'inch' },
  screen_refresh_rate_hz: { label: 'Tần số quét', unit: 'Hz' },
  screen_nits: { label: 'Độ sáng', unit: 'nits' },
  storage_gb: { label: 'Dung lượng lưu trữ', unit: 'GB' },
  dedicated_gpu: { label: 'Card đồ họa rời' },
  touchscreen: { label: 'Màn hình cảm ứng' },
  water_resistance: { label: 'Kháng nước & bụi' },
  fast_charging_w: { label: 'Công suất sạc nhanh', unit: 'W' },
};

export function normalizeCanonicalSpec(key: string, rawValue: unknown): CanonicalSpecValue {
  const meta = SPEC_LABELS_AND_UNITS[key] || {
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };

  // 1. Check for explicit UNSUPPORTED capability
  if (
    rawValue === false ||
    rawValue === 'none' ||
    rawValue === 'unsupported' ||
    rawValue === 'not_supported'
  ) {
    return {
      key,
      label: meta.label,
      rawValue,
      canonicalValue: false,
      unit: meta.unit,
      status: 'UNSUPPORTED',
    };
  }

  // 2. Check for UNKNOWN / missing data
  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === '' ||
    rawValue === 'N/A' ||
    rawValue === 'unknown'
  ) {
    return {
      key,
      label: meta.label,
      rawValue,
      canonicalValue: null,
      unit: meta.unit,
      status: 'UNKNOWN',
    };
  }

  // 3. Known value
  let canonicalVal = rawValue as string | number | boolean;
  if (typeof rawValue === 'string') {
    const num = Number(rawValue);
    if (!Number.isNaN(num) && rawValue.trim() !== '') {
      canonicalVal = num;
    }
  }

  return {
    key,
    label: meta.label,
    rawValue,
    canonicalValue: canonicalVal,
    unit: meta.unit,
    status: 'KNOWN',
  };
}

interface RawProductWithRelations {
  id: string;
  name: string;
  categoryId: string;
  category?: string | null;
  categoryRef?: { id: string; name: string } | null;
  brand: { name: string };
  price: bigint;
  stock: number;
  isActive: boolean;
  specs?: unknown;
  variants?: Array<{
    id: string;
    title: string;
    sku?: string | null;
    price: bigint;
    stock: number;
    isActive: boolean;
    specs?: unknown;
  }>;
}

export async function compareProducts(
  input: CompareInput,
  db?: PrismaClientOrTx
): Promise<ComparisonDto> {
  const client = db || globalPrisma;

  // Rule 1: Exactly 2 to 3 items
  if (!input.items || input.items.length < 2 || input.items.length > 3) {
    throw new Error('Yêu cầu so sánh từ 2 đến 3 sản phẩm');
  }

  // Rule 2: Reject duplicates
  const identitySet = new Set<string>();
  for (const item of input.items) {
    const key = `${item.productId}:${item.variantId ?? ''}`;
    if (identitySet.has(key)) {
      throw new Error('Không được chọn trùng sản phẩm hoặc phiên bản');
    }
    identitySet.add(key);
  }

  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));

  // Fetch products with category, brand, variants
  const products = (await (client as unknown as {
    product: {
      findMany(args: {
        where: { id: { in: string[] } };
        include: { categoryRef: boolean; brand: boolean; variants: boolean };
      }): Promise<RawProductWithRelations[]>;
    };
  }).product.findMany({
    where: { id: { in: productIds } },
    include: {
      categoryRef: true,
      brand: true,
      variants: true,
    },
  })) as RawProductWithRelations[];

  if (products.length !== productIds.length) {
    throw new Error('Một số sản phẩm không tồn tại');
  }

  // Rule 3: Enforce same leaf category
  const categoryIds = new Set(products.map((p) => p.categoryId));
  if (categoryIds.size !== 1) {
    throw new Error('Chỉ được so sánh các sản phẩm trong cùng danh mục');
  }

  const category =
    products[0].categoryRef ||
    (products[0].category && typeof products[0].category === 'object'
      ? (products[0].category as unknown as { id: string; name: string })
      : { id: products[0].categoryId, name: 'Điện tử' });
  const useCase = input.useCase ?? 'office_study';
  const salesDays = input.salesWindowDays ?? 30;

  // Fetch score snapshots
  const snapshots = (await (client as unknown as {
    productScoreSnapshot: {
      findMany(args: {
        where: {
          productId: { in: string[] };
          useCase: string;
          status: string;
        };
      }): Promise<ScoreSnapshotDto[]>;
    };
  }).productScoreSnapshot.findMany({
    where: {
      productId: { in: productIds },
      useCase,
      status: 'PUBLISHED',
    },
  })) as ScoreSnapshotDto[];

  const snapshotMap = new Map<string, ScoreSnapshotDto>();
  for (const s of snapshots) {
    snapshotMap.set(s.productId, s);
  }

  // Fetch net sales
  const now = new Date();
  const fromDate = new Date(now.getTime() - salesDays * 24 * 3600 * 1000);
  const netSalesList = await getNetSales(
    {
      productIds,
      from: fromDate,
      to: now,
    },
    client
  );
  const salesMap = new Map(netSalesList.map((s) => [s.productId, s]));

  // Fetch review summaries
  const reviewsList = await getReviewAspects(productIds, client);
  const reviewsMap = new Map(reviewsList.map((r) => [r.productId, r]));

  // Build ComparisonProductDetail items
  const productDetails: ComparisonProductDetail[] = [];
  const allSpecKeys = new Set<string>();

  for (const item of input.items) {
    const prod = products.find((p) => p.id === item.productId)!;
    const variant = item.variantId
      ? prod.variants?.find((v) => v.id === item.variantId)
      : undefined;

    const baseSpecs = (prod.specs as Record<string, unknown>) || {};
    const variantSpecs = (variant?.specs as Record<string, unknown>) || {};
    const mergedSpecs = { ...baseSpecs, ...variantSpecs };

    for (const k of Object.keys(mergedSpecs)) {
      allSpecKeys.add(k);
    }

    const canonicalSpecs: Record<string, CanonicalSpecValue> = {};
    for (const [k, v] of Object.entries(mergedSpecs)) {
      canonicalSpecs[k] = normalizeCanonicalSpec(k, v);
    }

    const price = variant ? variant.price : prod.price;
    const stock = variant ? variant.stock : prod.stock;
    const isActive = variant ? variant.isActive && prod.isActive : prod.isActive;

    productDetails.push({
      productId: prod.id,
      productName: prod.name,
      brandName: prod.brand.name,
      variantId: variant?.id ?? null,
      variantName: variant?.title ?? null,
      sku: variant?.sku ?? null,
      priceVnd: price.toString(),
      stock,
      isActive,
      categoryId: prod.categoryId,
      categoryName: category.name,
      canonicalSpecs,
      scoreSnapshot: snapshotMap.get(prod.id) ?? null,
      netSales: salesMap.get(prod.id) ?? null,
      reviews: reviewsMap.get(prod.id) ?? null,
    });
  }

  // Build Attribute Rows
  const attributes: ComparisonAttributeRow[] = [];

  // 1. Price row
  const priceValues: Record<string, string> = {};
  for (const d of productDetails) {
    priceValues[d.productId] = d.priceVnd;
  }
  attributes.push({
    key: 'price_vnd',
    label: 'Giá bán niêm yết',
    category: 'SPEC',
    unit: 'VND',
    values: priceValues,
  });

  // 2. Score Snapshot row
  const scoreValues: Record<string, number | null> = {};
  for (const d of productDetails) {
    scoreValues[d.productId] = d.scoreSnapshot ? d.scoreSnapshot.finalScore : null;
  }
  attributes.push({
    key: 'score_final',
    label: `Điểm Commerce Intelligence (${useCase})`,
    category: 'SCORE',
    unit: '/100',
    values: scoreValues,
  });

  // 3. Net Sales row
  const salesValues: Record<string, number | null> = {};
  for (const d of productDetails) {
    salesValues[d.productId] = d.netSales ? d.netSales.netUnits : null;
  }
  attributes.push({
    key: 'net_sales_units',
    label: `Đơn đã hoàn tất (${salesDays} ngày qua)`,
    category: 'SALES',
    unit: 'sản phẩm',
    values: salesValues,
  });

  // 4. Shop Reviews Rating
  const ratingValues: Record<string, number | null> = {};
  for (const d of productDetails) {
    ratingValues[d.productId] = d.reviews?.shop ? d.reviews.shop.averageRating : null;
  }
  attributes.push({
    key: 'shop_reviews_rating',
    label: 'Đánh giá người mua đã xác thực',
    category: 'REVIEWS',
    unit: 'sao',
    values: ratingValues,
  });

  // 5. Specs rows
  for (const specKey of allSpecKeys) {
    const meta = SPEC_LABELS_AND_UNITS[specKey] || {
      label: specKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    };
    const rowValues: Record<string, CanonicalSpecValue> = {};
    for (const d of productDetails) {
      rowValues[d.productId] = d.canonicalSpecs[specKey] || normalizeCanonicalSpec(specKey, null);
    }

    attributes.push({
      key: specKey,
      label: meta.label,
      category: 'SPEC',
      unit: meta.unit,
      values: rowValues,
    });
  }

  // Objective trade-off summaries without declaring an unsolicited subjective winner
  const tradeOffSummary: string[] = [];

  // Price comparison trade-off
  const [first, second] = productDetails;
  const p1 = BigInt(first.priceVnd);
  const p2 = BigInt(second.priceVnd);
  if (p1 < p2) {
    tradeOffSummary.push(
      `${first.productName} có mức giá cạnh tranh hơn (${first.priceVnd} VND so với ${second.priceVnd} VND).`
    );
  } else if (p2 < p1) {
    tradeOffSummary.push(
      `${second.productName} có mức giá cạnh tranh hơn (${second.priceVnd} VND so với ${first.priceVnd} VND).`
    );
  }

  // RAM trade-off
  const ram1 = first.canonicalSpecs.ram_gb?.canonicalValue;
  const ram2 = second.canonicalSpecs.ram_gb?.canonicalValue;
  if (typeof ram1 === 'number' && typeof ram2 === 'number') {
    if (ram1 > ram2) {
      tradeOffSummary.push(
        `${first.productName} có dung lượng RAM lớn hơn (${ram1} GB so với ${ram2} GB).`
      );
    } else if (ram2 > ram1) {
      tradeOffSummary.push(
        `${second.productName} có dung lượng RAM lớn hơn (${ram2} GB so với ${ram1} GB).`
      );
    }
  }

  // Weight trade-off
  const w1 = first.canonicalSpecs.weight_kg?.canonicalValue;
  const w2 = second.canonicalSpecs.weight_kg?.canonicalValue;
  if (typeof w1 === 'number' && typeof w2 === 'number') {
    if (w1 < w2) {
      tradeOffSummary.push(
        `${first.productName} có trọng lượng nhẹ hơn (${w1} kg so với ${w2} kg).`
      );
    } else if (w2 < w1) {
      tradeOffSummary.push(
        `${second.productName} có trọng lượng nhẹ hơn (${w2} kg so với ${w1} kg).`
      );
    }
  }

  // Battery trade-off
  const b1 = first.canonicalSpecs.battery_wh?.canonicalValue;
  const b2 = second.canonicalSpecs.battery_wh?.canonicalValue;
  if (typeof b1 === 'number' && typeof b2 === 'number') {
    if (b1 > b2) {
      tradeOffSummary.push(
        `${first.productName} có dung lượng pin lớn hơn (${b1} Wh so với ${b2} Wh).`
      );
    } else if (b2 > b1) {
      tradeOffSummary.push(
        `${second.productName} có dung lượng pin lớn hơn (${b2} Wh so với ${b1} Wh).`
      );
    }
  }

  if (tradeOffSummary.length === 0) {
    tradeOffSummary.push('Hai sản phẩm có cấu hình và tầm giá tương đương nhau.');
  }

  return {
    comparedAt: new Date().toISOString(),
    categoryId: category.id,
    categoryName: category.name,
    useCase,
    items: productDetails,
    attributes,
    tradeOffSummary,
  };
}
