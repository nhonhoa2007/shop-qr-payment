import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionReturn,
  assertValidReturnTransition,
  validateReturnItemsPayload,
  validateReturnTimelineEntry,
  validateReturnDisposition,
} from '@server/modules/returns/return.fsm';
import type { ReturnRequestStatus, ReturnDisposition } from '@shared/types/return';

describe('Return Request FSM - Transitions & Bounded JSON Validation', () => {
  describe('canTransitionReturn & assertValidReturnTransition', () => {
    const validPairs: [ReturnRequestStatus, ReturnRequestStatus][] = [
      ['REQUESTED', 'APPROVED'],
      ['REQUESTED', 'REJECTED'],
      ['REQUESTED', 'CANCELLED'],
      ['APPROVED', 'ITEM_RECEIVED'],
      ['APPROVED', 'REJECTED'],
      ['APPROVED', 'CANCELLED'],
      ['ITEM_RECEIVED', 'INSPECTED'],
      ['ITEM_RECEIVED', 'REJECTED'],
      ['INSPECTED', 'RESOLVED'],
      ['INSPECTED', 'REJECTED'],
    ];

    for (const [from, to] of validPairs) {
      it(`allows valid transition ${from} -> ${to}`, () => {
        assert.equal(canTransitionReturn(from, to), true);
        assert.doesNotThrow(() => assertValidReturnTransition(from, to));
      });
    }

    const invalidPairs: [ReturnRequestStatus, ReturnRequestStatus][] = [
      ['REQUESTED', 'ITEM_RECEIVED'],
      ['REQUESTED', 'INSPECTED'],
      ['REQUESTED', 'RESOLVED'],
      ['APPROVED', 'RESOLVED'],
      ['RESOLVED', 'REQUESTED'],
      ['RESOLVED', 'INSPECTED'],
      ['REJECTED', 'APPROVED'],
      ['CANCELLED', 'APPROVED'],
    ];

    for (const [from, to] of invalidPairs) {
      it(`rejects invalid transition ${from} -> ${to}`, () => {
        assert.equal(canTransitionReturn(from, to), false);
        assert.throws(
          () => assertValidReturnTransition(from, to),
          /invalid return state transition/i
        );
      });
    }
  });

  describe('validateReturnItemsPayload', () => {
    it('validates a correct bounded items array', () => {
      const validItems = [
        {
          orderItemId: 'item_1',
          productId: 'prod_1',
          variantId: 'var_1',
          quantity: 2,
          unitPriceSnapshot: '15000000',
          returnReason: 'Sản phẩm giao nhầm màu sắc',
        },
      ];

      const res = validateReturnItemsPayload(validItems);
      assert.equal(res.valid, true);
    });

    it('validates items with serialized unit IDs matching quantity', () => {
      const validSerialized = [
        {
          orderItemId: 'item_laptop',
          productId: 'prod_laptop',
          quantity: 2,
          unitPriceSnapshot: '30000000',
          serializedUnitIds: ['unit_1', 'unit_2'],
          returnReason: 'Lỗi phần cứng',
        },
      ];

      const res = validateReturnItemsPayload(validSerialized);
      assert.equal(res.valid, true);
    });

    it('rejects empty items array', () => {
      const res = validateReturnItemsPayload([]);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /empty/i);
    });

    it('rejects non-positive quantity', () => {
      const invalid = [
        {
          orderItemId: 'item_1',
          productId: 'prod_1',
          quantity: 0,
          unitPriceSnapshot: '1000',
          returnReason: 'Test',
        },
      ];
      const res = validateReturnItemsPayload(invalid);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /quantity/i);
    });

    it('rejects item where serializedUnitIds count does not match quantity', () => {
      const invalid = [
        {
          orderItemId: 'item_1',
          productId: 'prod_1',
          quantity: 2,
          serializedUnitIds: ['unit_1'], // only 1 unit for quantity 2
          unitPriceSnapshot: '1000',
          returnReason: 'Test',
        },
      ];
      const res = validateReturnItemsPayload(invalid);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /serialized unit count/i);
    });
  });

  describe('validateReturnTimelineEntry', () => {
    it('validates correct timeline entry', () => {
      const entry = {
        status: 'ITEM_RECEIVED',
        actorId: 'staff_wh_1',
        actorRole: 'STAFF',
        timestamp: new Date().toISOString(),
        note: 'Đã nhận hàng trả tại kho cách ly',
      };
      assert.equal(validateReturnTimelineEntry(entry).valid, true);
    });

    it('rejects timeline entry with missing required fields', () => {
      const invalid = { status: 'ITEM_RECEIVED' };
      assert.equal(validateReturnTimelineEntry(invalid).valid, false);
    });
  });

  describe('validateReturnDisposition', () => {
    const validDispositions: ReturnDisposition[] = [
      'RESTOCKABLE',
      'REFURBISH',
      'DEFECTIVE',
      'RETURN_TO_SUPPLIER',
      'DISPOSED',
    ];

    for (const d of validDispositions) {
      it(`accepts valid disposition ${d}`, () => {
        assert.equal(validateReturnDisposition(d).valid, true);
      });
    }

    it('rejects unknown disposition', () => {
      assert.equal(validateReturnDisposition('INVALID_DISPOSITION').valid, false);
    });
  });
});
