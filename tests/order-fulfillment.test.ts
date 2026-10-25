import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  approveAndFulfillOrder,
} from '@server/modules/orders/order-fulfillment.service';

describe('Order Fulfillment Service - Validation & FSM Invariants', () => {
  it('should fail when order does not exist', async () => {
    const db = { order: { findUnique: async () => null } } as unknown as Parameters<typeof approveAndFulfillOrder>[1];
    const result = await approveAndFulfillOrder('non_existent_order_id_12345', db);
    assert.equal(result.success, false);
    assert.match(result.error || '', /không tồn tại/i);
  });
});
