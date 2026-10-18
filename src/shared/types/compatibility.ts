// ==========================================
// COMPATIBILITY ENGINE TYPES (M4)
// ==========================================

export type CompatibilityStatus = 'COMPATIBLE' | 'INCOMPATIBLE' | 'UNKNOWN';

export type CompatibilityDirection = 'HOST_TO_ACCESSORY' | 'ACCESSORY_TO_HOST' | 'BIDIRECTIONAL';

export type CompatibilityRuleStatus = 'DRAFT' | 'ACTIVE' | 'REVOKED' | 'ARCHIVED';

export interface ConnectorRequirement {
  requiredConnector: string;
  accessoryConnector?: string;
}

export interface ProtocolRequirement {
  requiredProtocol: string;
}

export interface PowerRequirement {
  minPowerWatt?: number;
  maxPowerWatt?: number;
  strictPowerMatch?: boolean;
}

export interface OsRequirement {
  requiredOs?: string[];
}

export interface CustomPredicate {
  key: string;
  operator: 'EQUALS' | 'CONTAINS' | 'GTE' | 'LTE' | 'IN';
  deviceValueKey?: string;
  accessoryValueKey?: string;
  expectedValue?: unknown;
  mandatory?: boolean;
}

export interface CompatibilityRuleConditions {
  schemaVersion: number;
  connectors?: ConnectorRequirement[];
  protocols?: ProtocolRequirement[];
  power?: PowerRequirement;
  os?: OsRequirement;
  customPredicates?: CustomPredicate[];
}

export interface CompatibilityCategoryScope {
  sourceCategories?: string[];
  targetCategories?: string[];
}

export interface CompatibilityRuleDefinition {
  id: string;
  ruleCode: string;
  name: string;
  description?: string | null;
  direction: CompatibilityDirection;
  sourceCategoryId?: string | null;
  targetCategoryId?: string | null;
  categoryScope?: CompatibilityCategoryScope | null;
  conditions: CompatibilityRuleConditions;
  warnings?: string[] | null;
  market?: string | null;
  version: number;
  status: CompatibilityRuleStatus;
  sourceId?: string | null;
  createdById?: string | null;
  approvedById?: string | null;
  approvedAt?: Date | string | null;
  rejectionReason?: string | null;
  revokedAt?: Date | string | null;
  revocationReason?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CompatibilityTargetSpecs {
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  market?: string | null;
  price?: number | string | bigint | null;
  image?: string | null;
  catalogVersion?: number | null;
  specs: unknown;
  specOverrides?: unknown;
}

export interface CompatibilityEngineInput {
  device: CompatibilityTargetSpecs;
  accessory: CompatibilityTargetSpecs;
  rules: CompatibilityRuleDefinition[];
}

export interface CompatibilityCheckDto {
  status: CompatibilityStatus;
  device: {
    productId: string;
    variantId?: string | null;
    productName: string;
    variantName?: string | null;
    categoryId?: string | null;
    categorySlug?: string | null;
  };
  accessory: {
    productId: string;
    variantId?: string | null;
    productName: string;
    variantName?: string | null;
    categoryId?: string | null;
    categorySlug?: string | null;
    price?: number | string | bigint | null;
    image?: string | null;
  };
  reasons: string[];
  warnings: string[];
  matchedRuleId?: string | null;
  matchedRuleCode?: string | null;
  evaluatedAt: string;
  ruleRevision?: number | null;
  specRevision?: number | null;
  cacheHit?: boolean;
}

export interface CompatibilityQuery {
  deviceProductId?: string;
  deviceVariantId?: string;
  accessoryProductId?: string;
  accessoryVariantId?: string;
}

export interface DraftCompatibilityRuleInput {
  ruleCode: string;
  name: string;
  description?: string;
  direction: CompatibilityDirection;
  sourceCategoryId?: string;
  targetCategoryId?: string;
  categoryScope?: CompatibilityCategoryScope;
  conditions: CompatibilityRuleConditions;
  warnings?: string[];
  market?: string;
  version?: number;
  sourceId?: string;
}
