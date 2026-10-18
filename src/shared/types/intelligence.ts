// ==========================================
// COMMERCE INTELLIGENCE & EVIDENCE TYPES
// ==========================================

export interface ReviewAspectAggregate {
  aspect: string; // e.g., 'performance', 'battery', 'display', 'build_quality', 'camera'
  positiveScore: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  sampleCount: number;
  summary?: string;
}

export interface RatingSummary {
  averageRating: number; // 1.0 - 5.0
  totalReviews: number;
  distribution?: Record<string, number>;
}

export interface ReviewAggregatePayload {
  schemaVersion: number;
  sampleSize: number;
  ratingSummary: RatingSummary;
  aspects: ReviewAspectAggregate[];
  analyzerVersion: string;
  sourceAttribution?: {
    publisher: string;
    url?: string;
    license: string;
    collectedAt?: string;
  };
  mapping?: {
    brand?: string;
    model?: string;
    market?: string;
    productId?: string;
    variantId?: string;
    sku?: string;
    confidence?: number;
  };
}

export interface MappingCandidate {
  candidateBrand: string;
  candidateModel: string;
  candidateMarket?: string | null;
  candidateConfig?: Record<string, unknown> | null;
  targetBrand: string;
  targetName: string;
  targetMarket?: string | null;
  targetSpecs?: Record<string, unknown> | null;
  targetVariantId?: string | null;
}

export type MappingDecisionType = 'EXACT' | 'AMBIGUOUS' | 'MISMATCH' | 'WRONG_MARKET';

export interface MappingDecision {
  matched: boolean;
  confidence: number;
  reason: string;
  decisionType: MappingDecisionType;
  resolvedProductId?: string;
  resolvedVariantId?: string;
}

export interface EvidenceQuery {
  productId: string;
  variantId?: string;
  market?: string;
  sourceTypes?: string[];
  includeSynthetic?: boolean;
}

export type EvidenceProvenance = 'SHOP' | 'EXTERNAL' | 'SYNTHETIC';

export interface BenchmarkMeasurementDto {
  id: string;
  sourceId: string;
  productId: string;
  variantId?: string | null;
  metric: string;
  value: number;
  unit: string;
  methodology?: string | null;
  measuredAt?: string | null;
  version: number;
  sampleSize: number;
}

export interface EvidenceRecord {
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
  provenance: EvidenceProvenance;
  payload?: unknown;
  benchmarks?: BenchmarkMeasurementDto[];
}

// ==========================================
// SCORING CONFIGURATION & COMPUTATION TYPES
// ==========================================

export interface ScoringMetricConfig {
  key: string; // e.g. 'cpu_multicore', 'battery_life', 'weight_kg', 'display_refresh_rate'
  weight: number; // 0.0 - 1.0 (relative weight in capability score)
  direction: 'HIGHER' | 'LOWER';
  source: 'BENCHMARK' | 'SPEC' | 'EVIDENCE';
  metricName?: string; // Metric identifier in BenchmarkMeasurement, e.g. 'geekbench_multi_core'
  specPath?: string; // Field key in Product.specs
  mandatory?: boolean; // If true, missing metric causes scoring to abstain
  minThreshold?: number; // Minimum acceptable raw value
}

export interface UseCaseWeights {
  priceEfficiency: number; // e.g. 0.65
  experience: number; // e.g. 0.25
  support: number; // e.g. 0.10
}

export interface UseCaseScoringConfig {
  useCase: string; // e.g. 'office_study', 'gaming', 'creative', 'programming', 'everyday'
  label: string;
  description?: string;
  weights: UseCaseWeights;
  capabilityMetrics: ScoringMetricConfig[];
  experienceWeights?: {
    shopReviews: number; // e.g. 0.50
    externalReviews: number; // e.g. 0.50
  };
  supportWeights?: {
    warrantyMonths: number; // e.g. 0.60
    brandReliability: number; // e.g. 0.40
  };
  minCoverage?: number; // Minimum capability metrics presence ratio (default 0.60)
}

export interface PublishedScoringConfig {
  version: number;
  categoryId: string;
  categorySlug?: string;
  publishedAt: string;
  useCases: Record<string, UseCaseScoringConfig>;
  configHash: string;
}

export interface BayesianRatingInput {
  sampleRating: number; // R (average rating of product)
  sampleSize: number; // v (number of reviews for product)
  priorMean?: number; // C (cohort average or prior mean, default 4.0)
  priorWeight?: number; // m (minimum review weight threshold, default 10)
}

export interface ScoreInput {
  productId: string;
  variantId?: string | null;
  useCase: string;
  price: bigint; // VND price (>Int32 supported)
  specs: Record<string, unknown>;
  benchmarks: Array<{ metric: string; value: number }>;
  cohortBenchmarks: Record<string, number[]>; // metric -> cohort values for min-max percentile normalization
  cohortPrices?: bigint[]; // prices across cohort for relative P/P normalization
  shopReviewStats?: {
    averageRating: number;
    totalReviews: number;
  };
  externalReviewStats?: {
    averageRating: number;
    totalReviews: number;
    aspectScores?: Record<string, number>;
  };
  warrantyMonths?: number;
  brandReliabilityScore?: number; // 0 - 100
  salesCount?: number; // Provided for testing that sales perturbation has NO effect on P/P score
}

export interface MetricScoreDetail {
  raw: number;
  normalized: number; // 0 - 100
  weight: number;
  direction: 'HIGHER' | 'LOWER';
}

export interface ScoreComputation {
  productId: string;
  variantId?: string | null;
  useCase: string;
  finalScore: number; // 0 - 100 (rounded to 1 decimal place)
  status: 'SCORED' | 'ABSTAINED';
  abstainReason?: string;
  coverage: number; // 0.0 - 1.0 (ratio of capability metrics present)
  breakdown: {
    priceEfficiency: number; // 0 - 100
    experience: number; // 0 - 100
    support: number; // 0 - 100
    rawCapability: number; // 0 - 100
  };
  metricBreakdown: Record<string, MetricScoreDetail>;
  computationHash: string;
}

export interface ScoreSnapshotDto {
  id: string;
  productId: string;
  variantId?: string | null;
  useCase: string;
  finalScore: number;
  priceEfficiency: number;
  experience: number;
  support: number;
  coverage: number;
  status: string;
  isGoodValue: boolean;
  rubricVersion: number;
  rubricSnapshot: UseCaseScoringConfig;
  breakdown: Record<string, unknown>;
  sourceRefs: string[];
  missingEvidence?: string[];
  sourceSetHash: string;
  priceSnapshot: string; // MoneyVnd string
  publishedAt: string;
}

export interface RecomputeInput {
  categoryId?: string;
  productId?: string;
  variantId?: string;
  useCase?: string;
  forceAll?: boolean;
}

export interface RecomputeReport {
  totalProcessed: number;
  publishedCount: number;
  abstainedCount: number;
  supersededCount: number;
  goodValueCount: number;
  errors: string[];
}

// ==========================================
// NET SALES & REVIEW ASPECTS AGGREGATE TYPES
// ==========================================

export interface SalesWindowInput {
  productIds: string[];
  from: Date | string;
  to: Date | string;
  variantId?: string | null;
}

export interface NetSalesDto {
  productId: string;
  variantId?: string | null;
  grossUnits: number;
  returnedUnits: number;
  netUnits: number;
  grossRevenueVnd: string;
  netRevenueVnd: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  hasUncertainReturns: boolean;
  window: {
    from: string;
    to: string;
  };
}

export interface AspectSentimentSummary {
  aspect: string;
  positiveScore: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  sampleCount: number;
  summary?: string;
}

export interface ReviewSourceGroup {
  provenance: EvidenceProvenance; // 'SHOP' | 'EXTERNAL' | 'SYNTHETIC'
  averageRating: number;
  totalReviews: number;
  aspects: AspectSentimentSummary[];
  analyzerVersion?: string;
  sourceAttribution?: {
    publisher: string;
    license?: string;
    url?: string;
  };
}

export interface ReviewSummaryDto {
  productId: string;
  shop: ReviewSourceGroup;
  external: ReviewSourceGroup[];
  synthetic: ReviewSourceGroup[];
  overallRating?: number;
  totalReviewCount?: number;
}

