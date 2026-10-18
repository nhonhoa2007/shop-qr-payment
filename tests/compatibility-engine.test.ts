import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCompatibility,
  extractDeviceSpecProfile,
} from '../src/server/modules/compatibility/compatibility.engine.ts';
import {
  validateCompatibilityRule,
  validateCompatibilityConditions,
} from '../src/shared/validations/compatibility-rule.ts';
import type {
  CompatibilityEngineInput,
  CompatibilityRuleDefinition,
  CompatibilityTargetSpecs,
} from '../src/shared/types/compatibility.ts';

describe('Compatibility Rule Validation DSL', () => {
  it('validates a complete, canonical compatibility rule', () => {
    const validRule = {
      schemaVersion: 1,
      ruleCode: 'RULE-USBC-PD-CHARGER',
      name: 'USB-C Power Delivery Charger Compatibility',
      description: 'Standard rule for laptops charging via USB-C PD',
      direction: 'HOST_TO_ACCESSORY' as const,
      categoryScope: {
        sourceCategories: ['laptops', 'phones'],
        targetCategories: ['chargers', 'power-banks'],
      },
      market: 'VN',
      conditions: {
        schemaVersion: 1,
        connectors: [
          { requiredConnector: 'USB-C', accessoryConnector: 'USB-C' },
        ],
        protocols: [
          { requiredProtocol: 'PD_3_0' },
        ],
        power: {
          minPowerWatt: 45,
          strictPowerMatch: true,
        },
      },
      warnings: ['Charging speed may be limited if using low-amperage cable'],
      version: 1,
      status: 'ACTIVE' as const,
    };

    const validated = validateCompatibilityRule(validRule);
    assert.equal(validated.ruleCode, 'RULE-USBC-PD-CHARGER');
    assert.equal(validated.status, 'ACTIVE');
    assert.equal(validated.conditions.power?.minPowerWatt, 45);
  });

  it('rejects malformed rules missing schemaVersion or ruleCode', () => {
    assert.throws(
      () => validateCompatibilityRule({ name: 'Invalid rule' }),
      /schemaVersion/i
    );

    assert.throws(
      () => validateCompatibilityRule({ schemaVersion: 1, name: 'Missing code' }),
      /ruleCode/i
    );
  });

  it('rejects rules with negative power wattages or unknown keys', () => {
    assert.throws(
      () =>
        validateCompatibilityConditions({
          schemaVersion: 1,
          power: { minPowerWatt: -65 },
        }),
      /minPowerWatt.*positive|negative/i
    );

    assert.throws(
      () =>
        validateCompatibilityRule({
          schemaVersion: 1,
          ruleCode: 'RULE-TEST',
          name: 'Test',
          direction: 'HOST_TO_ACCESSORY',
          conditions: { schemaVersion: 1 },
          unknownField: 'illegal',
        }),
      /unknown key/i
    );
  });
});

describe('Compatibility Engine - Pure Deterministic Evaluation', () => {
  const baseActiveRule: CompatibilityRuleDefinition = {
    id: 'rule_usbc_pd_laptop',
    ruleCode: 'RULE-USBC-PD-LAPTOP',
    name: 'USB-C PD Laptop Charging',
    direction: 'HOST_TO_ACCESSORY',
    categoryScope: {
      sourceCategories: ['laptop'],
      targetCategories: ['charger'],
    },
    market: 'VN',
    conditions: {
      schemaVersion: 1,
      connectors: [{ requiredConnector: 'USB-C', accessoryConnector: 'USB-C' }],
      protocols: [{ requiredProtocol: 'PD_3_0' }],
      power: { strictPowerMatch: true },
    },
    warnings: ['Sạc chậm hơn sạc zin công suất cao'],
    version: 1,
    status: 'ACTIVE',
  };

  it('returns UNKNOWN when only USB-C is specified without protocol or wattage evidence', () => {
    const laptop: CompatibilityTargetSpecs = {
      productId: 'prod_macbook_air',
      productName: 'MacBook Air M2',
      categorySlug: 'laptop',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          charging_port: { state: 'KNOWN', value: 'USB-C' },
          // protocols and required wattage are missing/unknown
        },
      },
    };

    const charger: CompatibilityTargetSpecs = {
      productId: 'prod_generic_charger',
      productName: 'Generic USB-C Charger',
      categorySlug: 'charger',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          connector_type: { state: 'KNOWN', value: 'USB-C' },
          // output power is unknown
        },
      },
    };

    const result = evaluateCompatibility({
      device: laptop,
      accessory: charger,
      rules: [baseActiveRule],
    });

    assert.equal(result.status, 'UNKNOWN');
    assert.ok(
      result.reasons.some((r) => r.toLowerCase().includes('protocol') || r.toLowerCase().includes('power')),
      `Expected reason mentioning missing protocol or power, got: ${result.reasons.join('; ')}`
    );
  });

  it('returns INCOMPATIBLE when charger supplies 65W but laptop requires 100W PD', () => {
    const laptop: CompatibilityTargetSpecs = {
      productId: 'prod_macbook_pro_16',
      productName: 'MacBook Pro 16 M3 Max',
      categorySlug: 'laptop',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          charging_port: { state: 'KNOWN', value: 'USB-C' },
          fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
          charging_power_watt: { state: 'KNOWN', value: 100, unit: 'W' },
        },
      },
    };

    const charger: CompatibilityTargetSpecs = {
      productId: 'prod_charger_65w',
      productName: 'Anker 65W GaN Charger',
      categorySlug: 'charger',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          connector_type: { state: 'KNOWN', value: 'USB-C' },
          fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
          charging_power_watt: { state: 'KNOWN', value: 65, unit: 'W' },
        },
      },
    };

    const result = evaluateCompatibility({
      device: laptop,
      accessory: charger,
      rules: [baseActiveRule],
    });

    assert.equal(result.status, 'INCOMPATIBLE');
    assert.ok(
      result.reasons.some((r) => r.includes('65') && r.includes('100')),
      `Expected reasons to mention 65W vs 100W mismatch, got: ${result.reasons.join('; ')}`
    );
  });

  it('returns COMPATIBLE when all required connector, protocol, and power conditions are met', () => {
    const laptop: CompatibilityTargetSpecs = {
      productId: 'prod_thinkpad_x1',
      productName: 'ThinkPad X1 Carbon Gen 11',
      categorySlug: 'laptop',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          charging_port: { state: 'KNOWN', value: 'USB-C' },
          fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
          charging_power_watt: { state: 'KNOWN', value: 65, unit: 'W' },
        },
      },
    };

    const charger: CompatibilityTargetSpecs = {
      productId: 'prod_ugreen_100w',
      productName: 'UGREEN Nexode 100W GaN Charger',
      categorySlug: 'charger',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          connector_type: { state: 'KNOWN', value: 'USB-C' },
          fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
          charging_power_watt: { state: 'KNOWN', value: 100, unit: 'W' },
        },
      },
    };

    const result = evaluateCompatibility({
      device: laptop,
      accessory: charger,
      rules: [baseActiveRule],
    });

    assert.equal(result.status, 'COMPATIBLE');
    assert.equal(result.matchedRuleCode, 'RULE-USBC-PD-LAPTOP');
    assert.ok(result.warnings.length >= 1, 'Expected warnings from rule');
  });

  it('returns UNKNOWN when OS or required protocol support is missing or unverified', () => {
    const stylusRule: CompatibilityRuleDefinition = {
      id: 'rule_apple_pencil',
      ruleCode: 'RULE-STYLUS-IPAD',
      name: 'Stylus to Tablet OS & Protocol Compatibility',
      direction: 'HOST_TO_ACCESSORY',
      categoryScope: {
        sourceCategories: ['tablet'],
        targetCategories: ['stylus'],
      },
      market: 'VN',
      conditions: {
        schemaVersion: 1,
        connectors: [{ requiredConnector: 'BLUETOOTH' }],
        protocols: [{ requiredProtocol: 'APPLE_PENCIL_PROTOCOL' }],
        os: { requiredOs: ['IPADOS'] },
      },
      version: 1,
      status: 'ACTIVE',
    };

    const tablet: CompatibilityTargetSpecs = {
      productId: 'prod_ipad_pro',
      productName: 'iPad Pro 11 M4',
      categorySlug: 'tablet',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          connector: { state: 'KNOWN', value: 'BLUETOOTH' },
          os: { state: 'KNOWN', value: 'IPADOS' },
          // apple pencil protocol is UNKNOWN/missing
          stylus_protocol: { state: 'UNKNOWN' },
        },
      },
    };

    const stylus: CompatibilityTargetSpecs = {
      productId: 'prod_apple_pencil_pro',
      productName: 'Apple Pencil Pro',
      categorySlug: 'stylus',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          connector: { state: 'KNOWN', value: 'BLUETOOTH' },
          supported_os: { state: 'KNOWN', value: 'IPADOS' },
          stylus_protocol: { state: 'KNOWN', value: 'APPLE_PENCIL_PROTOCOL' },
        },
      },
    };

    const result = evaluateCompatibility({
      device: tablet,
      accessory: stylus,
      rules: [stylusRule],
    });

    assert.equal(result.status, 'UNKNOWN');
    assert.ok(
      result.reasons.some((r) => r.toLowerCase().includes('protocol') || r.toLowerCase().includes('unknown')),
      `Expected unknown protocol reason, got: ${result.reasons.join('; ')}`
    );
  });

  it('ignores rules with wrong direction, wrong market, or REVOKED status', () => {
    const revokedRule: CompatibilityRuleDefinition = {
      ...baseActiveRule,
      id: 'rule_revoked',
      status: 'REVOKED',
    };

    const usMarketRule: CompatibilityRuleDefinition = {
      ...baseActiveRule,
      id: 'rule_us_market',
      market: 'US',
    };

    const wrongDirectionRule: CompatibilityRuleDefinition = {
      ...baseActiveRule,
      id: 'rule_wrong_dir',
      direction: 'ACCESSORY_TO_HOST',
    };

    const laptop: CompatibilityTargetSpecs = {
      productId: 'prod_laptop',
      productName: 'Test Laptop',
      categorySlug: 'laptop',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          charging_port: { state: 'KNOWN', value: 'USB-C' },
          fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
          charging_power_watt: { state: 'KNOWN', value: 65, unit: 'W' },
        },
      },
    };

    const charger: CompatibilityTargetSpecs = {
      productId: 'prod_charger',
      productName: 'Test Charger',
      categorySlug: 'charger',
      market: 'VN',
      specs: {
        schemaVersion: 1,
        values: {
          connector_type: { state: 'KNOWN', value: 'USB-C' },
          fast_charging_protocols: { state: 'KNOWN', value: 'PD_3_0' },
          charging_power_watt: { state: 'KNOWN', value: 100, unit: 'W' },
        },
      },
    };

    // Evaluated only against revoked, wrong market, or wrong direction rules
    const result = evaluateCompatibility({
      device: laptop,
      accessory: charger,
      rules: [revokedRule, usMarketRule, wrongDirectionRule],
    });

    assert.equal(result.status, 'UNKNOWN');
    assert.ok(
      result.reasons.some((r) => r.toLowerCase().includes('no active') || r.toLowerCase().includes('applicable')),
      `Expected reason stating no applicable rule, got: ${result.reasons.join('; ')}`
    );
  });
});
