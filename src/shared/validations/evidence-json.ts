import type {
  ReviewAggregatePayload,
  MappingCandidate,
  MappingDecision,
  EvidenceQuery,
  EvidenceProvenance,
} from '@shared/types/intelligence';

export function validateReviewAggregatePayload(input: unknown): {
  valid: boolean;
  errors: string[];
  payload?: ReviewAggregatePayload;
} {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }

  const p = input as Record<string, unknown>;

  if (typeof p.schemaVersion !== 'number' || !Number.isInteger(p.schemaVersion) || p.schemaVersion < 1) {
    errors.push('schemaVersion must be a positive integer >= 1');
  }

  if (typeof p.sampleSize !== 'number' || !Number.isInteger(p.sampleSize) || p.sampleSize < 0) {
    errors.push('sampleSize must be a non-negative integer >= 0');
  }

  if (typeof p.analyzerVersion !== 'string' || !p.analyzerVersion.trim()) {
    errors.push('analyzerVersion must be a non-empty string');
  }

  if (typeof p.ratingSummary !== 'object' || p.ratingSummary === null) {
    errors.push('ratingSummary must be a non-null object');
  } else {
    const rs = p.ratingSummary as Record<string, unknown>;
    if (typeof rs.averageRating !== 'number' || rs.averageRating < 0 || rs.averageRating > 5) {
      errors.push('ratingSummary.averageRating must be a number between 0 and 5');
    }
    if (typeof rs.totalReviews !== 'number' || rs.totalReviews < 0) {
      errors.push('ratingSummary.totalReviews must be a non-negative number');
    }
  }

  if (!Array.isArray(p.aspects)) {
    errors.push('aspects must be an array');
  } else {
    for (let i = 0; i < p.aspects.length; i++) {
      const a = p.aspects[i] as Record<string, unknown>;
      if (typeof a !== 'object' || a === null) {
        errors.push(`aspects[${i}] must be an object`);
        continue;
      }
      if (typeof a.aspect !== 'string' || !a.aspect.trim()) {
        errors.push(`aspects[${i}].aspect must be a non-empty string`);
      }
      if (typeof a.positiveScore !== 'number' || a.positiveScore < 0 || a.positiveScore > 100) {
        errors.push(`aspects[${i}].positiveScore must be a number between 0 and 100`);
      }
      if (typeof a.confidence !== 'number' || a.confidence < 0 || a.confidence > 1) {
        errors.push(`aspects[${i}].confidence must be a number between 0 and 1`);
      }
      if (typeof a.sampleCount !== 'number' || a.sampleCount < 0) {
        errors.push(`aspects[${i}].sampleCount must be a non-negative number`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    payload: {
      schemaVersion: p.schemaVersion as number,
      sampleSize: p.sampleSize as number,
      analyzerVersion: (p.analyzerVersion as string).trim(),
      ratingSummary: {
        averageRating: Number((p.ratingSummary as Record<string, unknown>).averageRating),
        totalReviews: Number((p.ratingSummary as Record<string, unknown>).totalReviews),
        distribution: (p.ratingSummary as Record<string, unknown>).distribution as Record<string, number> | undefined,
      },
      aspects: (p.aspects as Record<string, unknown>[]).map((a) => ({
        aspect: String(a.aspect).trim().toLowerCase(),
        positiveScore: Number(a.positiveScore),
        confidence: Number(a.confidence),
        sampleCount: Number(a.sampleCount),
        summary: typeof a.summary === 'string' ? a.summary.trim() : undefined,
      })),
      sourceAttribution: p.sourceAttribution as ReviewAggregatePayload['sourceAttribution'],
      mapping: p.mapping as ReviewAggregatePayload['mapping'],
    },
  };
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Phân giải đối soát mapping giữa nguồn dữ liệu ngoại bộ và sản phẩm trong hệ thống
 */
export function resolveExternalMapping(candidate: MappingCandidate): MappingDecision {
  const normCandBrand = normalizeKey(candidate.candidateBrand || '');
  const normTgtBrand = normalizeKey(candidate.targetBrand || '');

  if (!normCandBrand || !normTgtBrand || normCandBrand !== normTgtBrand) {
    return {
      matched: false,
      confidence: 0,
      reason: `Brand mismatch: "${candidate.candidateBrand}" vs "${candidate.targetBrand}"`,
      decisionType: 'MISMATCH',
    };
  }

  // Market check
  const candMarket = candidate.candidateMarket?.trim().toUpperCase();
  const tgtMarket = candidate.targetMarket?.trim().toUpperCase();
  if (candMarket && tgtMarket && candMarket !== 'GLOBAL' && candMarket !== 'ALL' && candMarket !== tgtMarket) {
    return {
      matched: false,
      confidence: 0.2,
      reason: `Market mismatch: candidate market "${candMarket}" does not match target market "${tgtMarket}"`,
      decisionType: 'WRONG_MARKET',
    };
  }

  const normCandModel = normalizeKey(candidate.candidateModel || '');
  const normTgtName = normalizeKey(candidate.targetName || '');

  if (!normCandModel || !normTgtName) {
    return {
      matched: false,
      confidence: 0,
      reason: 'Empty candidate model or target name',
      decisionType: 'MISMATCH',
    };
  }

  // Check ambiguity: If candidate model is very short or generic (e.g. just "thinkpad x1" when target is "thinkpad x1 carbon gen 11")
  const isGenericSubstring = normTgtName.includes(normCandModel) && normTgtName.length >= normCandModel.length + 6;
  if (isGenericSubstring) {
    // Model lacks generational or sub-model discriminator
    return {
      matched: false,
      confidence: 0.6,
      reason: `Ambiguous model specification: "${candidate.candidateModel}" is generic for "${candidate.targetName}"`,
      decisionType: 'AMBIGUOUS',
    };
  }

  const exactMatch = normCandModel === normTgtName || normTgtName.includes(normCandModel) || normCandModel.includes(normTgtName);

  if (!exactMatch) {
    return {
      matched: false,
      confidence: 0.1,
      reason: `Model mismatch: "${candidate.candidateModel}" vs "${candidate.targetName}"`,
      decisionType: 'MISMATCH',
    };
  }

  // Config check if candidateConfig is provided
  if (candidate.candidateConfig && candidate.targetSpecs) {
    for (const [key, candVal] of Object.entries(candidate.candidateConfig)) {
      const tgtVal = candidate.targetSpecs[key];
      if (tgtVal !== undefined && tgtVal !== null) {
        const normCandVal = String(candVal).trim().toLowerCase();
        const normTgtVal = String(tgtVal).trim().toLowerCase();
        if (normCandVal !== normTgtVal) {
          return {
            matched: false,
            confidence: 0.5,
            reason: `Configuration mismatch for key "${key}": candidate "${normCandVal}" vs target "${normTgtVal}"`,
            decisionType: 'MISMATCH',
          };
        }
      }
    }
  }

  return {
    matched: true,
    confidence: 0.96,
    reason: 'Exact brand, model, and market match verified',
    decisionType: 'EXACT',
    resolvedVariantId: candidate.targetVariantId ?? undefined,
  };
}

/**
 * Kiểm tra xem một bằng chứng DataSource có đủ điều kiện áp dụng cho truy vấn hay không
 */
export function isEvidenceApplicable(
  source: {
    status: string;
    license?: string | null;
    market?: string | null;
    isSynthetic: boolean;
    payload?: unknown;
  },
  query: EvidenceQuery
): boolean {
  // Chỉ áp dụng nguồn ACTIVE
  if (source.status !== 'ACTIVE') {
    return false;
  }

  // Bắt buộc có giấy phép bản quyền
  if (!source.license || !source.license.trim()) {
    return false;
  }

  // Loại trừ synthetic khỏi production query nếu không cho phép
  if (source.isSynthetic && !query.includeSynthetic) {
    return false;
  }

  // Market check
  const srcMarket = source.market?.trim().toUpperCase();
  const qMarket = query.market?.trim().toUpperCase();
  if (qMarket && srcMarket && srcMarket !== 'GLOBAL' && srcMarket !== 'ALL' && srcMarket !== qMarket) {
    return false;
  }

  // Mapping check in payload
  if (source.payload && typeof source.payload === 'object' && 'mapping' in (source.payload as Record<string, unknown>)) {
    const mapping = (source.payload as { mapping?: { productId?: string; variantId?: string } }).mapping;
    if (mapping) {
      if (mapping.productId && mapping.productId !== query.productId) {
        return false;
      }
      // Parent ID does NOT fan out: if source is mapped to a specific variant, it only applies to that variant
      if (mapping.variantId && query.variantId && mapping.variantId !== query.variantId) {
        return false;
      }
      // If source is mapped to a specific variant but query is for general product (no variantId), it does not apply
      if (mapping.variantId && !query.variantId) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Bảo đảm nhãn kiểm chứng cho nguồn ngoại bộ luôn là 'EXTERNAL'
 */
export function resolveEvidenceProvenance(source: {
  isSynthetic: boolean;
  sourceType: string;
}): EvidenceProvenance {
  if (source.isSynthetic) {
    return 'SYNTHETIC';
  }
  if (source.sourceType === 'REVIEW_AGGREGATE' || source.sourceType === 'BENCHMARK' || source.sourceType === 'CATALOG') {
    return 'EXTERNAL';
  }
  return 'EXTERNAL';
}
