/**
 * Deterministic Compatibility Engine (Application Layer)
 * Evaluates host device & accessory pairings against versioned CompatibilityRules.
 * Strictly deterministic: COMPATIBLE requires complete active evidence;
 * explicit mismatches yield INCOMPATIBLE; missing/unverified attributes yield UNKNOWN.
 */

import type {
  CompatibilityCheckDto,
  CompatibilityEngineInput,
  CompatibilityRuleDefinition,
  CompatibilityStatus,
  CompatibilityTargetSpecs,
} from '../../../shared/types/compatibility.ts';

interface SpecProfileValue {
  state: 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED';
  value?: unknown;
  unit?: string | null;
}

export type NormalizedSpecProfile = Record<string, SpecProfileValue>;

/**
 * Extracts and normalizes specs from ProductSpecs JSON and variant specOverrides.
 */
export function extractDeviceSpecProfile(
  specs: unknown,
  specOverrides?: unknown
): NormalizedSpecProfile {
  const profile: NormalizedSpecProfile = {};

  const parseBag = (bag: unknown) => {
    if (!bag || typeof bag !== 'object') return;
    const raw = bag as Record<string, unknown>;

    // Handle M1 ProductSpecs format: { schemaVersion, values: { [code]: SpecValue } }
    if (raw.values && typeof raw.values === 'object') {
      const vals = raw.values as Record<string, unknown>;
      for (const [key, v] of Object.entries(vals)) {
        if (v && typeof v === 'object' && 'state' in v) {
          const specVal = v as { state: 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED'; value?: unknown; unit?: string | null };
          profile[key.toLowerCase()] = {
            state: specVal.state,
            value: specVal.value,
            unit: specVal.unit || null,
          };
        } else {
          profile[key.toLowerCase()] = {
            state: 'KNOWN',
            value: v,
          };
        }
      }
    } else {
      // Flat key-value map
      for (const [key, v] of Object.entries(raw)) {
        if (v && typeof v === 'object' && 'state' in v) {
          const specVal = v as { state: 'KNOWN' | 'UNKNOWN' | 'UNSUPPORTED'; value?: unknown; unit?: string | null };
          profile[key.toLowerCase()] = {
            state: specVal.state,
            value: specVal.value,
            unit: specVal.unit || null,
          };
        } else {
          profile[key.toLowerCase()] = {
            state: 'KNOWN',
            value: v,
          };
        }
      }
    }
  };

  parseBag(specs);
  if (specOverrides) {
    parseBag(specOverrides);
  }

  return profile;
}

function resolveSpecValue(
  profile: NormalizedSpecProfile,
  keys: string[]
): SpecProfileValue {
  for (const k of keys) {
    const found = profile[k.toLowerCase()];
    if (found) return found;
  }
  return { state: 'UNKNOWN' };
}

function normalizeArrayValue(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).toUpperCase().trim());
  if (typeof raw === 'string') {
    return raw
      .split(/[,;|]/)
      .map((s) => s.toUpperCase().trim())
      .filter(Boolean);
  }
  return [String(raw).toUpperCase().trim()];
}

function normalizeNumericWattage(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  }
  return null;
}

/**
 * Checks if a rule is applicable to the given device and accessory.
 */
function isRuleApplicable(
  rule: CompatibilityRuleDefinition,
  device: CompatibilityTargetSpecs,
  accessory: CompatibilityTargetSpecs
): boolean {
  if (rule.status !== 'ACTIVE') return false;

  // Market check: If rule defines market, it must match
  if (rule.market) {
    const targetMarket = device.market || accessory.market || 'VN';
    if (rule.market.toUpperCase() !== targetMarket.toUpperCase()) {
      return false;
    }
  }

  const devCatId = device.categoryId?.toLowerCase();
  const devCatSlug = device.categorySlug?.toLowerCase();
  const accCatId = accessory.categoryId?.toLowerCase();
  const accCatSlug = accessory.categorySlug?.toLowerCase();

  const sourceScope = [
    rule.sourceCategoryId?.toLowerCase(),
    ...(rule.categoryScope?.sourceCategories || []).map((c) => c.toLowerCase()),
  ].filter(Boolean) as string[];

  const targetScope = [
    rule.targetCategoryId?.toLowerCase(),
    ...(rule.categoryScope?.targetCategories || []).map((c) => c.toLowerCase()),
  ].filter(Boolean) as string[];

  const matchesScope = (scope: string[], id?: string, slug?: string) => {
    if (scope.length === 0) return true;
    return scope.some((sc) => sc === id || sc === slug);
  };

  if (rule.direction === 'HOST_TO_ACCESSORY') {
    const sourceMatches = matchesScope(sourceScope, devCatId, devCatSlug);
    const targetMatches = matchesScope(targetScope, accCatId, accCatSlug);
    return sourceMatches && targetMatches;
  }

  if (rule.direction === 'ACCESSORY_TO_HOST') {
    const sourceMatches = matchesScope(sourceScope, accCatId, accCatSlug);
    const targetMatches = matchesScope(targetScope, devCatId, devCatSlug);
    return sourceMatches && targetMatches;
  }

  if (rule.direction === 'BIDIRECTIONAL') {
    const forward = matchesScope(sourceScope, devCatId, devCatSlug) && matchesScope(targetScope, accCatId, accCatSlug);
    const backward = matchesScope(sourceScope, accCatId, accCatSlug) && matchesScope(targetScope, devCatId, devCatSlug);
    return forward || backward;
  }

  return false;
}

/**
 * Pure deterministic evaluation of a device + accessory pairing against rules.
 */
export function evaluateCompatibility(input: CompatibilityEngineInput): CompatibilityCheckDto {
  const { device, accessory, rules } = input;
  const evaluatedAt = new Date().toISOString();

  const defaultDto: CompatibilityCheckDto = {
    status: 'UNKNOWN',
    device: {
      productId: device.productId,
      variantId: device.variantId || null,
      productName: device.productName,
      variantName: device.variantName || null,
      categoryId: device.categoryId || null,
      categorySlug: device.categorySlug || null,
    },
    accessory: {
      productId: accessory.productId,
      variantId: accessory.variantId || null,
      productName: accessory.productName,
      variantName: accessory.variantName || null,
      categoryId: accessory.categoryId || null,
      categorySlug: accessory.categorySlug || null,
      price: accessory.price !== undefined ? (typeof accessory.price === 'bigint' ? accessory.price.toString() : accessory.price) : null,
      image: accessory.image || null,
    },
    reasons: [],
    warnings: [],
    matchedRuleId: null,
    matchedRuleCode: null,
    evaluatedAt,
    cacheHit: false,
  };

  // 1. Filter applicable active rules
  const applicableRules = rules.filter((r) => isRuleApplicable(r, device, accessory));

  if (applicableRules.length === 0) {
    return {
      ...defaultDto,
      status: 'UNKNOWN',
      reasons: ['No active compatibility rule found for this device and accessory category pair.'],
    };
  }

  const devSpecs = extractDeviceSpecProfile(device.specs, device.specOverrides);
  const accSpecs = extractDeviceSpecProfile(accessory.specs, accessory.specOverrides);

  // We evaluate against the most specific active rule (or iterate until a definitive match / mismatch)
  for (const rule of applicableRules) {
    const reasons: string[] = [];
    const warnings: string[] = [...(rule.warnings || [])];
    let isIncompatible = false;
    let isUnknown = false;

    const { conditions } = rule;

    // 2. Connector Check
    if (conditions.connectors && conditions.connectors.length > 0) {
      for (const req of conditions.connectors) {
        const devConnector = resolveSpecValue(devSpecs, [
          'charging_port',
          'connector_type',
          'connector',
          'port',
          'port_type',
        ]);
        const accConnector = resolveSpecValue(accSpecs, [
          'connector_type',
          'connector',
          'charging_port',
          'port',
          'interface',
        ]);

        if (devConnector.state !== 'KNOWN' || accConnector.state !== 'KNOWN') {
          isUnknown = true;
          reasons.push(
            `Connector specification is missing or unverified (Device connector: ${devConnector.state}, Accessory connector: ${accConnector.state}).`
          );
        } else {
          const devConnList = normalizeArrayValue(devConnector.value);
          const accConnList = normalizeArrayValue(accConnector.value);

          const expectedConn = req.requiredConnector.toUpperCase();
          const targetConn = (req.accessoryConnector || req.requiredConnector).toUpperCase();

          const devHasConn = devConnList.includes(expectedConn);
          const accHasConn = accConnList.includes(targetConn);

          if (!devHasConn || !accHasConn) {
            isIncompatible = true;
            reasons.push(
              `Connector mismatch: Device uses ${devConnList.join(', ') || 'N/A'}, Accessory provides ${accConnList.join(', ') || 'N/A'}.`
            );
          }
        }
      }
    }

    // 3. Fast Charging / Communication Protocols Check
    if (conditions.protocols && conditions.protocols.length > 0) {
      for (const protoReq of conditions.protocols) {
        const expectedProto = protoReq.requiredProtocol.toUpperCase();

        const devProto = resolveSpecValue(devSpecs, [
          'fast_charging_protocols',
          'protocols',
          'charging_protocol',
          'stylus_protocol',
          'wireless_protocol',
          'protocol',
        ]);
        const accProto = resolveSpecValue(accSpecs, [
          'fast_charging_protocols',
          'protocols',
          'charging_protocol',
          'stylus_protocol',
          'wireless_protocol',
          'protocol',
        ]);

        if (devProto.state !== 'KNOWN' || accProto.state !== 'KNOWN') {
          isUnknown = true;
          reasons.push(
            `Protocol specification is missing or unverified for required protocol ${expectedProto}.`
          );
        } else {
          const devProtoList = normalizeArrayValue(devProto.value);
          const accProtoList = normalizeArrayValue(accProto.value);

          const devSupports = devProtoList.includes(expectedProto);
          const accSupports = accProtoList.includes(expectedProto);

          if (!devSupports || !accSupports) {
            isIncompatible = true;
            reasons.push(
              `Protocol mismatch: Required ${expectedProto} is not mutually supported (Device: [${devProtoList.join(', ')}], Accessory: [${accProtoList.join(', ')}]).`
            );
          }
        }
      }
    }

    // 4. Power Delivery / Wattage Check
    if (conditions.power) {
      const devWattSpec = resolveSpecValue(devSpecs, [
        'charging_power_watt',
        'power_required_watt',
        'required_power_watt',
        'power_watt',
        'wattage',
      ]);
      const accWattSpec = resolveSpecValue(accSpecs, [
        'charging_power_watt',
        'power_output_watt',
        'output_power_watt',
        'power_watt',
        'max_power_watt',
        'wattage',
      ]);

      if (devWattSpec.state !== 'KNOWN' || accWattSpec.state !== 'KNOWN') {
        isUnknown = true;
        reasons.push('Power delivery wattage evidence is missing or unverified.');
      } else {
        const devWatts = normalizeNumericWattage(devWattSpec.value);
        const accWatts = normalizeNumericWattage(accWattSpec.value);

        if (devWatts === null || accWatts === null) {
          isUnknown = true;
          reasons.push('Power delivery wattage value could not be determined numerically.');
        } else {
          const requiredMin = conditions.power.minPowerWatt || devWatts;

          if (accWatts < requiredMin) {
            if (conditions.power.strictPowerMatch) {
              isIncompatible = true;
              reasons.push(
                `Power mismatch: Device requires ${requiredMin}W but accessory provides ${accWatts}W.`
              );
            } else {
              warnings.push(
                `Accessory provides ${accWatts}W which is less than recommended ${requiredMin}W (charging speed may be slower).`
              );
            }
          }
        }
      }
    }

    // 5. Operating System Support Check
    if (conditions.os && conditions.os.requiredOs && conditions.os.requiredOs.length > 0) {
      const devOsSpec = resolveSpecValue(devSpecs, ['os', 'operating_system', 'platform']);
      const accOsSpec = resolveSpecValue(accSpecs, ['supported_os', 'compatible_os', 'os_support', 'os']);

      if (devOsSpec.state !== 'KNOWN' || accOsSpec.state !== 'KNOWN') {
        isUnknown = true;
        reasons.push('Operating system compatibility evidence is unverified.');
      } else {
        const devOsList = normalizeArrayValue(devOsSpec.value);
        const accSupportedOs = normalizeArrayValue(accOsSpec.value);

        const hasOsOverlap = devOsList.some((os) =>
          accSupportedOs.includes(os) || conditions.os?.requiredOs?.map((s) => s.toUpperCase()).includes(os)
        );

        if (!hasOsOverlap) {
          isIncompatible = true;
          reasons.push(
            `OS mismatch: Device OS [${devOsList.join(', ')}] is not supported by accessory [${accSupportedOs.join(', ')}].`
          );
        }
      }
    }

    // Determine verdict for this rule
    let status: CompatibilityStatus = 'UNKNOWN';
    if (isIncompatible) {
      status = 'INCOMPATIBLE';
    } else if (isUnknown) {
      status = 'UNKNOWN';
    } else {
      status = 'COMPATIBLE';
      if (reasons.length === 0) {
        reasons.push(`Verified compatible under rule ${rule.name} (${rule.ruleCode}).`);
      }
    }

    return {
      ...defaultDto,
      status,
      reasons,
      warnings,
      matchedRuleId: rule.id,
      matchedRuleCode: rule.ruleCode,
      ruleRevision: rule.version,
    };
  }

  return defaultDto;
}
