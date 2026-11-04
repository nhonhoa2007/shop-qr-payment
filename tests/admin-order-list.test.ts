import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toAdminOrderListItem } from '@server/modules/admin/admin-order-list';

describe('admin order list projection', () => {
  it('sends only fields used by the order view', () => {
    const result = toAdminOrderListItem({
      id: 'order-1',
      orderCode: 'DH001',
      customerName: 'Customer',
      customerPhone: '0123',
      customerEmail: null,
      customerAddress: 'Address',
      totalAmount: 100000,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      note: null,
      createdAt: new Date('2026-11-04T00:00:00.000Z'),
      items: [{ id: 'item-1', quantity: 1, price: 100000, product: { name: 'Item', image: null } }],
      bankTransfers: [{ senderAccount: 'secret', rawWebhookData: { secret: true } }],
    });

    assert.equal('bankTransfers' in result, false);
    assert.deepEqual(Object.keys(result).sort(), [
      'id', 'orderCode', 'customerName', 'customerPhone', 'customerEmail',
      'customerAddress', 'totalAmount', 'status', 'paymentStatus', 'note',
      'createdAt', 'items',
    ].sort());
    assert.equal(result.items[0].product.name, 'Item');
  });
});
