// tests/admin-layout-gate.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function canAccessAdminLayout(role?: string): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}

describe('Admin Layout Access Gate', () => {
  it('should allow ADMIN and STAFF to access /admin', () => {
    assert.equal(canAccessAdminLayout('ADMIN'), true);
    assert.equal(canAccessAdminLayout('STAFF'), true);
  });

  it('should deny CUSTOMER or empty role', () => {
    assert.equal(canAccessAdminLayout('CUSTOMER'), false);
    assert.equal(canAccessAdminLayout(undefined), false);
    assert.equal(canAccessAdminLayout(''), false);
  });
});
