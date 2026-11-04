import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAdminSearchDestination, initialAdminSearchQuery } from '@client/lib/admin-search';

describe('admin topbar search', () => {
  it('routes a staff member only to pages they can access', () => {
    const orderStaff = { role: 'STAFF', permissions: ['orders'] };
    const productStaff = { role: 'STAFF', permissions: ['products'] };
    assert.equal(getAdminSearchDestination('DH123', orderStaff), '/admin/orders?q=DH123');
    assert.equal(getAdminSearchDestination('điện thoại', orderStaff), '/admin/orders?q=%C4%91i%E1%BB%87n%20tho%E1%BA%A1i');
    assert.equal(getAdminSearchDestination('DH123', productStaff), '/admin/products?search=DH123');
    assert.equal(getAdminSearchDestination('điện thoại', productStaff), '/admin/products?search=%C4%91i%E1%BB%87n%20tho%E1%BA%A1i');
    assert.equal(getAdminSearchDestination('DH123', { role: 'STAFF', permissions: [] }), null);
  });

  it('keeps the administrator query heuristic and ignores blank input', () => {
    assert.equal(getAdminSearchDestination(' 12345 ', { role: 'ADMIN' }), '/admin/orders?q=12345');
    assert.equal(getAdminSearchDestination('camera', { role: 'ADMIN' }), '/admin/products?search=camera');
    assert.equal(getAdminSearchDestination('   ', { role: 'ADMIN' }), null);
  });

  it('reads the first search parameter value', () => {
    assert.equal(initialAdminSearchQuery({ search: [' camera ', 'phone'] }), 'camera');
    assert.equal(initialAdminSearchQuery({ q: ' DH100 ' }), 'DH100');
  });
});
