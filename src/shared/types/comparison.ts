import type {
  NetSalesDto,
  ReviewSummaryDto,
  ScoreSnapshotDto,
} from './intelligence.ts';

export interface CompareItemInput {
  productId: string;
  variantId?: string | null;
}

export interface CompareInput {
  items: CompareItemInput[];
  useCase?: string; // Optional target use-case, defaults to 'everyday' or first available
  salesWindowDays?: number; // Days to evaluate completed net sales, defaults to 30
}

export type SpecValueStatus = 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';

export interface CanonicalSpecValue {
  key: string;
  label: string;
  rawValue: unknown;
  canonicalValue?: string | number | boolean | null;
  unit?: string | null;
  status: SpecValueStatus;
}

export interface ComparisonProductDetail {
  productId: string;
  productName: string;
  brandName: string;
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;
  priceVnd: string;
  stock: number;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  canonicalSpecs: Record<string, CanonicalSpecValue>;
  scoreSnapshot?: ScoreSnapshotDto | null;
  netSales?: NetSalesDto | null;
  reviews?: ReviewSummaryDto | null;
}

export interface ComparisonAttributeRow {
  key: string;
  label: string;
  category: 'SPEC' | 'BENCHMARK' | 'SCORE' | 'SALES' | 'REVIEWS';
  unit?: string | null;
  values: Record<string, CanonicalSpecValue | string | number | boolean | null>;
  highlightAdvantage?: string | null; // Optional productId indicating measurable spec advantage without declaring unsolicited subjective winner
}

export interface ComparisonDto {
  comparedAt: string;
  categoryId: string;
  categoryName: string;
  useCase?: string;
  items: ComparisonProductDetail[];
  attributes: ComparisonAttributeRow[];
  tradeOffSummary?: string[];
}
