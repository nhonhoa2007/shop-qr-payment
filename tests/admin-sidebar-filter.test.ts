// tests/admin-sidebar-filter.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface TestNavItem {
  name: string;
  href: string;
  requiredPermission?: string;
  adminOnly?: boolean;
}

function filterNavItems(items: TestNavItem[], role?: string, permissions: string[] = []): TestNavItem[] {
  if (role === 'ADMIN') return items;
  return items.filter((item) => {
    if (item.adminOnly) return false;
    if (!item.requiredPermission) return true;
    return permissions.includes(item.requiredPermission);
  });
}

describe('Admin Sidebar Filtering', () => {
  const sampleItems: TestNavItem[] = [
    { name: 'Bảng điều khiển', href: '/admin' },
    { name: 'Đơn hàng', href: '/admin/orders', requiredPermission: 'orders' },
    { name: 'Đối soát', href: '/admin/transactions', adminOnly: true },
    { name: 'Khách hàng & RBAC', href: '/admin/customers', adminOnly: true },
    { name: 'Sản phẩm', href: '/admin/products', requiredPermission: 'products' },
  ];

  it('should show all items for ADMIN', () => {
    const result = filterNavItems(sampleItems, 'ADMIN');
    assert.equal(result.length, 5);
  });

  it('should filter items for STAFF according to permissions and hide admin-only items', () => {
    const result = filterNavItems(sampleItems, 'STAFF', ['orders']);
    assert.deepEqual(result.map((i) => i.name), ['Bảng điều khiển', 'Đơn hàng']);
  });

  it('should only show Dashboard when STAFF has no specific permissions', () => {
    const result = filterNavItems(sampleItems, 'STAFF', []);
    assert.deepEqual(result.map((i) => i.name), ['Bảng điều khiển']);
  });
});
