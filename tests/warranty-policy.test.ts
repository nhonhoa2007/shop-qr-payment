import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWarrantyTerms,
  validateWarrantyConfig,
} from '@server/modules/warranties/warranty-policy';
import type { WarrantyPolicyConfig, WarrantySnapshot } from '@shared/types/warranty';

describe('Warranty Policy - Resolution & Validation', () => {
  const completedAt = new Date('2026-01-15T10:00:00.000Z');

  describe('resolveWarrantyTerms', () => {
    it('defaults laptop to 12 calendar months when no policy override is provided', () => {
      const terms = resolveWarrantyTerms({ productKind: 'LAPTOP' }, completedAt);

      assert.equal(terms.periodMonths, 12);
      assert.equal(terms.coverageType, 'MANUFACTURER');
      assert.equal(terms.requiresManualReview, false);
      assert.equal(terms.requiresSerial, true);
      assert.equal(terms.startDate.toISOString(), completedAt.toISOString());

      // 12 months after 2026-01-15 is 2027-01-15
      assert.equal(terms.endDate.getFullYear(), 2027);
      assert.equal(terms.endDate.getMonth(), 0); // January
      assert.equal(terms.endDate.getDate(), 15);
      assert.ok(terms.exclusions.length > 0);
    });

    it('defaults phone to 12 calendar months when no policy override is provided', () => {
      const terms = resolveWarrantyTerms({ productKind: 'PHONE' }, completedAt);

      assert.equal(terms.periodMonths, 12);
      assert.equal(terms.coverageType, 'MANUFACTURER');
      assert.equal(terms.requiresManualReview, false);
      assert.equal(terms.requiresSerial, true);
      assert.equal(terms.endDate.getFullYear(), 2027);
    });

    it('flags accessory without snapshot/policy as requiring manual review', () => {
      const terms = resolveWarrantyTerms({ productKind: 'ACCESSORY' }, completedAt);

      assert.equal(terms.periodMonths, 0);
      assert.equal(terms.requiresManualReview, true);
      assert.equal(terms.coverageType, 'UNKNOWN');
      assert.equal(terms.requiresSerial, false);
    });

    it('honors accessory with explicit snapshot configuration', () => {
      const snapshot: WarrantySnapshot = {
        productKind: 'ACCESSORY',
        policy: {
          type: 'SHOP',
          periodMonths: 6,
          coverageTerms: 'Bảo hành 1 đổi 1 trong 6 tháng',
          exclusions: ['Rách đứt cáp', 'Cháy nổ do nguồn điện không ổn định'],
          requiresSerial: false,
        },
      };

      const terms = resolveWarrantyTerms(snapshot, completedAt);

      assert.equal(terms.periodMonths, 6);
      assert.equal(terms.coverageType, 'SHOP');
      assert.equal(terms.requiresManualReview, false);
      assert.equal(terms.requiresSerial, false);
      // 6 months after 2026-01-15 is 2026-07-15
      assert.equal(terms.endDate.getMonth(), 6); // July
      assert.deepEqual(terms.exclusions, ['Rách đứt cáp', 'Cháy nổ do nguồn điện không ổn định']);
    });

    it('honors SKU/variant warranty override over product kind default', () => {
      const snapshot: WarrantySnapshot = {
        productKind: 'LAPTOP',
        policy: {
          type: 'EXTENDED',
          periodMonths: 36,
          coverageTerms: 'Gói bảo hành vàng 36 tháng chính hãng',
          exclusions: ['Rơi vỡ', 'Vào nước'],
          requiresSerial: true,
        },
      };

      const terms = resolveWarrantyTerms(snapshot, completedAt);

      assert.equal(terms.periodMonths, 36);
      assert.equal(terms.coverageType, 'EXTENDED');
      assert.equal(terms.endDate.getFullYear(), 2029);
      assert.equal(terms.requiresManualReview, false);
    });

    it('correctly calculates isExpired based on reference evaluation date', () => {
      const terms = resolveWarrantyTerms({ productKind: 'LAPTOP' }, completedAt);

      // Within warranty period (2026-06-01)
      const duringWarranty = new Date('2026-06-01T00:00:00.000Z');
      assert.equal(terms.isExpiredAt(duringWarranty), false);

      // Exactly on end date (2027-01-15T10:00:00.000Z) -> valid
      assert.equal(terms.isExpiredAt(terms.endDate), false);

      // After end date (2027-01-16T00:00:00.000Z) -> expired
      const afterWarranty = new Date('2027-01-16T00:00:00.000Z');
      assert.equal(terms.isExpiredAt(afterWarranty), true);
    });
  });

  describe('validateWarrantyConfig', () => {
    it('validates correct policy config', () => {
      const valid: WarrantyPolicyConfig = {
        type: 'MANUFACTURER',
        periodMonths: 12,
        coverageTerms: 'Chính hãng',
        exclusions: ['Vào nước'],
        requiresSerial: true,
      };

      const res = validateWarrantyConfig(valid);
      assert.equal(res.valid, true);
    });

    it('rejects negative or non-integer periodMonths', () => {
      const invalid = {
        type: 'MANUFACTURER',
        periodMonths: -5,
      };

      const res = validateWarrantyConfig(invalid);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /periodMonths/i);
    });
  });
});
