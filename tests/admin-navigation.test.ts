import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getVisibleAdminNavGroups,
  isAdminNavItemActive,
} from '@client/components/admin/layout/admin-navigation';

describe('admin navigation permissions', () => {
  it('keeps finance routes available to administrators', () => {
    const hrefs = getVisibleAdminNavGroups('ADMIN').flatMap((group) => group.items.map((item) => item.href));
    assert.ok(hrefs.includes('/admin/transactions'));
    assert.ok(hrefs.includes('/admin/customers'));
  });

  it('shows staff only the routes their permissions allow', () => {
    const hrefs = getVisibleAdminNavGroups('STAFF', ['orders']).flatMap((group) => group.items.map((item) => item.href));
    assert.deepEqual(hrefs, ['/admin', '/admin/orders']);
  });

  it('keeps the dashboard available when staff has no optional permissions', () => {
    const hrefs = getVisibleAdminNavGroups('STAFF', []).flatMap((group) => group.items.map((item) => item.href));
    assert.deepEqual(hrefs, ['/admin']);
  });
});

describe('admin navigation active routes', () => {
  it('does not select dashboard for a nested admin route', () => {
    assert.equal(isAdminNavItemActive('/admin/orders', '/admin', true), false);
  });

  it('keeps the parent chat route active on a conversation page', () => {
    assert.equal(isAdminNavItemActive('/admin/chat/room-1', '/admin/chat'), true);
    assert.equal(isAdminNavItemActive('/admin/chat-old', '/admin/chat'), false);
  });
});
