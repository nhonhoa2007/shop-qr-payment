import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionPurchaseOrder,
  validateCreatePoInput,
  calculatePoTotals,
} from '@server/modules/procurement/procurement.fsm';
import type { PurchaseOrderStatus } from '@shared/types/procurement';

describe('Procurement FSM & Validation - PurchaseOrder', () => {
  describe('FSM Transitions', () => {
    it('allows DRAFT -> ORDERED', () => {
      const result = canTransitionPurchaseOrder('DRAFT', 'ORDERED');
      assert.equal(result.allowed, true);
    });

    it('allows DRAFT -> CANCELLED', () => {
      const result = canTransitionPurchaseOrder('DRAFT', 'CANCELLED');
      assert.equal(result.allowed, true);
    });

    it('allows ORDERED -> PARTIALLY_RECEIVED and ORDERED -> RECEIVED', () => {
      assert.equal(canTransitionPurchaseOrder('ORDERED', 'PARTIALLY_RECEIVED').allowed, true);
      assert.equal(canTransitionPurchaseOrder('ORDERED', 'RECEIVED').allowed, true);
      assert.equal(canTransitionPurchaseOrder('ORDERED', 'CANCELLED').allowed, true);
    });

    it('allows PARTIALLY_RECEIVED -> RECEIVED', () => {
      assert.equal(canTransitionPurchaseOrder('PARTIALLY_RECEIVED', 'RECEIVED').allowed, true);
    });

    it('rejects illegal transitions: RECEIVED -> DRAFT or CANCELLED -> ORDERED', () => {
      assert.equal(canTransitionPurchaseOrder('RECEIVED', 'DRAFT').allowed, false);
      assert.equal(canTransitionPurchaseOrder('RECEIVED', 'ORDERED').allowed, false);
      assert.equal(canTransitionPurchaseOrder('CANCELLED', 'ORDERED').allowed, false);
      assert.equal(canTransitionPurchaseOrder('CANCELLED', 'RECEIVED').allowed, false);
    });
  });

  describe('Validation & Money Calculations', () => {
    it('calculates PO line totals and grand total accurately using exact BigInt math', () => {
      const items = [
        { productId: 'p1', orderedQuantity: 5, unitCost: 15_000_000n },
        { productId: 'p2', variantId: 'v1', orderedQuantity: 10, unitCost: 2_500_000n },
      ];
      const totals = calculatePoTotals(items);
      // 5 * 15,000,000 + 10 * 2,500,000 = 75,000,000 + 25,000,000 = 100,000,000
      assert.equal(totals.totalAmount, 100_000_000n);
      assert.equal(totals.lineTotals[0], 75_000_000n);
      assert.equal(totals.lineTotals[1], 25_000_000n);
    });

    it('validates PO creation input: rejects empty items or non-positive quantities', () => {
      assert.throws(() => {
        validateCreatePoInput({
          supplierId: 'sup_1',
          items: [],
        });
      }, /at least one item/i);

      assert.throws(() => {
        validateCreatePoInput({
          supplierId: 'sup_1',
          items: [{ productId: 'p1', orderedQuantity: 0, unitCost: 1000n }],
        });
      }, /positive quantity/i);

      assert.throws(() => {
        validateCreatePoInput({
          supplierId: 'sup_1',
          items: [{ productId: 'p1', orderedQuantity: 5, unitCost: -500n }],
        });
      }, /unit cost cannot be negative/i);
    });
  });
});
