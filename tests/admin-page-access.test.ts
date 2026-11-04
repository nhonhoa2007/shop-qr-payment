import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessAdminPage, canUseAdminOnlyAction } from '@shared/admin-page-access';

describe('admin page access', () => {
  it('allows each staff route only with its assigned permission', () => {
    const staff = { role: 'STAFF', permissions: ['orders', 'shipments'] };
    assert.equal(canAccessAdminPage(staff, '/admin'), true);
    assert.equal(canAccessAdminPage(staff, '/admin/orders'), true);
    assert.equal(canAccessAdminPage(staff, '/admin/shipments'), true);
    assert.equal(canAccessAdminPage(staff, '/admin/products'), false);
    assert.equal(canAccessAdminPage(staff, '/admin/chat/room-1'), false);
    assert.equal(canAccessAdminPage(staff, '/admin/reviews'), false);
    assert.equal(canAccessAdminPage(staff, '/admin/transactions'), false);
  });

  it('allows warranty staff to open both after-sales pages', () => {
    const staff = { role: 'STAFF', permissions: ['warranties'] };
    assert.equal(canAccessAdminPage(staff, '/admin/warranties'), true);
    assert.equal(canAccessAdminPage(staff, '/admin/returns'), true);
  });

  it('keeps admin-only actions unavailable to staff', () => {
    assert.equal(canUseAdminOnlyAction('STAFF'), false);
    assert.equal(canUseAdminOnlyAction('ADMIN'), true);
    assert.equal(canAccessAdminPage({ role: 'CUSTOMER' }, '/admin'), false);
    assert.equal(canAccessAdminPage({ role: 'ADMIN' }, '/admin/audit-logs'), true);
  });
});
