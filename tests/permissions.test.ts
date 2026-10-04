// tests/permissions.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterValidPermissions,
  hasStaffPermissionInMemory,
} from '../src/server/modules/admin/permission.service.ts';

describe('Staff Permission Service Logic', () => {
  it('should filter out invalid permissions and eliminate duplicates', () => {
    const raw = ['orders', 'invalid', 'products', 'orders', 123, null];
    const cleaned = filterValidPermissions(raw);
    assert.deepEqual(cleaned, ['orders', 'products']);
  });

  it('should verify permission in-memory list accurately', () => {
    const permissions = ['orders', 'shipments'];
    assert.equal(hasStaffPermissionInMemory(permissions, 'orders'), true);
    assert.equal(hasStaffPermissionInMemory(permissions, 'products'), false);
    assert.equal(hasStaffPermissionInMemory(undefined, 'orders'), false);
    assert.equal(hasStaffPermissionInMemory([], 'orders'), false);
  });
});
