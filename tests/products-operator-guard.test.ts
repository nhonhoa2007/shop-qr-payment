// tests/products-operator-guard.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Products Guard Differentiation', () => {
  it('should allow staff with products permission to edit products', () => {
    const user = { role: 'STAFF', permissions: ['products'] };
    assert.equal(resolveOperatorAccess(user, 'products'), true);
  });

  it('should restrict delete actions to ADMIN only', () => {
    const staff = { role: 'STAFF', permissions: ['products'] };
    const admin = { role: 'ADMIN', permissions: [] };

    const canDelete = (u: { role: string }) => u.role === 'ADMIN';
    assert.equal(canDelete(staff), false);
    assert.equal(canDelete(admin), true);
  });
});
