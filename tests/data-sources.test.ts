import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  transitionDataSource,
  createDataSource,
  updateDataSourcePayloadOrChecksum,
  type DataSourceInput,
  type DataSourceRecord,
  type DataSourceDb,
} from '../src/server/modules/catalog/data-source.service.ts';
import type { DataSourceType } from '../src/shared/types/catalog.ts';

function createMockDb(initialSources: DataSourceRecord[] = []): DataSourceDb {
  const sources = new Map<string, DataSourceRecord>(initialSources.map((s) => [s.id, { ...s }]));

  return {
    dataSource: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return sources.get(id) ?? null;
      },
      async findMany(args?: {
        where?: {
          sourceType?: unknown;
          status?: unknown;
        };
      }) {
        let list = Array.from(sources.values());
        if (args?.where?.sourceType) {
          list = list.filter((s) => s.sourceType === args.where?.sourceType);
        }
        if (args?.where?.status) {
          list = list.filter((s) => s.status === args.where?.status);
        }
        return list;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const id = (data.id as string) || `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const record: DataSourceRecord = {
          id,
          name: (data.name as string) || '',
          sourceType: data.sourceType as DataSourceType,
          status: 'DISCOVERED',
          publisher: (data.publisher as string) || '',
          url: (data.url as string) ?? null,
          license: (data.license as string) ?? null,
          market: (data.market as string) ?? null,
          version: (data.version as string) ?? null,
          checksum: (data.checksum as string) ?? null,
          isSynthetic: Boolean(data.isSynthetic),
          reviewerId: (data.reviewerId as string) ?? null,
          reviewedAt: (data.reviewedAt as Date) ?? null,
          rejectionReason: (data.rejectionReason as string) ?? null,
          payload: data.payload ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sources.set(id, record);
        return record;
      },
      async update({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const existing = sources.get(id);
        if (!existing) throw new Error(`DataSource not found: ${id}`);
        const updated: DataSourceRecord = {
          ...existing,
          ...(data as Partial<DataSourceRecord>),
          updatedAt: new Date(),
        };
        sources.set(id, updated);
        return updated;
      },
    },
  };
}

describe('DataSource Lifecycle and State Transitions', () => {
  it('creates DataSource in DISCOVERED status by default', async () => {
    const db = createMockDb();
    const input: DataSourceInput = {
      name: 'ASUS ROG Strix G16 Specsheet',
      sourceType: 'MANUFACTURER',
      publisher: 'ASUS Inc.',
      url: 'https://rog.asus.com/laptops/g16-specs',
      market: 'VN',
      license: 'Public Product Documentation',
      checksum: 'sha256-a1b2c3d4e5f6',
      version: '2026.1',
      payload: {
        mapping: { productId: 'prod_asus_g16' },
        facts: { cpu: 'Intel Core i9-14900HX' },
      },
    };

    const created = await createDataSource(input, db);
    assert.equal(created.status, 'DISCOVERED');
    assert.equal(created.name, input.name);
    assert.equal(created.sourceType, 'MANUFACTURER');
    assert.equal(created.reviewerId, null);
  });

  it('allows valid linear transition: DISCOVERED -> LICENSE_REVIEW -> MAPPING_REVIEW -> APPROVED -> ACTIVE', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'Apple iPhone 16 Pro Tech Specs',
        sourceType: 'MANUFACTURER',
        publisher: 'Apple Inc.',
        license: 'Apple PR & Tech Specs',
        checksum: 'sha256-iphone16-techspecs',
        payload: {
          mapping: { productId: 'prod_ip16_pro' },
          facts: { soc: 'A18 Pro' },
        },
      },
      db
    );

    // 1. To LICENSE_REVIEW
    const toLicense = await transitionDataSource(
      { id: created.id, targetStatus: 'LICENSE_REVIEW', reviewerId: 'staff_1' },
      db
    );
    assert.equal(toLicense.status, 'LICENSE_REVIEW');

    // 2. To MAPPING_REVIEW
    const toMapping = await transitionDataSource(
      { id: created.id, targetStatus: 'MAPPING_REVIEW', reviewerId: 'staff_1' },
      db
    );
    assert.equal(toMapping.status, 'MAPPING_REVIEW');

    // 3. To APPROVED
    const toApproved = await transitionDataSource(
      { id: created.id, targetStatus: 'APPROVED', reviewerId: 'admin_1' },
      db
    );
    assert.equal(toApproved.status, 'APPROVED');

    // 4. To ACTIVE (requires admin reviewer, reviewed license, checksum, valid payload mapping)
    const toActive = await transitionDataSource(
      { id: created.id, targetStatus: 'ACTIVE', reviewerId: 'admin_1' },
      db
    );
    assert.equal(toActive.status, 'ACTIVE');
    assert.equal(toActive.reviewerId, 'admin_1');
    assert.ok(toActive.reviewedAt);
  });

  it('rejects skipping states: DISCOVERED cannot transition directly to ACTIVE', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'Unverified Blog Source',
        sourceType: 'CATALOG',
        publisher: 'Unknown Blog',
      },
      db
    );

    await assert.rejects(
      async () => {
        await transitionDataSource(
          { id: created.id, targetStatus: 'ACTIVE', reviewerId: 'admin_1' },
          db
        );
      },
      (err: Error) => {
        assert.match(err.message, /invalid transition/i);
        return true;
      }
    );
  });

  it('ACTIVE activation requires non-empty license', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'No License Source',
        sourceType: 'CATALOG',
        publisher: 'Scraper',
        checksum: 'sha256-abc',
        payload: { mapping: { productId: 'prod_1' } },
      },
      db
    );

    // Fast-forward to APPROVED
    await db.dataSource.update({ where: { id: created.id }, data: { status: 'APPROVED' } });

    await assert.rejects(
      async () => {
        await transitionDataSource(
          { id: created.id, targetStatus: 'ACTIVE', reviewerId: 'admin_1' },
          db
        );
      },
      (err: Error) => {
        assert.match(err.message, /license/i);
        return true;
      }
    );
  });

  it('ACTIVE activation requires non-empty checksum', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'No Checksum Source',
        sourceType: 'CATALOG',
        publisher: 'Manufacturer',
        license: 'MIT',
        payload: { mapping: { productId: 'prod_1' } },
      },
      db
    );

    await db.dataSource.update({ where: { id: created.id }, data: { status: 'APPROVED' } });

    await assert.rejects(
      async () => {
        await transitionDataSource(
          { id: created.id, targetStatus: 'ACTIVE', reviewerId: 'admin_1' },
          db
        );
      },
      (err: Error) => {
        assert.match(err.message, /checksum/i);
        return true;
      }
    );
  });

  it('ACTIVE activation requires reviewerId', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'Unattributed Source',
        sourceType: 'CATALOG',
        publisher: 'Manufacturer',
        license: 'Commercial',
        checksum: 'sha256-1234',
        payload: { mapping: { productId: 'prod_1' } },
      },
      db
    );

    await db.dataSource.update({ where: { id: created.id }, data: { status: 'APPROVED' } });

    await assert.rejects(
      async () => {
        await transitionDataSource(
          { id: created.id, targetStatus: 'ACTIVE' },
          db
        );
      },
      (err: Error) => {
        assert.match(err.message, /reviewer/i);
        return true;
      }
    );
  });

  it('allows REJECTED from review stages with required rejectionReason', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'Unlicensed Scraped Data',
        sourceType: 'REVIEW_AGGREGATE',
        publisher: 'Third-party aggregator',
      },
      db
    );

    await transitionDataSource({ id: created.id, targetStatus: 'LICENSE_REVIEW' }, db);

    await assert.rejects(
      async () => {
        await transitionDataSource(
          { id: created.id, targetStatus: 'REJECTED' },
          db
        );
      },
      (err: Error) => {
        assert.match(err.message, /rejectionReason/i);
        return true;
      }
    );

    const rejected = await transitionDataSource(
      {
        id: created.id,
        targetStatus: 'REJECTED',
        reviewerId: 'admin_1',
        rejectionReason: 'License forbids commercial ingestion and caching.',
      },
      db
    );
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.rejectionReason, 'License forbids commercial ingestion and caching.');
  });

  it('allows REVOKED from ACTIVE or APPROVED state and excludes source', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'Deprecated Source',
        sourceType: 'CATALOG',
        publisher: 'Vendor',
        license: 'Vendor License',
        checksum: 'sha256-vendor',
        payload: { mapping: { productId: 'prod_1' } },
      },
      db
    );

    await db.dataSource.update({
      where: { id: created.id },
      data: { status: 'ACTIVE', reviewerId: 'admin_1' },
    });

    const revoked = await transitionDataSource(
      {
        id: created.id,
        targetStatus: 'REVOKED',
        reviewerId: 'admin_1',
        rejectionReason: 'Vendor revoked API access and spec distribution terms.',
      },
      db
    );
    assert.equal(revoked.status, 'REVOKED');

    await assert.rejects(
      async () => {
        await transitionDataSource(
          { id: created.id, targetStatus: 'ACTIVE', reviewerId: 'admin_1' },
          db
        );
      },
      (err: Error) => {
        assert.match(err.message, /invalid transition/i);
        return true;
      }
    );
  });

  it('returns ACTIVE source to MAPPING_REVIEW when checksum or payload changes', async () => {
    const db = createMockDb();
    const created = await createDataSource(
      {
        name: 'Updatable Source',
        sourceType: 'CATALOG',
        publisher: 'Vendor',
        license: 'Vendor License',
        checksum: 'sha256-original',
        payload: { mapping: { productId: 'prod_1' }, facts: { v: 1 } },
      },
      db
    );

    await db.dataSource.update({
      where: { id: created.id },
      data: { status: 'ACTIVE', reviewerId: 'admin_1' },
    });

    const updated = await updateDataSourcePayloadOrChecksum(
      created.id,
      {
        checksum: 'sha256-new-modified-hash',
        payload: { mapping: { productId: 'prod_1' }, facts: { v: 2 } },
      },
      db
    );

    assert.equal(updated.status, 'MAPPING_REVIEW');
    assert.equal(updated.checksum, 'sha256-new-modified-hash');
  });

  it('parent product mapping does not automatically fan out to all variants or other products', async () => {
    const db = createMockDb();
    const baseSource = await createDataSource(
      {
        name: 'MacBook Air M3 Base Specs',
        sourceType: 'MANUFACTURER',
        publisher: 'Apple',
        license: 'Apple Specsheet',
        checksum: 'sha256-mba-m3',
        payload: {
          mapping: {
            productId: 'prod_mba_m3',
          },
        },
      },
      db
    );

    await db.dataSource.update({
      where: { id: baseSource.id },
      data: { status: 'ACTIVE', reviewerId: 'admin_1' },
    });

    const sources = await db.dataSource.findMany({
      where: { sourceType: 'MANUFACTURER', status: 'ACTIVE' },
    });

    const matched = sources.find((s) => {
      const payload = s.payload as { mapping?: { productId?: string; variantId?: string } } | null;
      return payload?.mapping?.productId === 'prod_mba_m3';
    });
    assert.ok(matched);
    const matchedPayload = matched.payload as { mapping?: { variantId?: string } } | null;
    assert.equal(matchedPayload?.mapping?.variantId, undefined);
  });
});
