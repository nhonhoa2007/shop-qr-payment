import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateScoringConfig } from '../src/shared/validations/scoring-config.ts';
import {
  getDefaultScoringConfig,
  getCategoryScoringConfig,
  saveCategoryScoringConfig,
  invalidateScoringConfigCache,
} from '../src/server/modules/intelligence/scoring-config.service.ts';
import type { PublishedScoringConfig } from '../src/shared/types/intelligence.ts';

describe('Commerce Intelligence: Scoring Config Validation', () => {
  const validLaptopConfig = {
    version: 1,
    categoryId: 'cat_laptop_123',
    categorySlug: 'laptops',
    publishedAt: '2026-10-18T00:00:00.000Z',
    useCases: {
      office_study: {
        useCase: 'office_study',
        label: 'Office & Study',
        description: 'Battery life, portability, and responsive office multitasking',
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
            weight: 0.35,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: 'battery_web_browsing',
            mandatory: true,
          },
          {
            key: 'weight_kg',
            weight: 0.30,
            direction: 'LOWER',
            source: 'SPEC',
            specPath: 'weight_kg',
            mandatory: false,
          },
        ],
        experienceWeights: {
          shopReviews: 0.50,
          externalReviews: 0.50,
        },
        supportWeights: {
          warrantyMonths: 0.60,
          brandReliability: 0.40,
        },
        minCoverage: 0.60,
      },
      gaming: {
        useCase: 'gaming',
        label: 'Gaming & High Performance',
        description: 'Graphics horsepower, CPU single-core, and high refresh rate display',
        weights: {
          priceEfficiency: 0.65,
          experience: 0.25,
          support: 0.10,
        },
        capabilityMetrics: [
          {
            key: 'gpu_performance',
            weight: 0.50,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: '3dmark_timespy_graphics',
            mandatory: true,
          },
          {
            key: 'cpu_multicore',
            weight: 0.30,
            direction: 'HIGHER',
            source: 'BENCHMARK',
            metricName: 'geekbench_multi_core',
            mandatory: true,
          },
          {
            key: 'display_refresh_rate',
            weight: 0.20,
            direction: 'HIGHER',
            source: 'SPEC',
            specPath: 'refresh_rate_hz',
            mandatory: false,
          },
        ],
      },
    },
  };

  it('validates a complete and compliant scoring configuration', () => {
    const config: PublishedScoringConfig = validateScoringConfig(validLaptopConfig);

    assert.equal(config.version, 1);
    assert.equal(config.categoryId, 'cat_laptop_123');
    assert.ok(config.configHash, 'Config hash must be computed');
    assert.equal(typeof config.configHash, 'string');
    assert.ok(config.useCases.office_study);
    assert.ok(config.useCases.gaming);
  });

  it('generates reproducible configHash for identical inputs', () => {
    const config1 = validateScoringConfig(validLaptopConfig);
    const config2 = validateScoringConfig({ ...validLaptopConfig });

    assert.equal(config1.configHash, config2.configHash);
  });

  it('rejects invalid or missing version numbers', () => {
    assert.throws(
      () => validateScoringConfig({ ...validLaptopConfig, version: 0 }),
      /version must be an integer >= 1/
    );

    assert.throws(
      () => validateScoringConfig({ ...validLaptopConfig, version: 1.5 }),
      /version must be an integer >= 1/
    );
  });

  it('rejects weights that do not sum to 1.0 (tolerance 0.001)', () => {
    const invalidWeights = {
      ...validLaptopConfig,
      useCases: {
        office_study: {
          ...validLaptopConfig.useCases.office_study,
          weights: {
            priceEfficiency: 0.60,
            experience: 0.20,
            support: 0.10, // Sums to 0.90 !== 1.00
          },
        },
      },
    };

    assert.throws(
      () => validateScoringConfig(invalidWeights),
      /weights.*must sum to 1\.0/
    );
  });

  it('rejects negative weights or weights exceeding 1.0', () => {
    const negativeWeight = {
      ...validLaptopConfig,
      useCases: {
        office_study: {
          ...validLaptopConfig.useCases.office_study,
          weights: {
            priceEfficiency: 1.20,
            experience: -0.10,
            support: -0.10,
          },
        },
      },
    };

    assert.throws(
      () => validateScoringConfig(negativeWeight),
      /weight.*must be between 0 and 1/
    );
  });

  it('rejects capability metrics whose weights do not sum to 1.0', () => {
    const invalidMetrics = {
      ...validLaptopConfig,
      useCases: {
        office_study: {
          ...validLaptopConfig.useCases.office_study,
          capabilityMetrics: [
            {
              key: 'cpu_multicore',
              weight: 0.50,
              direction: 'HIGHER',
              source: 'BENCHMARK',
              metricName: 'geekbench_multi_core',
            },
            {
              key: 'battery_life',
              weight: 0.20, // 0.50 + 0.20 = 0.70 !== 1.00
              direction: 'HIGHER',
              source: 'BENCHMARK',
              metricName: 'battery_web_browsing',
            },
          ],
        },
      },
    };

    assert.throws(
      () => validateScoringConfig(invalidMetrics),
      /capabilityMetrics weights.*must sum to 1\.0/
    );
  });

  it('rejects invalid metric direction or missing key', () => {
    const invalidDirection = {
      ...validLaptopConfig,
      useCases: {
        office_study: {
          ...validLaptopConfig.useCases.office_study,
          capabilityMetrics: [
            {
              key: 'cpu_multicore',
              weight: 1.0,
              direction: 'SIDEWAYS', // Invalid
              source: 'BENCHMARK',
            },
          ],
        },
      },
    };

    assert.throws(
      () => validateScoringConfig(invalidDirection),
      /direction must be 'HIGHER' or 'LOWER'/
    );
  });

  it('rejects configuration without any use case defined', () => {
    assert.throws(
      () => validateScoringConfig({ ...validLaptopConfig, useCases: {} }),
      /useCases must contain at least one valid use case/
    );
  });
});

describe('Commerce Intelligence: Scoring Config Service & Category Defaults', () => {
  it('provides default scoring config for LAPTOP and PHONE with appropriate use cases', () => {
    const laptopConfig = getDefaultScoringConfig('cat_laptop_1', 'LAPTOP');
    assert.equal(laptopConfig.categoryId, 'cat_laptop_1');
    assert.ok(laptopConfig.useCases.office_study);
    assert.ok(laptopConfig.useCases.gaming);
    assert.ok(laptopConfig.useCases.programming);
    assert.ok(laptopConfig.useCases.creative);

    const phoneConfig = getDefaultScoringConfig('cat_phone_1', 'PHONE');
    assert.equal(phoneConfig.categoryId, 'cat_phone_1');
    assert.ok(phoneConfig.useCases.everyday);
    assert.ok(phoneConfig.useCases.gaming);
    assert.ok(phoneConfig.useCases.photo_video);
  });

  it('fetches category config from mock DB and caches the result', async () => {
    invalidateScoringConfigCache();

    let findCount = 0;
    const mockDb = {
      category: {
        async findUnique() {
          findCount++;
          return {
            id: 'cat_laptop_99',
            kind: 'LAPTOP',
            slug: 'laptops',
            scoringConfig: null, // Should fallback to default
          };
        },
        async update() {
          return {};
        },
      },
    };

    const config1 = await getCategoryScoringConfig('cat_laptop_99', mockDb);
    assert.equal(config1.categoryId, 'cat_laptop_99');
    assert.equal(findCount, 1);

    // Second call should hit in-memory cache
    const config2 = await getCategoryScoringConfig('cat_laptop_99', mockDb);
    assert.equal(config2.categoryId, 'cat_laptop_99');
    assert.equal(findCount, 1, 'Second fetch must be served from cache without DB call');

    // Invalidation clears cache
    invalidateScoringConfigCache('cat_laptop_99');
    const config3 = await getCategoryScoringConfig('cat_laptop_99', mockDb);
    assert.equal(config3.categoryId, 'cat_laptop_99');
    assert.equal(findCount, 2, 'Fetch after cache invalidation must hit DB');
  });

  it('persists validated config to DB and updates cache', async () => {
    let savedConfig: unknown = null;
    const mockDb = {
      category: {
        async findUnique() {
          return {
            id: 'cat_laptop_99',
            kind: 'LAPTOP',
            slug: 'laptops',
            scoringConfig: savedConfig,
          };
        },
        async update(args: { where: { id: string }; data: { scoringConfig: unknown } }) {
          savedConfig = args.data.scoringConfig;
          return { id: args.where.id };
        },
      },
    };

    const newConfigPayload = {
      version: 2,
      categoryId: 'cat_laptop_99',
      categorySlug: 'laptops',
      publishedAt: '2026-10-18T10:00:00.000Z',
      useCases: {
        office_study: {
          useCase: 'office_study',
          label: 'Office & Study',
          weights: { priceEfficiency: 0.65, experience: 0.25, support: 0.10 },
          capabilityMetrics: [
            {
              key: 'cpu_multicore',
              weight: 0.50,
              direction: 'HIGHER',
              source: 'BENCHMARK',
              metricName: 'geekbench_multi_core',
              mandatory: true,
            },
            {
              key: 'battery_life',
              weight: 0.50,
              direction: 'HIGHER',
              source: 'BENCHMARK',
              metricName: 'battery_web_browsing',
              mandatory: true,
            },
          ],
        },
      },
    };

    const saved = await saveCategoryScoringConfig('cat_laptop_99', newConfigPayload, mockDb);
    assert.equal(saved.version, 2);
    assert.ok(saved.configHash);
    assert.ok(savedConfig);

    const fetched = await getCategoryScoringConfig('cat_laptop_99', mockDb);
    assert.equal(fetched.version, 2);
  });
});
