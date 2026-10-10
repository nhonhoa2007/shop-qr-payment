import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  approveAndFulfillOrder,
  type ApproveAndFulfillResult,
} from '@server/modules/orders/order-fulfillment.service';

describe('Order Fulfillment Service - Validation & FSM Invariants', () => {
  it('should fail when order does not exist', async () => {
    const result = await approveAndFulfillOrder('non_existent_order_id_12345');
    assert.equal(result.success, false);
    assert.match(result.error || '', /không tồn tại/i);
  });
});
