import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parsePrismaModels,
  checkModelBudget,
} from '../scripts/check-prisma-model-budget.mjs';

const SCHEMA_PATH = path.resolve(process.cwd(), 'prisma/schema.prisma');
const REGISTRY_PATH = path.resolve(process.cwd(), 'docs/architecture/prisma-model-registry.md');

describe('M1 Electronics Catalog Prisma Schema Contracts', () => {
  it('schema exists and can be read', () => {
    assert.ok(fs.existsSync(SCHEMA_PATH), 'prisma/schema.prisma must exist');
  });

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const models = parsePrismaModels(schemaContent);

  it('contains exactly 25 models for M1 milestone', () => {
    assert.equal(
      models.length,
      25,
      `Expected exactly 25 models in M1 schema, found ${models.length}: ${models.join(', ')}`
    );
  });

  it('contains Brand, Category, and DataSource models', () => {
    assert.ok(models.includes('Brand'), 'Schema must include model Brand');
    assert.ok(models.includes('Category'), 'Schema must include model Category');
    assert.ok(models.includes('DataSource'), 'Schema must include model DataSource');
  });

  it('strictly rejects any forbidden compact-schema models', () => {
    const budget = checkModelBudget({
      schemaContent,
      registryPath: REGISTRY_PATH,
      expected: 25,
      lockRegistry: true,
    });
    assert.equal(budget.forbiddenModels.length, 0, `Forbidden models found: ${budget.forbiddenModels.join(', ')}`);
    assert.ok(budget.valid, `Budget check must pass: ${budget.errors.join('; ')}`);
  });

  it('Brand model defines required fields, relations, and unique slug', () => {
    const brandMatch = schemaContent.match(/model\s+Brand\s*\{([\s\S]*?)\}/);
    assert.ok(brandMatch, 'model Brand block not found');
    const brandBlock = brandMatch[1];

    assert.match(brandBlock, /name\s+String/);
    assert.match(brandBlock, /slug\s+String\s+@unique/);
    assert.match(brandBlock, /isActive\s+Boolean/);
    assert.match(brandBlock, /products\s+Product\[\]/);
  });

  it('Category model defines hierarchy, versioned specSchema, and configs', () => {
    const catMatch = schemaContent.match(/model\s+Category\s*\{([\s\S]*?)\}/);
    assert.ok(catMatch, 'model Category block not found');
    const catBlock = catMatch[1];

    assert.match(catBlock, /name\s+String/);
    assert.match(catBlock, /slug\s+String\s+@unique/);
    assert.match(catBlock, /kind\s+ProductKind/);
    assert.match(catBlock, /parentId\s+String\?/);
    assert.match(catBlock, /parent\s+Category\?\s+@relation\("CategoryHierarchy"/);
    assert.match(catBlock, /children\s+Category\[\]\s+@relation\("CategoryHierarchy"\)/);
    assert.match(catBlock, /specSchema\s+Json/);
    assert.match(catBlock, /specSchemaVersion\s+Int/);
    assert.match(catBlock, /scoringConfig\s+Json\?/);
    assert.match(catBlock, /warrantyConfig\s+Json\?/);
    assert.match(catBlock, /products\s+Product\[\]/);
  });

  it('DataSource model defines unified provenance, lifecycle, and review attribution', () => {
    const dsMatch = schemaContent.match(/model\s+DataSource\s*\{([\s\S]*?)\}/);
    assert.ok(dsMatch, 'model DataSource block not found');
    const dsBlock = dsMatch[1];

    assert.match(dsBlock, /name\s+String/);
    assert.match(dsBlock, /sourceType\s+DataSourceType/);
    assert.match(dsBlock, /status\s+SourceStatus/);
    assert.match(dsBlock, /publisher\s+String/);
    assert.match(dsBlock, /isSynthetic\s+Boolean/);
    assert.match(dsBlock, /reviewerId\s+String\?/);
    assert.match(dsBlock, /reviewer\s+User\?\s+@relation/);
    assert.match(dsBlock, /payload\s+Json\?/);
  });

  it('Product model is expanded with catalog JSON while preserving legacy compatibility', () => {
    const prodMatch = schemaContent.match(/model\s+Product\s*\{([\s\S]*?)\}/);
    assert.ok(prodMatch, 'model Product block not found');
    const prodBlock = prodMatch[1];

    // Preserved legacy fields
    assert.match(prodBlock, /category\s+String\?/);
    assert.match(prodBlock, /image\s+String\?/);

    // M1 electronics additions
    assert.match(prodBlock, /brandId\s+String\?/);
    assert.match(prodBlock, /brand\s+Brand\?\s+@relation/);
    assert.match(prodBlock, /categoryId\s+String\?/);
    assert.match(prodBlock, /categoryRef\s+Category\?\s+@relation/);
    assert.match(prodBlock, /kind\s+ProductKind/);
    assert.match(prodBlock, /segment\s+ProductSegment\?/);
    assert.match(prodBlock, /isLegacy\s+Boolean/);
    assert.match(prodBlock, /specs\s+Json\?/);
    assert.match(prodBlock, /images\s+Json\?/);
    assert.match(prodBlock, /editorialTags\s+Json\?/);
    assert.match(prodBlock, /warrantyConfig\s+Json\?/);
    assert.match(prodBlock, /catalogVersion\s+Int/);
  });

  it('ProductVariant model is expanded with option values, optionHash, and specOverrides', () => {
    const varMatch = schemaContent.match(/model\s+ProductVariant\s*\{([\s\S]*?)\}/);
    assert.ok(varMatch, 'model ProductVariant block not found');
    const varBlock = varMatch[1];

    // Preserved legacy fields
    assert.match(varBlock, /color\s+String\?/);
    assert.match(varBlock, /size\s+String\?/);
    assert.match(varBlock, /image\s+String\?/);

    // M1 electronics additions
    assert.match(varBlock, /optionValues\s+Json\?/);
    assert.match(varBlock, /optionHash\s+String\?/);
    assert.match(varBlock, /specOverrides\s+Json\?/);
    assert.match(varBlock, /images\s+Json\?/);
    assert.match(varBlock, /warrantyConfig\s+Json\?/);
    assert.match(varBlock, /serializationRequired\s+Boolean/);
    assert.match(varBlock, /@@unique\(\[productId,\s*optionHash\]\)/);
  });

  it('declares all required enums for M1 catalog', () => {
    assert.match(schemaContent, /enum\s+ProductKind\s*\{[\s\S]*?LAPTOP[\s\S]*?PHONE[\s\S]*?ACCESSORY[\s\S]*?LEGACY[\s\S]*?\}/);
    assert.match(schemaContent, /enum\s+ProductSegment\s*\{[\s\S]*?BUDGET[\s\S]*?MID_RANGE[\s\S]*?PREMIUM[\s\S]*?FLAGSHIP[\s\S]*?\}/);
    assert.match(schemaContent, /enum\s+SourceStatus\s*\{[\s\S]*?DISCOVERED[\s\S]*?LICENSE_REVIEW[\s\S]*?MAPPING_REVIEW[\s\S]*?APPROVED[\s\S]*?ACTIVE[\s\S]*?REJECTED[\s\S]*?REVOKED[\s\S]*?\}/);
    assert.match(schemaContent, /enum\s+DataSourceType\s*\{[\s\S]*?CATALOG[\s\S]*?REVIEW_AGGREGATE[\s\S]*?BENCHMARK[\s\S]*?COMPATIBILITY[\s\S]*?MANUFACTURER[\s\S]*?\}/);
  });

  it('migration SQL creates Brand, Category, DataSource, GIN indexes, and backfill', () => {
    const migrationDir = path.resolve(process.cwd(), 'prisma/migrations');
    const entries = fs.readdirSync(migrationDir);
    const m1Migration = entries.find((e) => e.includes('compact_electronics_catalog'));
    assert.ok(m1Migration, 'Migration directory for compact_electronics_catalog must exist');

    const sqlPath = path.join(migrationDir, m1Migration, 'migration.sql');
    assert.ok(fs.existsSync(sqlPath), 'migration.sql must exist');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Tables
    assert.match(sql, /CREATE TABLE "Brand"/);
    assert.match(sql, /CREATE TABLE "Category"/);
    assert.match(sql, /CREATE TABLE "DataSource"/);

    // GIN indexes for JSON fields
    assert.match(sql, /CREATE INDEX "Product_specs_gin_idx" ON "Product" USING GIN \("specs"\);/);
    assert.match(sql, /CREATE INDEX "Product_images_gin_idx" ON "Product" USING GIN \("images"\);/);
    assert.match(sql, /CREATE INDEX "ProductVariant_optionValues_gin_idx" ON "ProductVariant" USING GIN \("optionValues"\);/);
    assert.match(sql, /CREATE INDEX "Category_specSchema_gin_idx" ON "Category" USING GIN \("specSchema"\);/);
    assert.match(sql, /CREATE INDEX "DataSource_payload_gin_idx" ON "DataSource" USING GIN \("payload"\);/);

    // Step 4 legacy backfill
    assert.match(sql, /INSERT INTO "Category"[\s\S]*?'cat_legacy_root'[\s\S]*?'legacy-products'/);
    assert.match(sql, /UPDATE "Product"[\s\S]*?"categoryId" = 'cat_legacy_root'[\s\S]*?"isLegacy" = true/);
  });
});
