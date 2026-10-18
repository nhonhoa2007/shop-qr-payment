import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FINAL_34_MODELS,
  FORBIDDEN_MODELS,
} from '../scripts/check-prisma-model-budget.mjs';

const PROJECT_ROOT = process.cwd();
const UML_GEN_PATH = path.join(PROJECT_ROOT, 'scripts/generate-uml.js');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');

describe('Task 7: Documentation and UML Model Count Consistency', () => {
  it('ensures generate-uml.js models the exact 34 active Prisma models and zero retired models', () => {
    assert.ok(fs.existsSync(UML_GEN_PATH), 'scripts/generate-uml.js must exist');
    const content = fs.readFileSync(UML_GEN_PATH, 'utf8');

    // Retired models must not be in UML class diagram
    const retiredModels = [
      'CouponUsage',
      'StockAdjustment',
      'Transaction',
      'ChatRoomParticipant',
    ];
    for (const retired of retiredModels) {
      assert.ok(
        !content.includes(`class ${retired} `) && !content.includes(`class ${retired}{`),
        `Retired model ${retired} must not be defined as a class in generate-uml.js`
      );
    }

    // Forbidden models must not be in UML class diagram
    for (const forbidden of FORBIDDEN_MODELS) {
      assert.ok(
        !content.includes(`class ${forbidden} `) && !content.includes(`class ${forbidden}{`),
        `Forbidden model ${forbidden} must not be defined as a class in generate-uml.js`
      );
    }

    // All 34 active models must be present in generate-uml.js class diagram
    for (const model of FINAL_34_MODELS) {
      assert.ok(
        content.includes(`class ${model} `) || content.includes(`class ${model}{`),
        `Active model ${model} must be documented in UML class diagram`
      );
    }
  });

  it('ensures README.md states exactly 34 Prisma models and 40–60 product models', () => {
    assert.ok(fs.existsSync(README_PATH), 'README.md must exist');
    const readme = fs.readFileSync(README_PATH, 'utf8');

    assert.ok(
      readme.includes('34 Prisma models') || readme.includes('34 models') || readme.includes('34 database models'),
      'README must mention 34 Prisma models'
    );
    assert.ok(
      readme.includes('40–60') || readme.includes('40-60'),
      'README must mention 40-60 product models'
    );
  });
});
