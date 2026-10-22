import crypto from 'node:crypto';
import type {
  PublishedScoringConfig,
  UseCaseScoringConfig,
  ScoringMetricConfig,
  UseCaseWeights,
} from '@shared/types/intelligence';

const TOLERANCE = 0.001;

function isCloseToOne(val: number): boolean {
  return Math.abs(val - 1.0) <= TOLERANCE;
}

export function computeConfigHash(configObj: Record<string, unknown>): string {
  // Normalize and sort keys deterministically before hashing
  const serializeCanonical = (val: unknown): string => {
    if (val === null || typeof val !== 'object') {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return '[' + val.map(serializeCanonical).join(',') + ']';
    }
    const entries = Object.entries(val as Record<string, unknown>)
      .filter(([k]) => k !== 'configHash' && k !== 'publishedAt') // hash intrinsic rules
      .sort(([a], [b]) => a.localeCompare(b));
    return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + serializeCanonical(v)).join(',') + '}';
  };

  return crypto
    .createHash('sha256')
    .update(serializeCanonical(configObj))
    .digest('hex');
}

export function validateScoringConfig(input: unknown): PublishedScoringConfig {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Scoring configuration must be a non-null object');
  }

  const raw = input as Record<string, unknown>;

  // 1. Version
  if (
    typeof raw.version !== 'number' ||
    !Number.isInteger(raw.version) ||
    raw.version < 1
  ) {
    throw new Error('version must be an integer >= 1');
  }

  // 2. Category identification
  if (typeof raw.categoryId !== 'string' || raw.categoryId.trim() === '') {
    throw new Error('categoryId must be a non-empty string');
  }

  // 3. Use Cases
  if (
    typeof raw.useCases !== 'object' ||
    raw.useCases === null ||
    Array.isArray(raw.useCases)
  ) {
    throw new Error('useCases must be an object dictionary of use cases');
  }

  const rawUseCases = raw.useCases as Record<string, unknown>;
  const useCaseKeys = Object.keys(rawUseCases);
  if (useCaseKeys.length === 0) {
    throw new Error('useCases must contain at least one valid use case');
  }

  const validatedUseCases: Record<string, UseCaseScoringConfig> = {};

  for (const key of useCaseKeys) {
    const uc = rawUseCases[key];
    if (typeof uc !== 'object' || uc === null) {
      throw new Error(`useCases.${key} must be an object`);
    }

    const u = uc as Record<string, unknown>;
    const useCaseName = (typeof u.useCase === 'string' && u.useCase.trim()) || key;
    const label = (typeof u.label === 'string' && u.label.trim()) || useCaseName;

    // Validate weights: priceEfficiency, experience, support
    if (typeof u.weights !== 'object' || u.weights === null) {
      throw new Error(`useCases.${key}.weights must be an object`);
    }
    const w = u.weights as Record<string, unknown>;

    const pe = Number(w.priceEfficiency);
    const exp = Number(w.experience);
    const sup = Number(w.support);

    if (isNaN(pe) || isNaN(exp) || isNaN(sup)) {
      throw new Error(`useCases.${key}.weights components must be valid numbers`);
    }

    if (pe < 0 || pe > 1 || exp < 0 || exp > 1 || sup < 0 || sup > 1) {
      throw new Error(`useCases.${key}.weights component weight each must be between 0 and 1`);
    }

    const weightSum = pe + exp + sup;
    if (!isCloseToOne(weightSum)) {
      throw new Error(
        `useCases.${key}.weights (priceEfficiency + experience + support) must sum to 1.0 (got ${weightSum.toFixed(3)})`
      );
    }

    const validatedWeights: UseCaseWeights = {
      priceEfficiency: pe,
      experience: exp,
      support: sup,
    };

    // Validate capabilityMetrics
    if (!Array.isArray(u.capabilityMetrics) || u.capabilityMetrics.length === 0) {
      throw new Error(`useCases.${key}.capabilityMetrics must be a non-empty array`);
    }

    const validatedMetrics: ScoringMetricConfig[] = [];
    let metricWeightSum = 0;

    for (let i = 0; i < u.capabilityMetrics.length; i++) {
      const m = u.capabilityMetrics[i] as Record<string, unknown>;
      if (typeof m !== 'object' || m === null) {
        throw new Error(`useCases.${key}.capabilityMetrics[${i}] must be an object`);
      }

      if (typeof m.key !== 'string' || m.key.trim() === '') {
        throw new Error(`useCases.${key}.capabilityMetrics[${i}].key must be a non-empty string`);
      }

      const mWeight = Number(m.weight);
      if (isNaN(mWeight) || mWeight < 0 || mWeight > 1) {
        throw new Error(`useCases.${key}.capabilityMetrics[${i}].weight must be between 0 and 1`);
      }
      metricWeightSum += mWeight;

      if (m.direction !== 'HIGHER' && m.direction !== 'LOWER') {
        throw new Error(
          `useCases.${key}.capabilityMetrics[${i}].direction must be 'HIGHER' or 'LOWER'`
        );
      }

      const source = (m.source as string) ?? 'BENCHMARK';
      if (source !== 'BENCHMARK' && source !== 'SPEC' && source !== 'EVIDENCE') {
        throw new Error(
          `useCases.${key}.capabilityMetrics[${i}].source must be 'BENCHMARK', 'SPEC', or 'EVIDENCE'`
        );
      }

      validatedMetrics.push({
        key: m.key.trim(),
        weight: mWeight,
        direction: m.direction,
        source,
        metricName: typeof m.metricName === 'string' ? m.metricName.trim() : undefined,
        specPath: typeof m.specPath === 'string' ? m.specPath.trim() : undefined,
        mandatory: Boolean(m.mandatory),
        minThreshold: typeof m.minThreshold === 'number' ? m.minThreshold : undefined,
      });
    }

    if (!isCloseToOne(metricWeightSum)) {
      throw new Error(
        `useCases.${key}.capabilityMetrics weights (${metricWeightSum.toFixed(3)}) must sum to 1.0`
      );
    }

    validatedUseCases[key] = {
      useCase: useCaseName,
      label,
      description: typeof u.description === 'string' ? u.description : undefined,
      weights: validatedWeights,
      capabilityMetrics: validatedMetrics,
      experienceWeights:
        typeof u.experienceWeights === 'object' && u.experienceWeights !== null
          ? (u.experienceWeights as { shopReviews: number; externalReviews: number })
          : undefined,
      supportWeights:
        typeof u.supportWeights === 'object' && u.supportWeights !== null
          ? (u.supportWeights as { warrantyMonths: number; brandReliability: number })
          : undefined,
      minCoverage: typeof u.minCoverage === 'number' ? u.minCoverage : 0.60,
    };
  }

  const publishedAt =
    typeof raw.publishedAt === 'string' && raw.publishedAt.trim() !== ''
      ? raw.publishedAt
      : new Date().toISOString();

  const canonicalObj = {
    version: raw.version,
    categoryId: raw.categoryId,
    categorySlug: typeof raw.categorySlug === 'string' ? raw.categorySlug : undefined,
    useCases: validatedUseCases,
  };

  const configHash = computeConfigHash(canonicalObj);

  return {
    version: raw.version,
    categoryId: raw.categoryId as string,
    categorySlug: typeof raw.categorySlug === 'string' ? raw.categorySlug : undefined,
    publishedAt,
    useCases: validatedUseCases,
    configHash,
  };
}
