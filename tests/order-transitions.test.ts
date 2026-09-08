import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderTransition, isOrderStatus, isPaymentStatus } from '../src/lib/order-transitions.ts';

describe('Order Transitions Validation', () => {
  it('should validate status type guards correctly', () => {
    assert.equal(isOrderStatus('PENDING'), true);
    assert.equal(isOrderStatus('COMPLETED'), true);
    assert.equal(isOrderStatus('INVALID_STATUS'), false);

    assert.equal(isPaymentStatus('UNPAID'), true);
    assert.equal(isPaymentStatus('PAID'), true);
    assert.equal(isPaymentStatus('EXPIRED'), true);
    assert.equal(isPaymentStatus('WRONG'), false);
  });

  it('should block modifying cancelled orders', () => {
    const error = validateOrderTransition({
      currentStatus: 'CANCELLED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'PROCESSING',
    });
    assert.match(error!, /Không thể chuyển trạng thái đơn hàng đã hủy/);
  });

  it('should block marking expired payment as paid without override', () => {
    const error = validateOrderTransition({
      currentStatus: 'CANCELLED',
      currentPaymentStatus: 'EXPIRED',
      nextPaymentStatus: 'PAID',
    });
    assert.ok(error);
  });

  it('should block completing or shipping unpaid orders', () => {
    const errComplete = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'COMPLETED',
    });
    assert.match(errComplete!, /đã thanh toán/);

    const errShip = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'UNPAID',
      nextStatus: 'SHIPPING',
    });
    assert.match(errShip!, /đã thanh toán/);
  });

  it('should allow valid transitions', () => {
    const valid1 = validateOrderTransition({
      currentStatus: 'CONFIRMED',
      currentPaymentStatus: 'PAID',
      nextStatus: 'SHIPPING',
    });
    assert.equal(valid1, null);

    const valid2 = validateOrderTransition({
      currentStatus: 'SHIPPING',
      currentPaymentStatus: 'PAID',
      nextStatus: 'COMPLETED',
    });
    assert.equal(valid2, null);
  });
});
