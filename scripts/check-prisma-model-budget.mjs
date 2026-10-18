#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARD_CAP = 40;
export const TARGET_CEILING = 37;
export const DEFAULT_EXPECTED_M0 = 22;
export const DEFAULT_EXPECTED_M1 = 25;

export const FORBIDDEN_MODELS = [
  // EAV child tables
  'AttributeDefinition',
  'CategoryAttribute',
  'ProductAttributeValue',
  // Option / image child tables
  'ProductOptionDefinition',
  'ProductOptionValue',
  'ProductImage',
  // Source fragmentation
  'ProductSource',
  'ExternalReviewSource',
  'BenchmarkSource',
  // Raw review decomposition
  'ExternalReview',
  'ReviewAspectSignal',
  // Rubric / citation / usage child tables
  'ScoringRubric',
  'Citation',
  'AssistantUsage',
  // Materialized compatibility pair
  'CompatibilityAssertion',
  // Procurement duplication
  'GoodsReceipt',
  'GoodsReceiptItem',
  // Duplicate stock store
  'InventoryBalance',
  // Serial child identifier
  'SerializedUnitIdentifier',
  // Policy / event / item fragmentation
  'WarrantyPolicy',
  'WarrantyEvent',
  'ReturnItem',
  'ReturnEvent',
  // Duplicate refund ledger
  'RefundOperation',
];

/**
 * Parses model names from Prisma schema content.
 * @param {string} schemaContent
 * @returns {string[]}
 */
export function parsePrismaModels(schemaContent) {
  if (typeof schemaContent !== 'string') return [];
  const lines = schemaContent.split(/\r?\n/);
  const models = [];
  let inBlockComment = false;

  for (const rawLine of lines) {
    let line = rawLine.trim();

    if (inBlockComment) {
      const endComment = line.indexOf('*/');
      if (endComment !== -1) {
        inBlockComment = false;
        line = line.slice(endComment + 2).trim();
      } else {
        continue;
      }
    }

    if (line.startsWith('/*')) {
      const endComment = line.indexOf('*/');
      if (endComment !== -1) {
        line = line.slice(endComment + 2).trim();
      } else {
        inBlockComment = true;
        continue;
      }
    }

    if (line.startsWith('//')) {
      continue;
    }

    const match = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (match) {
      models.push(match[1]);
    }
  }

  return models;
}

/**
 * Parses registered model names from registry markdown content.
 * Scans between <!-- REGISTRY_MODELS_START --> and <!-- REGISTRY_MODELS_END --> if present,
 * or scans table rows / bullet items for backtick-wrapped names.
 * @param {string} registryContent
 * @returns {string[]}
 */
export function parseRegistryModels(registryContent) {
  if (typeof registryContent !== 'string') return [];

  let contentToScan = registryContent;
  const startMarker = '<!-- REGISTRY_MODELS_START -->';
  const endMarker = '<!-- REGISTRY_MODELS_END -->';

  const startIndex = registryContent.indexOf(startMarker);
  const endIndex = registryContent.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    contentToScan = registryContent.slice(startIndex + startMarker.length, endIndex);
  }

  const lines = contentToScan.split(/\r?\n/);
  const models = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check markdown table rows: | 1 | `User` | ACTIVE | ...
    if (line.startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      for (const cell of cells) {
        const match = cell.match(/^`([A-Za-z0-9_]+)`$/);
        if (match) {
          const name = match[1];
          if (!models.includes(name) && name !== 'Model') {
            models.push(name);
          }
        }
      }
      continue;
    }

    // Check markdown list items: - `User`
    const listMatch = line.match(/^[-*]\s+`([A-Za-z0-9_]+)`/);
    if (listMatch) {
      const name = listMatch[1];
      if (!models.includes(name)) {
        models.push(name);
      }
    }
  }

  return models;
}

/**
 * Validates Prisma schema against budget, hard cap, ceiling, forbidden list, and registry.
 * @param {object} options
 * @param {string} [options.schemaContent]
 * @param {string} [options.schemaPath]
 * @param {string} [options.registryContent]
 * @param {string} [options.registryPath]
 * @param {number} [options.expected]
 * @param {boolean} [options.lockRegistry]
 * @param {number} [options.hardCap]
 * @param {number} [options.targetCeiling]
 * @param {string[]} [options.forbiddenModels]
 * @returns {object}
 */
export function checkModelBudget(options = {}) {
  const hardCap = options.hardCap ?? HARD_CAP;
  const targetCeiling = options.targetCeiling ?? TARGET_CEILING;
  const forbiddenList = options.forbiddenModels ?? FORBIDDEN_MODELS;

  let schemaContent = options.schemaContent;
  if (schemaContent === undefined && options.schemaPath) {
    schemaContent = fs.readFileSync(options.schemaPath, 'utf8');
  }

  let registryContent = options.registryContent;
  if (registryContent === undefined && options.registryPath && fs.existsSync(options.registryPath)) {
    registryContent = fs.readFileSync(options.registryPath, 'utf8');
  }

  const models = parsePrismaModels(schemaContent ?? '');
  const registeredModels = registryContent ? parseRegistryModels(registryContent) : [];

  const totalModels = models.length;
  const errors = [];
  const warnings = [];

  // Determine expected count
  let expected = options.expected;
  if (expected === undefined && registeredModels.length > 0) {
    expected = registeredModels.length;
  }

  // 1. Hard cap check (never weaken hard cap 40)
  if (totalModels > hardCap) {
    errors.push(
      `Hard cap exceeded: schema has ${totalModels} models, maximum allowed is ${hardCap}. Merge is blocked.`
    );
  }
  if (options.expected !== undefined && options.expected > hardCap) {
    errors.push(
      `Invalid expected count ${options.expected}: exceeds hard cap of ${hardCap}. Hard cap cannot be weakened.`
    );
  }

  // 2. Target ceiling warning (37 models)
  if (totalModels > targetCeiling && totalModels <= hardCap) {
    warnings.push(
      `Target ceiling warning: schema has ${totalModels} models, which exceeds target ceiling of ${targetCeiling}. Requires approved ADR.`
    );
  }

  // 3. Forbidden models check (case-insensitive)
  const forbiddenMap = new Map(forbiddenList.map((m) => [m.toLowerCase(), m]));
  const forbiddenFound = [];
  for (const model of models) {
    const match = forbiddenMap.get(model.toLowerCase());
    if (match && !forbiddenFound.includes(match)) {
      forbiddenFound.push(match);
    }
  }
  if (forbiddenFound.length > 0) {
    errors.push(
      `Forbidden model(s) detected in schema: ${forbiddenFound.join(', ')}. Compact-schema architecture rules strictly forbid these models.`
    );
  }

  // 4. Expected count check
  if (expected !== undefined && totalModels !== expected) {
    errors.push(
      `Expected count mismatch: expected ${expected} models, but found ${totalModels} in schema.`
    );
  }

  // 5. Registry comparison (added & removed)
  const registeredSet = new Set(registeredModels);
  const modelSet = new Set(models);
  const addedModels = models.filter((m) => !registeredSet.has(m));
  const removedModels = registeredModels.filter((m) => !modelSet.has(m));

  if (options.lockRegistry) {
    if (addedModels.length > 0) {
      errors.push(`Registry locked: detected unregistered added model(s): ${addedModels.join(', ')}.`);
    }
    if (removedModels.length > 0) {
      errors.push(`Registry locked: detected missing registered model(s): ${removedModels.join(', ')}.`);
    }
  }

  return {
    valid: errors.length === 0,
    totalModels,
    models,
    registeredModels,
    addedModels,
    removedModels,
    forbiddenModels: forbiddenFound,
    expectedCount: expected,
    hardCap,
    targetCeiling,
    errors,
    warnings,
  };
}

/**
 * CLI runner.
 * @param {string[]} argv
 */
export function runCli(argv = process.argv.slice(2)) {
  let expected = undefined;
  let lockRegistry = false;
  let schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  let registryPath = path.resolve(process.cwd(), 'docs/architecture/prisma-model-registry.md');

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/check-prisma-model-budget.mjs [options]

Options:
  --expected=<number>     Expected model count (e.g. --expected=22, --expected=25)
  --lock-registry         Enforce zero difference between schema models and registry
  --schema=<path>         Path to schema.prisma (default: prisma/schema.prisma)
  --registry=<path>       Path to registry md (default: docs/architecture/prisma-model-registry.md)
  --help, -h              Show this help message
      `.trim());
      process.exit(0);
    } else if (arg.startsWith('--expected=')) {
      expected = parseInt(arg.slice('--expected='.length), 10);
    } else if (arg === '--expected') {
      expected = parseInt(argv[++i], 10);
    } else if (arg === '--lock-registry') {
      lockRegistry = true;
    } else if (arg.startsWith('--schema=')) {
      schemaPath = path.resolve(process.cwd(), arg.slice('--schema='.length));
    } else if (arg.startsWith('--registry=')) {
      registryPath = path.resolve(process.cwd(), arg.slice('--registry='.length));
    }
  }

  const result = checkModelBudget({
    schemaPath,
    registryPath,
    expected,
    lockRegistry,
  });

  console.log('====================================================');
  console.log('            Prisma Model Budget Check');
  console.log('====================================================');
  console.log(`Total Models in Schema : ${result.totalModels}`);
  console.log(`Hard Cap (Max Allowed) : ${result.hardCap}`);
  console.log(`Target Ceiling         : ${result.targetCeiling}`);
  console.log(`Expected Count         : ${result.expectedCount ?? 'not specified'}`);
  console.log(`Registered Models      : ${result.registeredModels.length}`);
  console.log(`Added vs Registry      : ${result.addedModels.length > 0 ? result.addedModels.join(', ') : 'none'}`);
  console.log(`Missing vs Registry    : ${result.removedModels.length > 0 ? result.removedModels.join(', ') : 'none'}`);
  console.log(`Forbidden Models Found : ${result.forbiddenModels.length > 0 ? result.forbiddenModels.join(', ') : 'none'}`);
  console.log('----------------------------------------------------');

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`[WARN] ${w}`);
    }
  }

  if (!result.valid) {
    console.error('\n[STATUS: FAIL]');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    console.log('====================================================\n');
    process.exit(1);
  }

  console.log('\n[STATUS: PASS] Schema model budget verified successfully.');
  console.log('====================================================\n');
  process.exit(0);
}

// Auto-run when executed directly via CLI
if (process.argv[1]) {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    if (path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
      runCli();
    }
  } catch {
    // ignore if imported
  }
}
