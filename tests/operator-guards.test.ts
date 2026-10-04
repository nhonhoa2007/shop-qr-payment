// tests/operator-guards.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Operator Access Resolution', () => {
  it('should always allow ADMIN regardless of permissions', () => {
    const adminUser = { id: 'u1', role: 'ADMIN', permissions: [] };
    assert.equal(resolveOperatorAccess(adminUser, 'orders'), true);
    assert.equal(resolveOperatorAccess(adminUser, 'products'), true);
    assert.equal(resolveOperatorAccess(adminUser, 'shipments'), true);
    assert.equal(resolveOperatorAccess(adminUser, 'chat'), true);
    assert.equal(resolveOperatorAccess(adminUser, 'reviews'), true);
  });

  it('should allow STAFF if target permission is held', () => {
    const staffUser = { id: 'u2', role: 'STAFF', permissions: ['orders', 'shipments'] };
    assert.equal(resolveOperatorAccess(staffUser, 'orders'), true);
    assert.equal(resolveOperatorAccess(staffUser, 'shipments'), true);
    assert.equal(resolveOperatorAccess(staffUser, 'products'), false);
    assert.equal(resolveOperatorAccess(staffUser, 'chat'), false);
    assert.equal(resolveOperatorAccess(staffUser, 'reviews'), false);
  });

  it('should reject CUSTOMER for any operator permission', () => {
    const customerUser = { id: 'u3', role: 'CUSTOMER', permissions: ['orders'] };
    assert.equal(resolveOperatorAccess(customerUser, 'orders'), false);
    assert.equal(resolveOperatorAccess(customerUser, 'products'), false);
  });

  it('should reject unauthenticated or empty user', () => {
    assert.equal(resolveOperatorAccess(null, 'orders'), false);
    assert.equal(resolveOperatorAccess(undefined, 'orders'), false);
    assert.equal(resolveOperatorAccess({ role: '' }, 'orders'), false);
  });
});
