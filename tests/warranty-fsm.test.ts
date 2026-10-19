import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionWarranty,
  assertValidWarrantyTransition,
  validateTimelineEntry,
  validateEvidenceRefs,
  validateWarrantyResolution,
} from '@server/modules/warranties/warranty.fsm';
import type { WarrantyClaimStatus } from '@shared/types/warranty';

describe('Warranty FSM - Transitions, Idempotency & Validation', () => {
  describe('canTransitionWarranty & assertValidWarrantyTransition', () => {
    const validPairs: [WarrantyClaimStatus, WarrantyClaimStatus][] = [
      ['SUBMITTED', 'RECEIVED'],
      ['SUBMITTED', 'REJECTED'],
      ['SUBMITTED', 'CANCELLED'],
      ['RECEIVED', 'INSPECTING'],
      ['RECEIVED', 'REJECTED'],
      ['RECEIVED', 'CANCELLED'],
      ['INSPECTING', 'WAITING_PARTS'],
      ['INSPECTING', 'RESOLVED'],
      ['INSPECTING', 'REJECTED'],
      ['WAITING_PARTS', 'INSPECTING'],
      ['WAITING_PARTS', 'RESOLVED'],
      ['WAITING_PARTS', 'REJECTED'],
    ];

    for (const [from, to] of validPairs) {
      it(`allows transition ${from} -> ${to}`, () => {
        assert.equal(canTransitionWarranty(from, to), true);
        assert.doesNotThrow(() => assertValidWarrantyTransition(from, to));
      });
    }

    const invalidPairs: [WarrantyClaimStatus, WarrantyClaimStatus][] = [
      ['SUBMITTED', 'RESOLVED'],
      ['SUBMITTED', 'WAITING_PARTS'],
      ['RECEIVED', 'RESOLVED'],
      ['RESOLVED', 'SUBMITTED'],
      ['RESOLVED', 'INSPECTING'],
      ['REJECTED', 'RESOLVED'],
      ['CANCELLED', 'SUBMITTED'],
      ['CANCELLED', 'RECEIVED'],
    ];

    for (const [from, to] of invalidPairs) {
      it(`rejects invalid transition ${from} -> ${to}`, () => {
        assert.equal(canTransitionWarranty(from, to), false);
        assert.throws(
          () => assertValidWarrantyTransition(from, to),
          /invalid warranty state transition/i
        );
      });
    }
  });

  describe('JSON Schema Validation', () => {
    it('validates a correct timeline entry', () => {
      const entry = {
        status: 'RECEIVED',
        actorId: 'staff_1',
        actorRole: 'STAFF',
        timestamp: new Date().toISOString(),
        note: 'Đã nhận máy tại quầy kỹ thuật',
      };
      assert.equal(validateTimelineEntry(entry).valid, true);
    });

    it('rejects timeline entry with missing required fields', () => {
      const invalid = {
        status: 'RECEIVED',
        // missing actorId, actorRole, timestamp
      };
      const res = validateTimelineEntry(invalid);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /timeline entry/i);
    });

    it('validates evidence references array', () => {
      const evidence = [
        {
          type: 'IMAGE',
          url: 'https://images.example.com/evidence1.jpg',
          description: 'Màn hình bị sọc ngang',
          uploadedAt: new Date().toISOString(),
        },
      ];
      assert.equal(validateEvidenceRefs(evidence).valid, true);
    });

    it('rejects evidence with invalid URL or unrecognized type', () => {
      const invalid = [
        {
          type: 'EXECUTABLE',
          url: 'not-a-valid-url',
          uploadedAt: new Date().toISOString(),
        },
      ];
      const res = validateEvidenceRefs(invalid);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /evidence/i);
    });

    it('validates resolution outcome structure', () => {
      const validResolution = {
        outcome: 'REPAIRED',
        note: 'Đã thay thế cụm cáp màn hình',
        resolvedAt: new Date().toISOString(),
      };
      assert.equal(validateWarrantyResolution(validResolution).valid, true);
    });

    it('rejects resolution with unknown outcome', () => {
      const invalid = {
        outcome: 'UNKNOWN_OUTCOME',
      };
      const res = validateWarrantyResolution(invalid);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /resolution outcome/i);
    });
  });
});
