import crypto from 'node:crypto';
import type {
  PublishedScoringConfig,
  ScoreInput,
  ScoreComputation,
  BayesianRatingInput,
  MetricScoreDetail,
} from '@shared/types/intelligence.ts';

function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundToThreeDecimals(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function normalizeMetric(
  metric: number,
  cohort: number[],
  direction: 'HIGHER' | 'LOWER'
): number {
  const validCohort = cohort.filter((v) => typeof v === 'number' && !isNaN(v));

  if (validCohort.length === 0) {
    return 50;
  }

  const min = Math.min(...validCohort);
  const max = Math.max(...validCohort);

  if (max === min) {
    return 50;
  }

  // Linear min-max ratio clamped between 0 and 1
  const clamped = Math.max(min, Math.min(max, metric));
  const ratio = (clamped - min) / (max - min);

  if (direction === 'LOWER') {
    return roundToOneDecimal((1 - ratio) * 100);
  }

  return roundToOneDecimal(ratio * 100);
}

export function adjustedRating(input: BayesianRatingInput): number {
  const R = input.sampleRating;
  const v = input.sampleSize;
  const C = input.priorMean ?? 4.0;
  const m = input.priorWeight ?? 10;

  if (v <= 0) {
    return C;
  }

  const adjusted = (v / (v + m)) * R + (m / (v + m)) * C;
  return roundToThreeDecimals(adjusted);
}

export function scoreProduct(
  input: ScoreInput,
  config: PublishedScoringConfig
): ScoreComputation {
  const uc = config.useCases[input.useCase];

  if (!uc) {
    return {
      productId: input.productId,
      variantId: input.variantId,
      useCase: input.useCase,
      finalScore: 0,
      status: 'ABSTAINED',
      abstainReason: `Use case '${input.useCase}' not supported in category scoring configuration`,
      coverage: 0,
      breakdown: {
        priceEfficiency: 0,
        experience: 0,
        support: 0,
        rawCapability: 0,
      },
      metricBreakdown: {},
      computationHash: '',
    };
  }

  // 1. Evaluate Capability Metrics
  const metricBreakdown: Record<string, MetricScoreDetail> = {};
  const totalMetricsCount = uc.capabilityMetrics.length;
  let presentMetricsCount = 0;
  let weightedCapabilitySum = 0;
  let presentWeightsSum = 0;

  for (const metric of uc.capabilityMetrics) {
    let rawValue: number | undefined;

    // Look in benchmarks first
    if (metric.source === 'BENCHMARK' || metric.metricName) {
      const match = input.benchmarks.find(
        (b) =>
          b.metric === metric.metricName ||
          b.metric === metric.key
      );
      if (match && typeof match.value === 'number') {
        rawValue = match.value;
      }
    }

    // Fallback to specs if not found
    if (rawValue === undefined && input.specs) {
      const specKey = metric.specPath || metric.key;
      const specVal = input.specs[specKey];
      if (typeof specVal === 'number' && !isNaN(specVal)) {
        rawValue = specVal;
      }
    }

    // Check mandatory rule
    if (rawValue === undefined) {
      if (metric.mandatory) {
        return {
          productId: input.productId,
          variantId: input.variantId,
          useCase: input.useCase,
          finalScore: 0,
          status: 'ABSTAINED',
          abstainReason: `Missing mandatory metric: ${metric.key} (${metric.metricName || metric.specPath})`,
          coverage: presentMetricsCount / totalMetricsCount,
          breakdown: {
            priceEfficiency: 0,
            experience: 0,
            support: 0,
            rawCapability: 0,
          },
          metricBreakdown,
          computationHash: '',
        };
      }
      continue;
    }

    // Metric is present
    presentMetricsCount++;
    const cohort =
      input.cohortBenchmarks[metric.metricName || metric.key] ||
      (metric.specPath ? input.cohortBenchmarks[metric.specPath] : undefined) ||
      [rawValue];

    const normalized = normalizeMetric(rawValue, cohort, metric.direction);
    metricBreakdown[metric.key] = {
      raw: rawValue,
      normalized,
      weight: metric.weight,
      direction: metric.direction,
    };

    weightedCapabilitySum += normalized * metric.weight;
    presentWeightsSum += metric.weight;
  }

  const coverage = totalMetricsCount > 0 ? presentMetricsCount / totalMetricsCount : 0;
  const minCoverage = uc.minCoverage ?? 0.60;

  if (coverage < minCoverage) {
    return {
      productId: input.productId,
      variantId: input.variantId,
      useCase: input.useCase,
      finalScore: 0,
      status: 'ABSTAINED',
      abstainReason: `Coverage (${(coverage * 100).toFixed(0)}%) below minimum required ${(minCoverage * 100).toFixed(0)}%`,
      coverage,
      breakdown: {
        priceEfficiency: 0,
        experience: 0,
        support: 0,
        rawCapability: 0,
      },
      metricBreakdown,
      computationHash: '',
    };
  }

  const rawCapability =
    presentWeightsSum > 0
      ? roundToOneDecimal(weightedCapabilitySum / presentWeightsSum)
      : 50;

  // 2. Evaluate Price Efficiency (BigInt Exact & Cohort Relative)
  let priceScore = 50;
  if (input.cohortPrices && input.cohortPrices.length > 0) {
    // Inverse ratio: higher 1/price means lower price (better efficiency)
    const cohortRates = input.cohortPrices.map((p) => (p > BigInt(0) ? 1 / Number(p) : 0));
    const itemRate = input.price > BigInt(0) ? 1 / Number(input.price) : 0;
    priceScore = normalizeMetric(itemRate, cohortRates, 'HIGHER');
  }

  const priceEfficiency = roundToOneDecimal(rawCapability * 0.5 + priceScore * 0.5);

  // 3. Evaluate Experience (Shop + External Bayesian Aggregation)
  let shopScore = 80;
  if (input.shopReviewStats && input.shopReviewStats.totalReviews > 0) {
    const adj = adjustedRating({
      sampleRating: input.shopReviewStats.averageRating,
      sampleSize: input.shopReviewStats.totalReviews,
      priorMean: 4.0,
      priorWeight: 10,
    });
    shopScore = (adj / 5.0) * 100;
  }

  let extScore = shopScore;
  if (input.externalReviewStats && input.externalReviewStats.totalReviews > 0) {
    const adj = adjustedRating({
      sampleRating: input.externalReviewStats.averageRating,
      sampleSize: input.externalReviewStats.totalReviews,
      priorMean: 4.0,
      priorWeight: 15,
    });
    extScore = (adj / 5.0) * 100;
  }

  const expWeights = uc.experienceWeights || { shopReviews: 0.50, externalReviews: 0.50 };
  const experience = roundToOneDecimal(
    shopScore * expWeights.shopReviews + extScore * expWeights.externalReviews
  );

  // 4. Evaluate Support (Warranty + Brand Reliability)
  const warrantyMonths = input.warrantyMonths ?? 12;
  const warrantyScore = Math.min(100, Math.max(30, (warrantyMonths / 24) * 85));
  const brandScore = input.brandReliabilityScore ?? 80;

  const supWeights = uc.supportWeights || { warrantyMonths: 0.60, brandReliability: 0.40 };
  const support = roundToOneDecimal(
    warrantyScore * supWeights.warrantyMonths + brandScore * supWeights.brandReliability
  );

  // 5. Final Composite Score
  const w = uc.weights;
  const finalScore = roundToOneDecimal(
    priceEfficiency * w.priceEfficiency +
    experience * w.experience +
    support * w.support
  );

  // 6. Computation Hash (Deterministic)
  const hashPayload = {
    productId: input.productId,
    variantId: input.variantId,
    useCase: input.useCase,
    configHash: config.configHash,
    configVersion: config.version,
    price: input.price.toString(),
    finalScore,
    breakdown: {
      priceEfficiency,
      experience,
      support,
      rawCapability,
    },
    metrics: metricBreakdown,
  };

  const computationHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(hashPayload))
    .digest('hex');

  return {
    productId: input.productId,
    variantId: input.variantId,
    useCase: input.useCase,
    finalScore,
    status: 'SCORED',
    coverage: roundToOneDecimal(coverage),
    breakdown: {
      priceEfficiency,
      experience,
      support,
      rawCapability,
    },
    metricBreakdown,
    computationHash,
  };
}
