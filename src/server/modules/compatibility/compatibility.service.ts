/**
 * Compatibility Service (Application Layer)
 * Manages CompatibilityRule lifecycle (Draft -> Activate -> Revoke),
 * coordinates deterministic engine evaluation, and handles Redis caching / instant revocation invalidation.
 */

import { prisma as globalPrisma } from '../../database/prisma.ts';
import { redis } from '../../infrastructure/redis.ts';
import { evaluateCompatibility } from './compatibility.engine.ts';
import { validateCompatibilityRule } from '../../../shared/validations/compatibility-rule.ts';
import type {
  CompatibilityCheckDto,
  CompatibilityQuery,
  CompatibilityRuleDefinition,
  CompatibilityTargetSpecs,
  DraftCompatibilityRuleInput,
} from '../../../shared/types/compatibility.ts';

const COMPAT_CACHE_PREFIX = 'compat:';
const COMPAT_CACHE_TTL_SECONDS = 3600; // 1 hour

function buildCacheKey(query: CompatibilityQuery): string {
  const dev = query.deviceVariantId || query.deviceProductId || 'unknown-device';
  const acc = query.accessoryVariantId || query.accessoryProductId || 'unknown-accessory';
  return `${COMPAT_CACHE_PREFIX}${dev}:${acc}`;
}

/**
 * Checks whether user has permission to draft rules (STAFF with knowledge permission or ADMIN).
 */
async function assertDraftPermission(actorId: string, db: any): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: actorId },
  });

  if (!user) {
    throw new Error('Forbidden: actor not found');
  }

  if (user.role === 'ADMIN') return;

  if (user.role === 'STAFF') {
    // Check permission list attached to user or in staffPermission table
    const perms = user.permissions || [];
    const hasKnowledge = perms.some(
      (p: any) => p === 'knowledge' || p.permission === 'knowledge'
    );
    if (hasKnowledge) return;
  }

  throw new Error('Forbidden: requires knowledge permission to draft compatibility rules');
}

/**
 * Checks whether user is ADMIN for rule activation or revocation.
 */
async function assertAdminRole(actorId: string, db: any): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: actorId },
  });

  if (!user || user.role !== 'ADMIN') {
    throw new Error('Unauthorized: only ADMIN can activate or revoke compatibility rules');
  }
}

/**
 * Drafts a new CompatibilityRule (Knowledge STAFF or ADMIN).
 */
export async function draftCompatibilityRule(
  input: DraftCompatibilityRuleInput,
  actorId: string,
  db: any = globalPrisma
): Promise<CompatibilityRuleDefinition> {
  await assertDraftPermission(actorId, db);

  const validated = validateCompatibilityRule({
    schemaVersion: 1,
    ...input,
    status: 'DRAFT',
  });

  const created = await db.compatibilityRule.create({
    data: {
      ruleCode: validated.ruleCode,
      name: validated.name,
      description: validated.description,
      direction: validated.direction,
      sourceCategoryId: validated.sourceCategoryId,
      targetCategoryId: validated.targetCategoryId,
      categoryScope: validated.categoryScope,
      conditions: validated.conditions as any,
      warnings: validated.warnings as any,
      market: validated.market,
      version: validated.version,
      status: 'DRAFT',
      sourceId: validated.sourceId,
      createdById: actorId,
    },
  });

  return created;
}

/**
 * Activates a drafted CompatibilityRule (ADMIN only).
 */
export async function activateCompatibilityRule(
  ruleId: string,
  actorId: string,
  db: any = globalPrisma
): Promise<CompatibilityRuleDefinition> {
  await assertAdminRole(actorId, db);

  const existing = await db.compatibilityRule.findUnique({
    where: { id: ruleId },
  });
  if (!existing) {
    throw new Error(`Compatibility rule not found: ${ruleId}`);
  }

  const activated = await db.compatibilityRule.update({
    where: { id: ruleId },
    data: {
      status: 'ACTIVE',
      approvedById: actorId,
      approvedAt: new Date(),
    },
  });

  // Invalidate any stale caches
  await redis.delPattern(`${COMPAT_CACHE_PREFIX}*`);

  return activated;
}

/**
 * Revokes an active CompatibilityRule with reason (ADMIN only).
 * Immediately invalidates all cached positive results.
 */
export async function revokeCompatibilityRule(
  ruleId: string,
  actorId: string,
  reason: string,
  db: any = globalPrisma
): Promise<CompatibilityRuleDefinition> {
  await assertAdminRole(actorId, db);

  const existing = await db.compatibilityRule.findUnique({
    where: { id: ruleId },
  });
  if (!existing) {
    throw new Error(`Compatibility rule not found: ${ruleId}`);
  }

  const revoked = await db.compatibilityRule.update({
    where: { id: ruleId },
    data: {
      status: 'REVOKED',
      revocationReason: reason,
      revokedAt: new Date(),
    },
  });

  // Rule revoked -> immediately invalidate all positive compatibility caches
  await redis.delPattern(`${COMPAT_CACHE_PREFIX}*`);

  return revoked;
}

/**
 * Retrieves a CompatibilityRule by ID.
 */
export async function getCompatibilityRule(
  ruleId: string,
  db: any = globalPrisma
): Promise<CompatibilityRuleDefinition | null> {
  return await db.compatibilityRule.findUnique({
    where: { id: ruleId },
  });
}

/**
 * Lists compatibility rules with optional status/market filters.
 */
export async function listCompatibilityRules(
  filter: { status?: string; market?: string } = {},
  db: any = globalPrisma
): Promise<CompatibilityRuleDefinition[]> {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.market) where.market = filter.market;

  return await db.compatibilityRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Resolves a target product/variant into CompatibilityTargetSpecs.
 */
async function resolveTargetSpecs(
  variantId?: string,
  productId?: string,
  db: any = globalPrisma
): Promise<CompatibilityTargetSpecs | null> {
  if (variantId) {
    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant || !variant.product) return null;

    return {
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.product.name,
      variantName: variant.title,
      categoryId: variant.product.categoryId,
      categorySlug: variant.product.categoryRef?.slug || variant.product.category,
      market: variant.product.market || 'VN',
      specs: variant.product.specs,
      specOverrides: variant.specOverrides,
    };
  }

  if (productId) {
    const product = await db.product.findUnique({
      where: { id: productId },
    });
    if (!product) return null;

    return {
      productId: product.id,
      variantId: null,
      productName: product.name,
      variantName: null,
      categoryId: product.categoryId,
      categorySlug: product.categoryRef?.slug || product.category,
      market: product.market || 'VN',
      specs: product.specs,
      specOverrides: null,
    };
  }

  return null;
}

/**
 * Checks compatibility between a device and an accessory.
 * Uses Redis cache for positive results and evaluates on-demand on cache miss.
 */
export async function checkCompatibility(
  query: CompatibilityQuery,
  db: any = globalPrisma
): Promise<CompatibilityCheckDto> {
  const cacheKey = buildCacheKey(query);

  // 1. Check Redis cache
  const cached = await redis.get<CompatibilityCheckDto>(cacheKey);
  if (cached && cached.status === 'COMPATIBLE') {
    return {
      ...cached,
      cacheHit: true,
      evaluatedAt: new Date().toISOString(),
    };
  }

  // 2. Resolve specs for device and accessory
  const device = await resolveTargetSpecs(query.deviceVariantId, query.deviceProductId, db);
  const accessory = await resolveTargetSpecs(query.accessoryVariantId, query.accessoryProductId, db);

  if (!device || !accessory) {
    return {
      status: 'UNKNOWN',
      device: {
        productId: query.deviceProductId || '',
        variantId: query.deviceVariantId || null,
        productName: 'Unknown Device',
      },
      accessory: {
        productId: query.accessoryProductId || '',
        variantId: query.accessoryVariantId || null,
        productName: 'Unknown Accessory',
      },
      reasons: ['Device or accessory could not be found in active catalog.'],
      warnings: [],
      matchedRuleId: null,
      matchedRuleCode: null,
      evaluatedAt: new Date().toISOString(),
      cacheHit: false,
    };
  }

  // 3. Fetch active rules
  const activeRulesRaw = await db.compatibilityRule.findMany({
    where: { status: 'ACTIVE' },
  });

  const activeRules: CompatibilityRuleDefinition[] = activeRulesRaw.map((r: any) => ({
    ...r,
    conditions: r.conditions,
    categoryScope: r.categoryScope,
  }));

  // 4. Pure deterministic evaluation
  const result = evaluateCompatibility({
    device,
    accessory,
    rules: activeRules,
  });

  // 5. Cache COMPATIBLE results
  if (result.status === 'COMPATIBLE') {
    await redis.set(cacheKey, result, { ex: COMPAT_CACHE_TTL_SECONDS });
  }

  return {
    ...result,
    cacheHit: false,
  };
}

/**
 * Lists all active accessories compatible with a given device variant.
 */
export async function listCompatibleAccessories(
  deviceVariantId: string,
  db: any = globalPrisma
): Promise<CompatibilityCheckDto[]> {
  const device = await resolveTargetSpecs(deviceVariantId, undefined, db);
  if (!device) return [];

  // Fetch active rules to find target accessory categories
  const activeRulesRaw = await db.compatibilityRule.findMany({
    where: { status: 'ACTIVE' },
  });

  const activeRules: CompatibilityRuleDefinition[] = activeRulesRaw.map((r: any) => ({
    ...r,
    conditions: r.conditions,
    categoryScope: r.categoryScope,
  }));

  if (activeRules.length === 0) return [];

  // Find all active candidate accessory variants
  const candidateVariants = await db.productVariant.findMany({
    where: {
      isActive: true,
      product: {
        isActive: true,
      },
    },
    include: {
      product: true,
    },
  });

  const compatibleList: CompatibilityCheckDto[] = [];

  for (const variant of candidateVariants) {
    // Avoid pairing a device with itself
    if (variant.id === deviceVariantId || variant.productId === device.productId) {
      continue;
    }

    const accessory: CompatibilityTargetSpecs = {
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.product.name,
      variantName: variant.title,
      categoryId: variant.product.categoryId,
      categorySlug: variant.product.categoryRef?.slug || variant.product.category,
      market: variant.product.market || 'VN',
      specs: variant.product.specs,
      specOverrides: variant.specOverrides,
    };

    const evaluation = evaluateCompatibility({
      device,
      accessory,
      rules: activeRules,
    });

    if (evaluation.status === 'COMPATIBLE') {
      compatibleList.push(evaluation);
    }
  }

  return compatibleList;
}
