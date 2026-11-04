import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterAdminOrders, initialOrderQuery, initialOrderStatus } from '@client/lib/admin-order-filter';

const orders = [
  { id: '1', orderCode: 'DH1001', customerName: 'An Nguyễn', customerPhone: '0901000001', status: 'PROCESSING', paymentStatus: 'PAID' },
  { id: '2', orderCode: 'DH1002', customerName: 'Bình Trần', customerPhone: '0902000002', status: 'PENDING', paymentStatus: 'UNPAID' },
];

describe('admin order filters', () => {
  it('combines status, payment and case-insensitive search', () => {
    assert.deepEqual(filterAdminOrders(orders, { status: 'PROCESSING', payment: 'PAID', query: '  dh1001  ' }).map((order) => order.id), ['1']);
    assert.deepEqual(filterAdminOrders(orders, { status: 'ALL', payment: 'ALL', query: 'bÌnH' }).map((order) => order.id), ['2']);
  });

  it('returns all orders when filters are empty', () => {
    assert.deepEqual(filterAdminOrders(orders, { status: 'ALL', payment: 'ALL', query: '' }).map((order) => order.id), ['1', '2']);
  });

  it('accepts the topbar q parameter and older search links', () => {
    assert.equal(initialOrderQuery({ q: 'DH1001' }), 'DH1001');
    assert.equal(initialOrderQuery({ search: 'DH1002' }), 'DH1002');
    assert.equal(initialOrderQuery({ q: ['first', 'second'] }), 'first');
  });

  it('uses only a valid status from an action link', () => {
    assert.equal(initialOrderStatus({ status: 'PENDING' }), 'PENDING');
    assert.equal(initialOrderStatus({ status: ['SHIPPING', 'CANCELLED'] }), 'SHIPPING');
    assert.equal(initialOrderStatus({ status: 'MADE_UP' }), 'ALL');
  });
});
