import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parsePrismaModels,
  parseRegistryModels,
  checkModelBudget,
  FORBIDDEN_MODELS,
  HARD_CAP,
  TARGET_CEILING,
  CORE_MODELS_18,
  INTELLIGENCE_MODELS_8,
  OPERATIONS_MODELS_8,
  FINAL_34_MODELS,
  FINAL_EXPECTED_MODELS,
} from '../scripts/check-prisma-model-budget.mjs';

const PROJECT_ROOT = process.cwd();
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'prisma/schema.prisma');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'docs/architecture/prisma-model-registry.md');
const ADR_PATH = path.join(PROJECT_ROOT, 'docs/adr/2026-10-17-compact-prisma-model-budget.md');

describe('Final 34-Model Prisma Schema Registry (M7 Release)', () => {
  it('exports exact grouped model arrays totaling 34 models', () => {
    assert.equal(CORE_MODELS_18.length, 18, 'Core models group must have exactly 18 models');
    assert.equal(INTELLIGENCE_MODELS_8.length, 8, 'Intelligence models group must have exactly 8 models');
    assert.equal(OPERATIONS_MODELS_8.length, 8, 'Operations models group must have exactly 8 models');
    assert.equal(FINAL_EXPECTED_MODELS, 34, 'Final expected model count must be 34');
    assert.equal(FINAL_34_MODELS.length, 34, 'Combined final list must have 34 models');
    assert.equal(HARD_CAP, 40, 'Hard cap must remain strictly 40');
    assert.equal(TARGET_CEILING, 37, 'Target ceiling must remain strictly 37');
  });

  it('verifies the 34 M7 models plus the approved SePay request model', () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const parsedModels = parsePrismaModels(schemaContent);

    assert.equal(parsedModels.length, 35, `Expected 35 models in schema, got ${parsedModels.length}`);

    // Verify 18 Core Models
    for (const model of CORE_MODELS_18) {
      assert.ok(parsedModels.includes(model), `Core model ${model} must exist in schema`);
    }

    // Verify 8 Intelligence Models
    for (const model of INTELLIGENCE_MODELS_8) {
      assert.ok(parsedModels.includes(model), `Intelligence model ${model} must exist in schema`);
    }

    // Verify 8 Operations Models
    for (const model of OPERATIONS_MODELS_8) {
      assert.ok(parsedModels.includes(model), `Operations model ${model} must exist in schema`);
    }

    // Exact set equivalence
    const expectedSet = new Set([...CORE_MODELS_18, ...INTELLIGENCE_MODELS_8, ...OPERATIONS_MODELS_8, 'PaymentRequest']);
    assert.equal(expectedSet.size, 35);
    for (const model of parsedModels) {
      assert.ok(expectedSet.has(model), `Model ${model} in schema must belong to the approved 35 models`);
    }
  });

  it('ensures zero forbidden models exist in schema or registry', () => {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const parsedSchema = parsePrismaModels(schemaContent);
    const parsedRegistry = parseRegistryModels(registryContent);

    for (const forbidden of FORBIDDEN_MODELS) {
      assert.ok(
        !parsedSchema.map((m) => m.toLowerCase()).includes(forbidden.toLowerCase()),
        `Forbidden model ${forbidden} must not exist in schema.prisma`
      );
      assert.ok(
        !parsedRegistry.map((m) => m.toLowerCase()).includes(forbidden.toLowerCase()),
        `Forbidden model ${forbidden} must not exist in registry markdown`
      );
    }
  });

  it('fails checkModelBudget when lockRegistry is enabled and any unregistered 36th model is introduced', () => {
    const validContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const mutatedContent = `${validContent}\n\nmodel ExtraUnauthorizedModel {\n  id String @id\n}\n`;

    const result = checkModelBudget({
      schemaContent: mutatedContent,
      lockRegistry: true,
      expected: 35,
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('ExtraUnauthorizedModel') || e.includes('Registry locked')),
      'Must reject extra unregistered model'
    );
  });

  it('verifies docs/architecture/prisma-model-registry.md reflects the SePay 35-model schema', () => {
    const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf8');
    assert.ok(
      registryContent.includes('Active Registry (SePay — 35 Models)'),
      'Registry header must reflect SePay with 35 models'
    );
    const registered = parseRegistryModels(registryContent);
    assert.equal(registered.length, 35, `Expected 35 models in registry, found ${registered.length}`);
    assert.deepEqual(registered.slice().sort(), [...FINAL_34_MODELS, 'PaymentRequest'].sort());
  });

  it('verifies that ADR on compact Prisma model budget exists and details JSON-vs-relational criteria', () => {
    assert.ok(fs.existsSync(ADR_PATH), `ADR file must exist at ${ADR_PATH}`);
    const adrContent = fs.readFileSync(ADR_PATH, 'utf8');
    assert.ok(adrContent.includes('34 models'), 'ADR must mention 34 models');
    assert.ok(adrContent.includes('JSON'), 'ADR must discuss JSON column criteria');
    assert.ok(adrContent.includes('StockAdjustment'), 'ADR must mention retired StockAdjustment');
    assert.ok(adrContent.includes('Transaction'), 'ADR must mention retired Transaction');
  });
});
