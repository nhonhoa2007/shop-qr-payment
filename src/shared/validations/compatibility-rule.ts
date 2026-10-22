/**
 * Strict Compatibility Rule DSL Validation (Shared Kernel).
 * Validates canonical compatibility rules and conditions without external dependencies.
 */

import type {
  CompatibilityRuleConditions,
  CompatibilityRuleDefinition,
  CompatibilityDirection,
  CompatibilityRuleStatus,
} from '@shared/types/compatibility';

const ALLOWED_RULE_KEYS = new Set([
  'id',
  'schemaVersion',
  'ruleCode',
  'name',
  'description',
  'direction',
  'sourceCategoryId',
  'targetCategoryId',
  'categoryScope',
  'conditions',
  'warnings',
  'market',
  'version',
  'status',
  'sourceId',
  'createdById',
  'approvedById',
  'approvedAt',
  'rejectionReason',
  'revokedAt',
  'revocationReason',
  'createdAt',
  'updatedAt',
]);

const ALLOWED_CONDITIONS_KEYS = new Set([
  'schemaVersion',
  'connectors',
  'protocols',
  'power',
  'os',
  'customPredicates',
]);

const ALLOWED_POWER_KEYS = new Set([
  'minPowerWatt',
  'maxPowerWatt',
  'strictPowerMatch',
]);

const ALLOWED_CONNECTOR_KEYS = new Set([
  'requiredConnector',
  'accessoryConnector',
]);

const ALLOWED_PROTOCOL_KEYS = new Set([
  'requiredProtocol',
]);

const ALLOWED_OS_KEYS = new Set([
  'requiredOs',
]);

const ALLOWED_CUSTOM_PREDICATE_KEYS = new Set([
  'key',
  'operator',
  'deviceValueKey',
  'accessoryValueKey',
  'expectedValue',
  'mandatory',
]);

const ALLOWED_DIRECTIONS: Set<CompatibilityDirection> = new Set([
  'HOST_TO_ACCESSORY',
  'ACCESSORY_TO_HOST',
  'BIDIRECTIONAL',
]);

const ALLOWED_STATUSES: Set<CompatibilityRuleStatus> = new Set([
  'DRAFT',
  'ACTIVE',
  'REVOKED',
  'ARCHIVED',
]);

const ALLOWED_OPERATORS = new Set(['EQUALS', 'CONTAINS', 'GTE', 'LTE', 'IN']);

function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  entityName: string
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown key in ${entityName}: "${key}"`);
    }
  }
}

/**
 * Validates the conditions JSON payload of a compatibility rule.
 */
export function validateCompatibilityConditions(input: unknown): CompatibilityRuleConditions {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Compatibility conditions must be a non-null object');
  }

  const obj = input as Record<string, unknown>;
  rejectUnknownKeys(obj, ALLOWED_CONDITIONS_KEYS, 'compatibility conditions');

  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion <= 0) {
    throw new Error('Compatibility conditions schemaVersion must be a positive integer');
  }

  const result: CompatibilityRuleConditions = {
    schemaVersion: obj.schemaVersion,
  };

  if (obj.connectors !== undefined) {
    if (!Array.isArray(obj.connectors)) {
      throw new Error('Conditions connectors must be an array');
    }
    result.connectors = obj.connectors.map((c, idx) => {
      if (!c || typeof c !== 'object') {
        throw new Error(`Invalid connector at index ${idx}`);
      }
      rejectUnknownKeys(c as Record<string, unknown>, ALLOWED_CONNECTOR_KEYS, `connector[${idx}]`);
      if (typeof c.requiredConnector !== 'string' || !c.requiredConnector.trim()) {
        throw new Error(`Connector at index ${idx} requires a non-empty requiredConnector`);
      }
      return {
        requiredConnector: c.requiredConnector.trim(),
        accessoryConnector: typeof c.accessoryConnector === 'string' ? c.accessoryConnector.trim() : undefined,
      };
    });
  }

  if (obj.protocols !== undefined) {
    if (!Array.isArray(obj.protocols)) {
      throw new Error('Conditions protocols must be an array');
    }
    result.protocols = obj.protocols.map((p, idx) => {
      if (!p || typeof p !== 'object') {
        throw new Error(`Invalid protocol at index ${idx}`);
      }
      rejectUnknownKeys(p as Record<string, unknown>, ALLOWED_PROTOCOL_KEYS, `protocol[${idx}]`);
      if (typeof p.requiredProtocol !== 'string' || !p.requiredProtocol.trim()) {
        throw new Error(`Protocol at index ${idx} requires a non-empty requiredProtocol`);
      }
      return {
        requiredProtocol: p.requiredProtocol.trim(),
      };
    });
  }

  if (obj.power !== undefined) {
    if (!obj.power || typeof obj.power !== 'object') {
      throw new Error('Conditions power must be an object');
    }
    const p = obj.power as Record<string, unknown>;
    rejectUnknownKeys(p, ALLOWED_POWER_KEYS, 'power conditions');

    if (p.minPowerWatt !== undefined) {
      if (typeof p.minPowerWatt !== 'number' || p.minPowerWatt <= 0 || !Number.isFinite(p.minPowerWatt)) {
        throw new Error('Power minPowerWatt must be a positive number');
      }
    }

    if (p.maxPowerWatt !== undefined) {
      if (typeof p.maxPowerWatt !== 'number' || p.maxPowerWatt <= 0 || !Number.isFinite(p.maxPowerWatt)) {
        throw new Error('Power maxPowerWatt must be a positive number');
      }
    }

    result.power = {
      minPowerWatt: p.minPowerWatt as number | undefined,
      maxPowerWatt: p.maxPowerWatt as number | undefined,
      strictPowerMatch: p.strictPowerMatch !== undefined ? Boolean(p.strictPowerMatch) : undefined,
    };
  }

  if (obj.os !== undefined) {
    if (!obj.os || typeof obj.os !== 'object') {
      throw new Error('Conditions os must be an object');
    }
    const o = obj.os as Record<string, unknown>;
    rejectUnknownKeys(o, ALLOWED_OS_KEYS, 'os conditions');

    if (o.requiredOs !== undefined) {
      if (!Array.isArray(o.requiredOs)) {
        throw new Error('os.requiredOs must be an array of strings');
      }
      result.os = {
        requiredOs: o.requiredOs.map((s) => String(s).trim()),
      };
    }
  }

  if (obj.customPredicates !== undefined) {
    if (!Array.isArray(obj.customPredicates)) {
      throw new Error('Conditions customPredicates must be an array');
    }
    result.customPredicates = obj.customPredicates.map((cp, idx) => {
      if (!cp || typeof cp !== 'object') {
        throw new Error(`Invalid customPredicate at index ${idx}`);
      }
      rejectUnknownKeys(cp as Record<string, unknown>, ALLOWED_CUSTOM_PREDICATE_KEYS, `customPredicate[${idx}]`);
      const op = String(cp.operator).toUpperCase();
      if (!ALLOWED_OPERATORS.has(op)) {
        throw new Error(`Invalid operator in customPredicate[${idx}]: "${cp.operator}"`);
      }
      return {
        key: String(cp.key),
        operator: op as any,
        deviceValueKey: cp.deviceValueKey ? String(cp.deviceValueKey) : undefined,
        accessoryValueKey: cp.accessoryValueKey ? String(cp.accessoryValueKey) : undefined,
        expectedValue: cp.expectedValue,
        mandatory: cp.mandatory !== undefined ? Boolean(cp.mandatory) : true,
      };
    });
  }

  // Ensure conditions define at least one predicate
  const hasPredicates = Boolean(
    (result.connectors && result.connectors.length > 0) ||
    (result.protocols && result.protocols.length > 0) ||
    result.power ||
    (result.os && result.os.requiredOs && result.os.requiredOs.length > 0) ||
    (result.customPredicates && result.customPredicates.length > 0)
  );

  if (!hasPredicates) {
    throw new Error('Compatibility conditions must define at least one predicate');
  }

  return result;
}

/**
 * Validates a full CompatibilityRule definition against strict DSL.
 */
export function validateCompatibilityRule(input: unknown): CompatibilityRuleDefinition {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Compatibility rule must be a non-null object');
  }

  const obj = input as Record<string, unknown>;
  rejectUnknownKeys(obj, ALLOWED_RULE_KEYS, 'compatibility rule');

  if (obj.schemaVersion === undefined || typeof obj.schemaVersion !== 'number' || obj.schemaVersion <= 0) {
    throw new Error('Compatibility rule requires a positive integer schemaVersion');
  }

  if (typeof obj.ruleCode !== 'string' || !obj.ruleCode.trim()) {
    throw new Error('Compatibility rule requires a non-empty ruleCode');
  }

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new Error('Compatibility rule requires a non-empty name');
  }

  const direction = (obj.direction as CompatibilityDirection) || 'HOST_TO_ACCESSORY';
  if (!ALLOWED_DIRECTIONS.has(direction)) {
    throw new Error(`Invalid direction: "${direction}"`);
  }

  const status = (obj.status as CompatibilityRuleStatus) || 'DRAFT';
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(`Invalid status: "${status}"`);
  }

  const conditions = validateCompatibilityConditions(obj.conditions);

  let warnings: string[] | undefined = undefined;
  if (obj.warnings !== undefined) {
    if (!Array.isArray(obj.warnings)) {
      throw new Error('Rule warnings must be an array of strings');
    }
    warnings = obj.warnings.map((w) => String(w).trim());
  }

  let categoryScope: { sourceCategories?: string[]; targetCategories?: string[] } | null = null;
  if (obj.categoryScope !== undefined && obj.categoryScope !== null) {
    if (typeof obj.categoryScope !== 'object' || Array.isArray(obj.categoryScope)) {
      throw new Error('categoryScope must be an object');
    }
    const cs = obj.categoryScope as Record<string, unknown>;
    const sourceCategories = Array.isArray(cs.sourceCategories)
      ? cs.sourceCategories.map((c) => String(c).trim().toLowerCase())
      : undefined;
    const targetCategories = Array.isArray(cs.targetCategories)
      ? cs.targetCategories.map((c) => String(c).trim().toLowerCase())
      : undefined;
    categoryScope = { sourceCategories, targetCategories };
  }

  return {
    id: typeof obj.id === 'string' ? obj.id : `rule_${Date.now()}`,
    ruleCode: obj.ruleCode.trim(),
    name: obj.name.trim(),
    description: typeof obj.description === 'string' ? obj.description.trim() : null,
    direction,
    sourceCategoryId: typeof obj.sourceCategoryId === 'string' ? obj.sourceCategoryId : null,
    targetCategoryId: typeof obj.targetCategoryId === 'string' ? obj.targetCategoryId : null,
    categoryScope,
    conditions,
    warnings: warnings || null,
    market: typeof obj.market === 'string' ? obj.market.trim() : 'VN',
    version: typeof obj.version === 'number' ? obj.version : 1,
    status,
    sourceId: typeof obj.sourceId === 'string' ? obj.sourceId : null,
    createdById: typeof obj.createdById === 'string' ? obj.createdById : null,
    approvedById: typeof obj.approvedById === 'string' ? obj.approvedById : null,
    approvedAt: obj.approvedAt ? (obj.approvedAt as any) : null,
    rejectionReason: typeof obj.rejectionReason === 'string' ? obj.rejectionReason : null,
    revokedAt: obj.revokedAt ? (obj.revokedAt as any) : null,
    revocationReason: typeof obj.revocationReason === 'string' ? obj.revocationReason : null,
    createdAt: obj.createdAt ? (obj.createdAt as any) : new Date().toISOString(),
    updatedAt: obj.updatedAt ? (obj.updatedAt as any) : new Date().toISOString(),
  };
}
