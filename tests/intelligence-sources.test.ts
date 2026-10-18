import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReviewAggregatePayload,
  resolveExternalMapping,
  isEvidenceApplicable,
  resolveEvidenceProvenance,
} from '../src/shared/validations/evidence-json.ts';
import {
  listActiveEvidence,
  invalidateEvidenceCache,
  type IntelligenceDb,
} from '../src/server/modules/intelligence/sources.service.ts';

describe('Commerce Intelligence: Review Aggregate Payload Validation', () => {
  it('should accept valid review aggregate payload with normalized aspects', () => {
    const raw = {
      schemaVersion: 1,
      sampleSize: 150,
      analyzerVersion: 'sentiment-v2.1',
      ratingSummary: {
        averageRating: 4.6,
        totalReviews: 150,
        distribution: { '5': 100, '4': 30, '3': 15, '2': 3, '1': 2 },
      },
      aspects: [
        { aspect: 'Performance', positiveScore: 92.5, confidence: 0.95, sampleCount: 120 },
        { aspect: 'Battery', positiveScore: 84.0, confidence: 0.90, sampleCount: 95 },
      ],
      sourceAttribution: {
        publisher: 'TechReviewLab',
        license: 'CC-BY-4.0',
      },
      mapping: {
        productId: 'prod-macbook-14',
      },
    };

    const res = validateReviewAggregatePayload(raw);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.ok(res.payload);
    assert.equal(res.payload.schemaVersion, 1);
    assert.equal(res.payload.aspects[0].aspect, 'performance'); // Normalized lowercase
    assert.equal(res.payload.aspects[0].positiveScore, 92.5);
  });

  it('should reject invalid payload with missing or invalid schemaVersion', () => {
    const raw = {
      schemaVersion: 0, // Invalid: must be >= 1
      sampleSize: 50,
      analyzerVersion: 'v1',
      ratingSummary: { averageRating: 4.0, totalReviews: 50 },
      aspects: [],
    };
    const res = validateReviewAggregatePayload(raw);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('schemaVersion')));
  });

  it('should reject payload with negative sampleSize', () => {
    const raw = {
      schemaVersion: 1,
      sampleSize: -5,
      analyzerVersion: 'v1',
      ratingSummary: { averageRating: 4.0, totalReviews: 50 },
      aspects: [],
    };
    const res = validateReviewAggregatePayload(raw);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('sampleSize')));
  });

  it('should reject payload with invalid ratingSummary rating out of range', () => {
    const raw = {
      schemaVersion: 1,
      sampleSize: 10,
      analyzerVersion: 'v1',
      ratingSummary: { averageRating: 5.5, totalReviews: 10 }, // Invalid > 5
      aspects: [],
    };
    const res = validateReviewAggregatePayload(raw);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('averageRating')));
  });

  it('should reject aspects with positiveScore out of 0-100 range', () => {
    const raw = {
      schemaVersion: 1,
      sampleSize: 10,
      analyzerVersion: 'v1',
      ratingSummary: { averageRating: 4.0, totalReviews: 10 },
      aspects: [
        { aspect: 'screen', positiveScore: 120, confidence: 0.9, sampleCount: 10 }, // Invalid > 100
      ],
    };
    const res = validateReviewAggregatePayload(raw);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('positiveScore')));
  });
});

describe('Commerce Intelligence: External Mapping Resolution', () => {
  it('should admit exact brand, model, market, and config with high confidence', () => {
    const candidate = {
      candidateBrand: 'Apple',
      candidateModel: 'MacBook Pro 14 M3',
      candidateMarket: 'VN',
      candidateConfig: { ram: '16GB', storage: '512GB' },
      targetBrand: 'Apple',
      targetName: 'MacBook Pro 14 M3',
      targetMarket: 'VN',
      targetSpecs: { ram: '16GB', storage: '512GB' },
      targetVariantId: 'var-mbp-14-m3-16-512',
    };

    const decision = resolveExternalMapping(candidate);
    assert.equal(decision.matched, true);
    assert.equal(decision.decisionType, 'EXACT');
    assert.ok(decision.confidence >= 0.95);
    assert.equal(decision.resolvedVariantId, 'var-mbp-14-m3-16-512');
  });

  it('should reject brand mismatch', () => {
    const candidate = {
      candidateBrand: 'Dell',
      candidateModel: 'XPS 13',
      targetBrand: 'Lenovo',
      targetName: 'ThinkPad X1 Carbon Gen 11',
    };

    const decision = resolveExternalMapping(candidate);
    assert.equal(decision.matched, false);
    assert.equal(decision.decisionType, 'MISMATCH');
    assert.equal(decision.confidence, 0);
  });

  it('should reject wrong market when candidate market differs from target market', () => {
    const candidate = {
      candidateBrand: 'Samsung',
      candidateModel: 'Galaxy S24 Ultra',
      candidateMarket: 'US', // US market variant (Snapdragon vs Exynos or band differences)
      targetBrand: 'Samsung',
      targetName: 'Galaxy S24 Ultra',
      targetMarket: 'VN',
    };

    const decision = resolveExternalMapping(candidate);
    assert.equal(decision.matched, false);
    assert.equal(decision.decisionType, 'WRONG_MARKET');
    assert.ok(decision.confidence <= 0.3);
  });

  it('should mark ambiguous when model lacks generational or sub-model discriminator', () => {
    const candidate = {
      candidateBrand: 'Lenovo',
      candidateModel: 'ThinkPad X1', // Lacks "Carbon Gen 11"
      targetBrand: 'Lenovo',
      targetName: 'ThinkPad X1 Carbon Gen 11',
    };

    const decision = resolveExternalMapping(candidate);
    assert.equal(decision.matched, false);
    assert.equal(decision.decisionType, 'AMBIGUOUS');
    assert.ok(decision.reason.includes('Ambiguous'));
  });

  it('should reject configuration conflict in candidateConfig vs targetSpecs', () => {
    const candidate = {
      candidateBrand: 'Apple',
      candidateModel: 'MacBook Pro 14 M3',
      candidateConfig: { ram: '8GB' }, // Conflict: target is 16GB
      targetBrand: 'Apple',
      targetName: 'MacBook Pro 14 M3',
      targetSpecs: { ram: '16GB' },
    };

    const decision = resolveExternalMapping(candidate);
    assert.equal(decision.matched, false);
    assert.equal(decision.decisionType, 'MISMATCH');
    assert.ok(decision.reason.includes('Configuration mismatch'));
  });
});

describe('Commerce Intelligence: Evidence Applicability & Provenance Constraints', () => {
  it('should exclude non-ACTIVE sources (DISCOVERED, REVOKED, REJECTED)', () => {
    const query = { productId: 'prod-1' };
    assert.equal(isEvidenceApplicable({ status: 'DISCOVERED', license: 'MIT', isSynthetic: false }, query), false);
    assert.equal(isEvidenceApplicable({ status: 'REVOKED', license: 'MIT', isSynthetic: false }, query), false);
    assert.equal(isEvidenceApplicable({ status: 'REJECTED', license: 'MIT', isSynthetic: false }, query), false);
    assert.equal(isEvidenceApplicable({ status: 'APPROVED', license: 'MIT', isSynthetic: false }, query), false); // Needs ACTIVE
    assert.equal(isEvidenceApplicable({ status: 'ACTIVE', license: 'MIT', isSynthetic: false }, query), true);
  });

  it('should exclude unlicensed sources even if ACTIVE', () => {
    const query = { productId: 'prod-1' };
    assert.equal(isEvidenceApplicable({ status: 'ACTIVE', license: null, isSynthetic: false }, query), false);
    assert.equal(isEvidenceApplicable({ status: 'ACTIVE', license: '', isSynthetic: false }, query), false);
    assert.equal(isEvidenceApplicable({ status: 'ACTIVE', license: '   ', isSynthetic: false }, query), false);
  });

  it('should exclude synthetic sources from standard queries', () => {
    const query = { productId: 'prod-1', includeSynthetic: false };
    assert.equal(isEvidenceApplicable({ status: 'ACTIVE', license: 'Proprietary', isSynthetic: true }, query), false);

    const queryWithSynthetic = { productId: 'prod-1', includeSynthetic: true };
    assert.equal(isEvidenceApplicable({ status: 'ACTIVE', license: 'Proprietary', isSynthetic: true }, queryWithSynthetic), true);
  });

  it('should ensure parent ID does NOT fan out to unmapped variant', () => {
    const variantSpecificSource = {
      status: 'ACTIVE',
      license: 'CC-BY-4.0',
      isSynthetic: false,
      payload: {
        mapping: {
          productId: 'prod-1',
          variantId: 'var-1',
        },
      },
    };

    // Query for var-1 -> matches
    assert.equal(isEvidenceApplicable(variantSpecificSource, { productId: 'prod-1', variantId: 'var-1' }), true);

    // Query for var-2 (sibling variant) -> does NOT fan out!
    assert.equal(isEvidenceApplicable(variantSpecificSource, { productId: 'prod-1', variantId: 'var-2' }), false);

    // Query for generic product without variant -> does NOT fan out!
    assert.equal(isEvidenceApplicable(variantSpecificSource, { productId: 'prod-1' }), false);
  });

  it('should enforce that external verified label stays EXTERNAL and never SHOP', () => {
    const provenanceReview = resolveEvidenceProvenance({ isSynthetic: false, sourceType: 'REVIEW_AGGREGATE' });
    assert.equal(provenanceReview, 'EXTERNAL');
    assert.notEqual(provenanceReview, 'SHOP');

    const provenanceBenchmark = resolveEvidenceProvenance({ isSynthetic: false, sourceType: 'BENCHMARK' });
    assert.equal(provenanceBenchmark, 'EXTERNAL');

    const provenanceSynthetic = resolveEvidenceProvenance({ isSynthetic: true, sourceType: 'REVIEW_AGGREGATE' });
    assert.equal(provenanceSynthetic, 'SYNTHETIC');
  });
});

describe('Commerce Intelligence: Concurrent Activation & Revocation Cache Test', () => {
  beforeEach(async () => {
    await invalidateEvidenceCache();
  });

  it('should immediately exclude revoked evidence and invalidate cache', async () => {
    let sourceStatus = 'ACTIVE';

    const mockDb: IntelligenceDb = {
      dataSource: {
        async findMany() {
          if (sourceStatus !== 'ACTIVE') return [];
          return [
            {
              id: 'ds-review-1',
              name: 'TechLab Review Aggregate',
              sourceType: 'REVIEW_AGGREGATE',
              status: sourceStatus,
              publisher: 'TechLab',
              url: 'https://example.com/reviews',
              license: 'CC-BY-SA-4.0',
              market: 'VN',
              version: '2026.1',
              checksum: 'sha256:abc12345',
              isSynthetic: false,
              payload: {
                mapping: { productId: 'prod-test-1' },
                aspects: [{ aspect: 'performance', positiveScore: 90, confidence: 0.9, sampleCount: 50 }],
              },
            },
          ];
        },
      },
      benchmarkMeasurement: {
        async findMany() {
          return [];
        },
      },
    };

    // 1. Initial read while ACTIVE -> returns evidence
    const initialEvidence = await listActiveEvidence({ productId: 'prod-test-1' }, mockDb);
    assert.equal(initialEvidence.length, 1);
    assert.equal(initialEvidence[0].id, 'ds-review-1');

    // 2. Revoke the data source
    sourceStatus = 'REVOKED';
    await invalidateEvidenceCache('prod-test-1');

    // 3. Read immediately after revoke -> must be empty (excluded)
    const afterRevokeEvidence = await listActiveEvidence({ productId: 'prod-test-1' }, mockDb);
    assert.equal(afterRevokeEvidence.length, 0);
  });
});
