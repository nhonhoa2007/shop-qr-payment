import { prisma } from '@server/database/prisma.ts';
import { validateScoringConfig } from '@shared/validations/scoring-config.ts';
import type { PublishedScoringConfig, UseCaseScoringConfig } from '@shared/types/intelligence.ts';

export const DEFAULT_LAPTOP_USE_CASES: Record<string, UseCaseScoringConfig> = {
  office_study: {
    useCase: 'office_study',
    label: 'Văn phòng & Học tập',
    description: 'Ưu tiên thời lượng pin, độ êm ái, tính di động và đa nhiệm văn phòng',
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
    label: 'Gaming & Đồ họa nặng',
    description: 'Ưu tiên sức mạnh GPU rời, tản nhiệt, CPU đơn nhân và màn hình tần số quét cao',
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
  programming: {
    useCase: 'programming',
    label: 'Lập trình & Kỹ thuật',
    description: 'Ưu tiên RAM, đa nhân CPU mạnh mẽ, tốc độ SSD và bàn phím',
    weights: {
      priceEfficiency: 0.65,
      experience: 0.25,
      support: 0.10,
    },
    capabilityMetrics: [
      {
        key: 'cpu_multicore',
        weight: 0.45,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'geekbench_multi_core',
        mandatory: true,
      },
      {
        key: 'ram_capacity_gb',
        weight: 0.30,
        direction: 'HIGHER',
        source: 'SPEC',
        specPath: 'ram_gb',
        mandatory: false,
      },
      {
        key: 'battery_life',
        weight: 0.25,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'battery_web_browsing',
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
  creative: {
    useCase: 'creative',
    label: 'Sáng tạo & Đồ họa 2D/3D',
    description: 'Ưu tiên độ phủ màu màn hình, GPU tăng tốc render, và CPU hiệu năng cao',
    weights: {
      priceEfficiency: 0.65,
      experience: 0.25,
      support: 0.10,
    },
    capabilityMetrics: [
      {
        key: 'gpu_performance',
        weight: 0.40,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: '3dmark_timespy_graphics',
        mandatory: false,
      },
      {
        key: 'cpu_multicore',
        weight: 0.35,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'geekbench_multi_core',
        mandatory: true,
      },
      {
        key: 'display_color_gamut',
        weight: 0.25,
        direction: 'HIGHER',
        source: 'SPEC',
        specPath: 'color_gamut_srgb_pct',
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
};

export const DEFAULT_PHONE_USE_CASES: Record<string, UseCaseScoringConfig> = {
  everyday: {
    useCase: 'everyday',
    label: 'Sử dụng thường ngày',
    description: 'Thời lượng pin, màn hình sáng đẹp, thiết kế gọn gàng và camera chụp nhanh',
    weights: {
      priceEfficiency: 0.65,
      experience: 0.25,
      support: 0.10,
    },
    capabilityMetrics: [
      {
        key: 'battery_life',
        weight: 0.40,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'battery_active_use_hours',
        mandatory: true,
      },
      {
        key: 'chipset_performance',
        weight: 0.35,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'geekbench_multi_core',
        mandatory: true,
      },
      {
        key: 'weight_g',
        weight: 0.25,
        direction: 'LOWER',
        source: 'SPEC',
        specPath: 'weight_g',
        mandatory: false,
      },
    ],
    minCoverage: 0.60,
  },
  gaming: {
    useCase: 'gaming',
    label: 'Gaming & Đồ họa di động',
    description: 'GPU đồ họa 3D, tản nhiệt và tần số quét cao',
    weights: {
      priceEfficiency: 0.65,
      experience: 0.25,
      support: 0.10,
    },
    capabilityMetrics: [
      {
        key: 'gpu_performance',
        weight: 0.55,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: '3dmark_wildlife_extreme',
        mandatory: true,
      },
      {
        key: 'chipset_performance',
        weight: 0.45,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'geekbench_multi_core',
        mandatory: true,
      },
    ],
    minCoverage: 0.60,
  },
  photo_video: {
    useCase: 'photo_video',
    label: 'Nhiếp ảnh & Quay phim',
    description: 'Chất lượng cảm biến, chống rung OIS và ống kính tele',
    weights: {
      priceEfficiency: 0.65,
      experience: 0.25,
      support: 0.10,
    },
    capabilityMetrics: [
      {
        key: 'camera_score',
        weight: 0.60,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'dxomark_camera_score',
        mandatory: true,
      },
      {
        key: 'chipset_performance',
        weight: 0.40,
        direction: 'HIGHER',
        source: 'BENCHMARK',
        metricName: 'geekbench_multi_core',
        mandatory: true,
      },
    ],
    minCoverage: 0.60,
  },
};

export function getDefaultScoringConfig(
  categoryId: string,
  kind?: string
): PublishedScoringConfig {
  const useCases =
    kind === 'PHONE'
      ? DEFAULT_PHONE_USE_CASES
      : DEFAULT_LAPTOP_USE_CASES;

  return validateScoringConfig({
    version: 1,
    categoryId,
    categorySlug: kind?.toLowerCase() ?? 'laptops',
    publishedAt: new Date().toISOString(),
    useCases,
  });
}

// In-memory cache for fast lookup during high-throughput requests
const scoringConfigCache = new Map<string, PublishedScoringConfig>();

export function invalidateScoringConfigCache(categoryId?: string): void {
  if (categoryId) {
    scoringConfigCache.delete(categoryId);
  } else {
    scoringConfigCache.clear();
  }
}

export interface CategoryDb {
  category: {
    findUnique(args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }): Promise<{
      id: string;
      kind: string;
      slug: string;
      scoringConfig?: unknown;
    } | null>;
    update(args: {
      where: { id: string };
      data: { scoringConfig: unknown };
    }): Promise<unknown>;
  };
}

export async function getCategoryScoringConfig(
  categoryId: string,
  dbClient?: CategoryDb
): Promise<PublishedScoringConfig> {
  const cached = scoringConfigCache.get(categoryId);
  if (cached) {
    return cached;
  }

  const client = dbClient ?? (prisma as unknown as CategoryDb);
  const category = await client.category.findUnique({
    where: { id: categoryId },
    select: { id: true, kind: true, slug: true, scoringConfig: true },
  });

  if (!category) {
    throw new Error(`Category not found with id: ${categoryId}`);
  }

  let config: PublishedScoringConfig;

  if (category.scoringConfig && typeof category.scoringConfig === 'object') {
    try {
      config = validateScoringConfig(category.scoringConfig);
    } catch {
      // Fallback to default if stored config is invalid or legacy
      config = getDefaultScoringConfig(category.id, category.kind);
    }
  } else {
    config = getDefaultScoringConfig(category.id, category.kind);
  }

  scoringConfigCache.set(categoryId, config);
  return config;
}

export async function saveCategoryScoringConfig(
  categoryId: string,
  rawConfig: unknown,
  dbClient?: CategoryDb
): Promise<PublishedScoringConfig> {
  const validated = validateScoringConfig(rawConfig);

  if (validated.categoryId !== categoryId) {
    throw new Error(
      `Config categoryId (${validated.categoryId}) does not match target category (${categoryId})`
    );
  }

  const client = dbClient ?? (prisma as unknown as CategoryDb);
  await client.category.update({
    where: { id: categoryId },
    data: {
      scoringConfig: validated as unknown as Record<string, unknown>,
    },
  });

  scoringConfigCache.set(categoryId, validated);
  return validated;
}
