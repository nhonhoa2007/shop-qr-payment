import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  parsePrismaModels,
  parseRegistryModels,
  checkModelBudget,
  FORBIDDEN_MODELS,
  HARD_CAP,
  TARGET_CEILING,
} from '../scripts/check-prisma-model-budget.mjs';

const PROJECT_ROOT = process.cwd();
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'prisma/schema.prisma');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'docs/architecture/prisma-model-registry.md');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts/check-prisma-model-budget.mjs');

describe('Prisma Model Budget and Registry Gate', () => {
  describe('parsePrismaModels', () => {
    it('counts every model block and ignores comments and formatting quirks', () => {
      const sampleSchema = `
        datasource db { provider = "postgresql" }
        generator client { provider = "prisma-client-js" }

        // model CommentedOutModel {
        //   id String @id
        // }

        model User {
          id String @id
        }

        model   ProductVariant   {
          id String @id
        }

        /*
          multiline comment
        */
        model Order {
          id String @id
        }
      `;

      const models = parsePrismaModels(sampleSchema);
      assert.deepEqual(models, ['User', 'ProductVariant', 'Order']);
      assert.equal(models.length, 3);
    });

    it('parses exactly 27 models from the active M2 Task 3 schema', () => {
      const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
      const models = parsePrismaModels(schemaContent);
      assert.equal(models.length, 27, `Expected active M2 schema to have 27 models, found ${models.length}`);
      assert.ok(models.includes('User'));
      assert.ok(models.includes('Order'));
      assert.ok(models.includes('ProductVariant'));
      assert.ok(models.includes('WalletTransaction'));
      assert.ok(models.includes('Brand'));
      assert.ok(models.includes('Category'));
      assert.ok(models.includes('DataSource'));
      assert.ok(models.includes('BenchmarkMeasurement'));
      assert.ok(models.includes('ProductScoreSnapshot'));
    });
  });

  describe('parseRegistryModels', () => {
    it('extracts registered model names from registry markdown', () => {
      const sampleRegistry = `
# Prisma Model Registry
<!-- REGISTRY_MODELS_START -->
| # | Model | Status | Milestone |
|---|---|---|---|
| 1 | \`Alpha\` | ACTIVE | M0 |
| 2 | \`Beta\` | ACTIVE | M0 |
<!-- REGISTRY_MODELS_END -->
      `;
      const registered = parseRegistryModels(sampleRegistry);
      assert.deepEqual(registered, ['Alpha', 'Beta']);
    });

    it('extracts exactly 27 registered models from docs/architecture/prisma-model-registry.md', () => {
      assert.ok(fs.existsSync(REGISTRY_PATH), 'Registry file must exist');
      const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf8');
      const registered = parseRegistryModels(registryContent);
      assert.equal(registered.length, 27, `Expected registry to list 27 models, found ${registered.length}`);
      assert.ok(registered.includes('BenchmarkMeasurement'));
      assert.ok(registered.includes('ProductScoreSnapshot'));
    });

    it('parses only the designated Model column and ignores backtick tokens in other columns', () => {
      const sampleRegistryWithOtherBackticks = `
# Prisma Model Registry
<!-- REGISTRY_MODELS_START -->
| # | Model | Status | Milestone | Notes |
|---|---|---|---|---|
| 1 | \`Alpha\` | \`ACTIVE\` | M0 | Replaces \`LegacyAlpha\` |
| 2 | \`Beta\` | \`PENDING\` | M1 | See \`ConfigDoc\` |
<!-- REGISTRY_MODELS_END -->
      `;
      const registered = parseRegistryModels(sampleRegistryWithOtherBackticks);
      assert.deepEqual(registered, ['Alpha', 'Beta']);
    });
  });

  describe('Budget Constraints and Caps', () => {
    it('enforces HARD_CAP = 40 and TARGET_CEILING = 37 constants', () => {
      assert.equal(HARD_CAP, 40, 'HARD_CAP must be 40');
      assert.equal(TARGET_CEILING, 37, 'TARGET_CEILING must be 37');
    });

    it('rejects schema when model count reaches 41 (exceeds hard cap 40)', () => {
      const dummyModels = Array.from({ length: 41 }, (_, i) => `model Dummy${i + 1} {\n  id String @id\n}`).join('\n\n');
      const result = checkModelBudget({
        schemaContent: dummyModels,
        expected: 41, // Even when explicitly requested, hard cap must never be weakened
      });

      assert.equal(result.valid, false);
      assert.ok(
        result.errors.some((err: string) => err.toLowerCase().includes('hard cap') || err.includes('40')),
        `Expected hard cap error, got: ${result.errors.join('; ')}`
      );
    });

    it('warns when model count exceeds target ceiling 37 but is within hard cap 40', () => {
      const dummyModels = Array.from({ length: 38 }, (_, i) => `model Dummy${i + 1} {\n  id String @id\n}`).join('\n\n');
      const result = checkModelBudget({
        schemaContent: dummyModels,
        expected: 38,
      });

      assert.ok(
        result.warnings.some((w: string) => w.toLowerCase().includes('ceiling') || w.includes('37')),
        `Expected ceiling warning, got: ${result.warnings.join('; ')}`
      );
    });
  });

  describe('Forbidden Models Enforcement', () => {
    it('includes all compact-schema forbidden models in FORBIDDEN_MODELS', () => {
      const requiredForbidden = [
        'AttributeDefinition',
        'CategoryAttribute',
        'ProductAttributeValue',
        'ProductOptionDefinition',
        'ProductOptionValue',
        'ProductImage',
        'ProductSource',
        'ExternalReviewSource',
        'BenchmarkSource',
        'ExternalReview',
        'ReviewAspectSignal',
        'ScoringRubric',
        'Citation',
        'AssistantUsage',
        'CompatibilityAssertion',
        'GoodsReceipt',
        'GoodsReceiptItem',
        'InventoryBalance',
        'SerializedUnitIdentifier',
        'WarrantyPolicy',
        'WarrantyEvent',
        'ReturnItem',
        'ReturnEvent',
        'RefundOperation',
      ];

      for (const name of requiredForbidden) {
        assert.ok(
          FORBIDDEN_MODELS.includes(name),
          `FORBIDDEN_MODELS must include "${name}" from compact-schema specification`
        );
      }
    });

    it('rejects forbidden ProductImage model', () => {
      const schemaWithForbidden = `
        model User { id String @id }
        model ProductImage { id String @id }
      `;
      const result = checkModelBudget({
        schemaContent: schemaWithForbidden,
      });

      assert.equal(result.valid, false);
      assert.ok(result.forbiddenModels.includes('ProductImage'));
      assert.ok(
        result.errors.some((err: string) => err.includes('ProductImage')),
        `Expected error mentioning ProductImage, got: ${result.errors.join('; ')}`
      );
    });

    it('rejects any forbidden model even if total count is under budget', () => {
      const schemaWithEav = `
        model User { id String @id }
        model AttributeDefinition { id String @id }
      `;
      const result = checkModelBudget({
        schemaContent: schemaWithEav,
      });

      assert.equal(result.valid, false);
      assert.ok(result.forbiddenModels.includes('AttributeDefinition'));
    });
  });

  describe('Registry Synchronization (Added & Removed Models)', () => {
    it('reports added and removed model names against registry', () => {
      const schema = `
        model User { id String @id }
        model Product { id String @id }
        model Brand { id String @id }
      `;
      const registry = `
<!-- REGISTRY_MODELS_START -->
| # | Model | Status | Milestone |
|---|---|---|---|
| 1 | \`User\` | ACTIVE | M0 |
| 2 | \`Product\` | ACTIVE | M0 |
| 3 | \`OldModel\` | ACTIVE | M0 |
<!-- REGISTRY_MODELS_END -->
      `;

      const result = checkModelBudget({
        schemaContent: schema,
        registryContent: registry,
      });

      assert.deepEqual(result.addedModels, ['Brand']);
      assert.deepEqual(result.removedModels, ['OldModel']);
    });

    it('verifies active schema matches registry with 0 added and 0 removed', () => {
      const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
      const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf8');

      const result = checkModelBudget({
        schemaContent,
        registryContent,
        expected: 27,
        lockRegistry: true,
      });

      assert.equal(result.valid, true, `Check should be valid, errors: ${result.errors.join('; ')}`);
      assert.equal(result.totalModels, 27);
      assert.deepEqual(result.addedModels, []);
      assert.deepEqual(result.removedModels, []);
      assert.deepEqual(result.forbiddenModels, []);
    });
  });

  describe('Configurable Expected Count and CLI execution', () => {
    it('passes for current schema when expected count is 27', () => {
      const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
      const result = checkModelBudget({
        schemaContent,
        expected: 27,
      });
      assert.equal(result.valid, true);
      assert.equal(result.totalModels, 27);
    });

    it('fails for current schema when expected count is 26 (prior M2 Task 1 count)', () => {
      const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
      const result = checkModelBudget({
        schemaContent,
        expected: 26,
      });
      assert.equal(result.valid, false);
      assert.ok(
        result.errors.some((err: string) => err.includes('26') && err.includes('27')),
        `Expected error mentioning expected 26 and found 27, got: ${result.errors.join('; ')}`
      );
    });

    it('executes CLI with --expected=27 and exits cleanly (code 0)', () => {
      const output = execFileSync(process.execPath, [SCRIPT_PATH, '--expected=27'], {
        encoding: 'utf8',
        cwd: PROJECT_ROOT,
      });
      assert.ok(output.includes('27'));
      assert.ok(output.toLowerCase().includes('pass'));
    });

    it('executes zero-argument CLI from a non-root cwd and successfully anchors defaults to project root', () => {
      const nonRootCwd = os.tmpdir();
      const output = execFileSync(process.execPath, [SCRIPT_PATH], {
        encoding: 'utf8',
        cwd: nonRootCwd,
      });
      assert.ok(output.includes('27'));
      assert.ok(output.toLowerCase().includes('pass'));
    });

    it('executes CLI with --expected=22 on M1 schema and exits with non-zero exit code', () => {
      assert.throws(() => {
        execFileSync(process.execPath, [SCRIPT_PATH, '--expected=22'], {
          encoding: 'utf8',
          cwd: PROJECT_ROOT,
          stdio: 'pipe',
        });
      });
    });
  });
});
