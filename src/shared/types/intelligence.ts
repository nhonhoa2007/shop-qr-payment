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
