import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterRecentOrders } from '@client/components/admin/dashboard/recent-orders-presentation';

const orders = [
  { id: '1', orderCode: 'DH001', customerName: 'An', itemsSummary: 'Áo sơ mi', totalAmount: 200, status: 'PENDING' },
  { id: '2', orderCode: 'DH002', customerName: 'Bình', itemsSummary: 'Giày', totalAmount: 500, status: 'SHIPPING' },
  { id: '3', orderCode: 'DH003', customerName: 'Cúc', itemsSummary: 'Túi', totalAmount: 300, status: 'PENDING' },
];

describe('recent orders presentation', () => {
  it('searches code, customer and product summary without changing source rows', () => {
    assert.deepEqual(filterRecentOrders(orders, { query: 'binh' }).map((order) => order.id), ['2']);
    assert.deepEqual(filterRecentOrders(orders, { query: 'áo' }).map((order) => order.id), ['1']);
    assert.equal(orders[0].id, '1');
  });

  it('filters status and sorts amount in the requested direction', () => {
    assert.deepEqual(filterRecentOrders(orders, { status: 'PENDING', amountSort: 'desc' }).map((order) => order.id), ['3', '1']);
    assert.deepEqual(filterRecentOrders(orders, { amountSort: 'asc' }).map((order) => order.id), ['1', '3', '2']);
  });
});
