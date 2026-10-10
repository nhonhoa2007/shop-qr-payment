// tests/admin-rbac-permissions.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateUserUpdatePayload } from '../src/server/modules/admin/admin-rbac.service.ts';

describe('Admin RBAC Validation with Permissions', () => {
  it('should accept valid permissions array for user update', () => {
    const payload = {
      userId: 'usr_123',
      role: 'STAFF',
      permissions: ['orders', 'shipments'],
    };
    const res = validateUserUpdatePayload(payload);
    assert.equal(res.valid, true);
    assert.deepEqual(res.data?.permissions, ['orders', 'shipments']);
  });

  it('should filter out invalid permission names in payload', () => {
    const payload = {
      userId: 'usr_123',
      permissions: ['orders', 'malicious_perm', 'chat'],
    };
    const res = validateUserUpdatePayload(payload);
    assert.equal(res.valid, true);
    assert.deepEqual(res.data?.permissions, ['orders', 'chat']);
  });

  it('should accept update with only permissions provided', () => {
    const payload = {
      userId: 'usr_123',
      permissions: ['reviews'],
    };
    const res = validateUserUpdatePayload(payload);
    assert.equal(res.valid, true);
    assert.deepEqual(res.data?.permissions, ['reviews']);
  });
});
