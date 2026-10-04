// tests/orders-operator-guard.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '../src/server/modules/admin/guards.ts';

describe('Orders and Shipments Operator Access', () => {
  it('should authorize staff with orders permission to manage orders', () => {
    const user = { role: 'STAFF', permissions: ['orders'] };
    assert.equal(resolveOperatorAccess(user, 'orders'), true);
    assert.equal(resolveOperatorAccess(user, 'shipments'), false);
  });

  it('should authorize staff with shipments permission to view shipments', () => {
    const user = { role: 'STAFF', permissions: ['shipments'] };
    assert.equal(resolveOperatorAccess(user, 'shipments'), true);
    assert.equal(resolveOperatorAccess(user, 'orders'), false);
  });
});
