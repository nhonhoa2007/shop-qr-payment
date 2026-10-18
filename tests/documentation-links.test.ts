import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const README_PATH = path.join(PROJECT_ROOT, 'README.md');
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.example');

describe('Task 7: Documentation Links and Environment Configuration', () => {
  it('ensures .env.example exists and contains necessary keys without exposing real secrets', () => {
    assert.ok(fs.existsSync(ENV_EXAMPLE_PATH), '.env.example must exist');
    const envContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');

    assert.ok(envContent.includes('DATABASE_URL='), 'Must include DATABASE_URL');
    assert.ok(envContent.includes('NEXTAUTH_SECRET='), 'Must include NEXTAUTH_SECRET');
    assert.ok(envContent.includes('PUSHER_APP_ID='), 'Must include PUSHER_APP_ID');

    // Never contain real production private keys or passwords
    assert.equal(envContent.includes('sk_live_'), false);
    assert.equal(envContent.includes('ghp_'), false);
    assert.equal(envContent.includes('secret_key_prod'), false);
  });

  it('ensures referenced script files and directories in README.md exist on disk', () => {
    assert.ok(fs.existsSync(README_PATH), 'README.md must exist');
    const readme = fs.readFileSync(README_PATH, 'utf8');

    const referencedFiles = [
      'scripts/check-prisma-model-budget.mjs',
      'scripts/import-electronics-catalog.ts',
      'scripts/reconcile-inventory.ts',
      'scripts/reconcile-money.ts',
      'scripts/eval-assistant.ts',
      'scripts/eval-commerce-intelligence.ts',
      'scripts/generate-uml.js',
      'prisma/schema.prisma',
      'prisma/data/electronics-catalog.json',
      'docs/architecture/prisma-model-registry.md',
      'docs/adr/2026-10-17-compact-prisma-model-budget.md',
    ];

    for (const relPath of referencedFiles) {
      const fullPath = path.join(PROJECT_ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `Referenced file ${relPath} must exist on disk`);
    }
  });
});
