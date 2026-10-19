import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreProduct,
  adjustedRating,
  normalizeMetric,
} from '../src/server/modules/intelligence/scoring.engine.ts';
import { validateScoringConfig } from '../src/shared/validations/scoring-config.ts';
import type { PublishedScoringConfig, ScoreInput } from '../src/shared/types/intelligence.ts';

describe('Commerce Intelligence: Scoring Engine Math & Invariants', () => {
  const laptopConfigJson = {
    version: 1,
    categoryId: 'cat_laptop_123',
    publishedAt: '2026-10-18T00:00:00.000Z',
    useCases: {
      office_study: {
        useCase: 'office_study',
        label: 'Office & Study',
        weights: {
          priceEfficiency: 0.65,
          experience: 0.25,
          support: 0.10,
        },
        capabilityMetrics: [
          {
            key: 'cpu_multicore',
            weight: 0.35,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: 'geekbench_multi_core',
            mandatory: true,
          },
          {
            key: 'battery_life',
            weight: 0.40,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: 'battery_web_browsing',
            mandatory: true,
          },
          {
            key: 'weight_kg',
            weight: 0.25,
            direction: 'LOWER',
            source: 'SPEC',
            specPath: 'weight_kg',
            mandatory: false,
          },
        ],
      },
      gaming: {
        useCase: 'gaming',
        label: 'Gaming & High Performance',
        weights: {
          priceEfficiency: 0.65,
          experience: 0.25,
          support: 0.10,
        },
        capabilityMetrics: [
          {
            key: 'gpu_performance',
            weight: 0.60,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: '3dmark_timespy_graphics',
            mandatory: true,
          },
          {
            key: 'cpu_multicore',
            weight: 0.40,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: 'geekbench_multi_core',
            mandatory: true,
          },
        ],
      },
    },
  };

  const config: PublishedScoringConfig = validateScoringConfig(laptopConfigJson);

  const baseProductInput: ScoreInput = {
    productId: 'prod_macbook_pro_14',
    variantId: 'var_mbp_512',
    useCase: 'office_study',
    price: BigInt(45_000_000), // 45,000,000 VND (> Int32 positive range threshold when scaled)
    specs: {
      weight_kg: 1.6,
      screen_size_inch: 14.2,
    },
    benchmarks: [
      { metric: 'geekbench_multi_core', value: 12000 },
      { metric: 'battery_web_browsing', value: 16.0 },
      { metric: '3dmark_timespy_graphics', value: 7500 },
    ],
    cohortBenchmarks: {
      geekbench_multi_core: [6000, 9000, 12000, 15000],
      battery_web_browsing: [8.0, 12.0, 16.0, 20.0],
      weight_kg: [1.2, 1.6, 2.0, 2.6],
      '3dmark_timespy_graphics': [2000, 5000, 7500, 14000],
    },
    cohortPrices: [
      BigInt(20_000_000),
      BigInt(35_000_000),
      BigInt(45_000_000),
      BigInt(60_000_000),
    ],
    shopReviewStats: {
      averageRating: 4.8,
      totalReviews: 45,
    },
    externalReviewStats: {
      averageRating: 4.7,
      totalReviews: 120,
    },
    warrantyMonths: 24,
    brandReliabilityScore: 92,
  };

  describe('normalizeMetric', () => {
    it('normalizes higher-is-better metrics across cohort', () => {
      const cohort = [1000, 3000, 5000];
      assert.equal(normalizeMetric(5000, cohort, 'HIGHER'), 100);
      assert.equal(normalizeMetric(1000, cohort, 'HIGHER'), 0);
      assert.equal(normalizeMetric(3000, cohort, 'HIGHER'), 50);
    });

    it('reverses direction for lower-is-better metrics', () => {
      const weightCohort = [1.0, 1.5, 2.0]; // kg: lighter is better
      assert.equal(normalizeMetric(1.0, weightCohort, 'LOWER'), 100); // 1.0 kg is best (100)
      assert.equal(normalizeMetric(2.0, weightCohort, 'LOWER'), 0); // 2.0 kg is worst (0)
      assert.equal(normalizeMetric(1.5, weightCohort, 'LOWER'), 50);
    });

    it('safely handles cohort with identical values', () => {
      const uniformCohort = [10, 10, 10];
      const result = normalizeMetric(10, uniformCohort, 'HIGHER');
      assert.equal(result, 50);
    });
  });

  describe('adjustedRating (Bayesian adjustment)', () => {
    it('shrinks low-sample 2x5-star reviews significantly more than high-sample 200x4.7', () => {
      // Prior C = 4.0, priorWeight m = 10
      const smallSample = adjustedRating({
        sampleRating: 5.0,
        sampleSize: 2,
        priorMean: 4.0,
        priorWeight: 10,
      });

      const largeSample = adjustedRating({
        sampleRating: 4.7,
        sampleSize: 200,
        priorMean: 4.0,
        priorWeight: 10,
      });

      // 2 * 5.0 shrinks towards 4.0: (2*5 + 10*4)/12 = 50/12 ≈ 4.167
      assert.ok(smallSample < 4.25, `Expected small sample to shrink below 4.25, got ${smallSample}`);

      // 200 * 4.7: (200*4.7 + 10*4)/210 = (940 + 40)/210 = 980/210 ≈ 4.667
      assert.ok(largeSample > 4.65, `Expected large sample to stay above 4.65, got ${largeSample}`);

      // Shrinkage distance from raw rating:
      const smallShrinkage = Math.abs(5.0 - smallSample);
      const largeShrinkage = Math.abs(4.7 - largeSample);

      assert.ok(
        smallShrinkage > largeShrinkage,
        `2x5.0-star shrinkage (${smallShrinkage.toFixed(3)}) must be greater than 200x4.7 shrinkage (${largeShrinkage.toFixed(3)})`
      );
    });

    it('returns priorMean when sampleSize is zero', () => {
      const zeroReviews = adjustedRating({
        sampleRating: 0,
        sampleSize: 0,
        priorMean: 4.2,
      });
      assert.equal(zeroReviews, 4.2);
    });
  });

  describe('scoreProduct pure engine invariants', () => {
    it('produces identical score and computationHash for identical inputs', () => {
      const res1 = scoreProduct(baseProductInput, config);
      const res2 = scoreProduct({ ...baseProductInput }, config);

      assert.equal(res1.status, 'SCORED');
      assert.equal(res1.finalScore, res2.finalScore);
      assert.equal(res1.computationHash, res2.computationHash);
      assert.deepEqual(res1.breakdown, res2.breakdown);
    });

    it('calculates significantly different scores for office vs gaming use-cases', () => {
      const officeRes = scoreProduct({ ...baseProductInput, useCase: 'office_study' }, config);
      const gamingRes = scoreProduct({ ...baseProductInput, useCase: 'gaming' }, config);

      assert.equal(officeRes.status, 'SCORED');
      assert.equal(gamingRes.status, 'SCORED');
      assert.notEqual(
        officeRes.breakdown.rawCapability,
        gamingRes.breakdown.rawCapability,
        'Office and Gaming capability must differ based on rubric metrics and weights'
      );
    });

    it('abstains when a mandatory benchmark metric is missing', () => {
      const missingMandatoryInput: ScoreInput = {
        ...baseProductInput,
        benchmarks: [
          // Missing mandatory 'battery_web_browsing' for office_study
          { metric: 'geekbench_multi_core', value: 12000 },
        ],
      };

      const result = scoreProduct(missingMandatoryInput, config);
      assert.equal(result.status, 'ABSTAINED');
      assert.equal(result.finalScore, 0);
      assert.ok(result.abstainReason?.includes('battery_web_browsing'));
    });

    it('proves sales count perturbation has strictly zero effect on score', () => {
      const scoreWithoutSales = scoreProduct({ ...baseProductInput, salesCount: 0 }, config);
      const scoreWithHighSales = scoreProduct({ ...baseProductInput, salesCount: 15_000 }, config);

      assert.equal(
        scoreWithoutSales.finalScore,
        scoreWithHighSales.finalScore,
        'Sales perturbation must have NO effect on P/P scoring engine'
      );
      assert.equal(scoreWithoutSales.computationHash, scoreWithHighSales.computationHash);
    });

    it('accurately computes price efficiency with high-value VND prices exceeding Int32', () => {
      // 55 billion VND (55,000,000,000 > Int32 max 2,147,483,647)
      const bigIntPriceInput: ScoreInput = {
        ...baseProductInput,
        price: BigInt('55000000000'),
        cohortPrices: [
          BigInt('40000000000'),
          BigInt('55000000000'),
          BigInt('70000000000'),
        ],
      };

      const result = scoreProduct(bigIntPriceInput, config);
      assert.equal(result.status, 'SCORED');
      assert.ok(result.breakdown.priceEfficiency >= 0 && result.breakdown.priceEfficiency <= 100);
      assert.ok(result.finalScore >= 0 && result.finalScore <= 100);
    });

    it('conforms to standard 0.65 PriceEfficiency + 0.25 Experience + 0.10 Support formula', () => {
      const result = scoreProduct(baseProductInput, config);

      const expectedWeightedSum =
        0.65 * result.breakdown.priceEfficiency +
        0.25 * result.breakdown.experience +
        0.10 * result.breakdown.support;

      // Allow 0.1 rounding tolerance for 1-decimal rounding of finalScore
      assert.ok(
        Math.abs(result.finalScore - expectedWeightedSum) <= 0.2,
        `Final score (${result.finalScore}) must reflect 0.65/0.25/0.10 weighted sum (${expectedWeightedSum.toFixed(2)})`
      );
    });
  });
});
