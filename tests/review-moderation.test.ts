import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateReviewModeration } from '../src/lib/review-moderation.ts';

describe('Review Moderation Logic', () => {
  it('should reject invalid or non-object input', () => {
    const res1 = validateReviewModeration(null);
    assert.strictEqual(res1.valid, false);

    const res2 = validateReviewModeration('not-an-object');
    assert.strictEqual(res2.valid, false);
  });

  it('should reject when id is missing or empty', () => {
    const res = validateReviewModeration({ isApproved: true });
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /thiếu id/i);
  });

  it('should reject when neither isApproved nor reply is provided', () => {
    const res = validateReviewModeration({ id: 'review_123' });
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /không có thông tin/i);
  });

  it('should accept valid isApproved toggle', () => {
    const resTrue = validateReviewModeration({ id: 'review_123', isApproved: true });
    assert.strictEqual(resTrue.valid, true);
    assert.strictEqual(resTrue.data?.id, 'review_123');
    assert.strictEqual(resTrue.data?.isApproved, true);

    const resFalse = validateReviewModeration({ id: 'review_123', isApproved: false });
    assert.strictEqual(resFalse.valid, true);
    assert.strictEqual(resFalse.data?.isApproved, false);
  });

  it('should accept valid reply text or null to clear reply', () => {
    const resReply = validateReviewModeration({
      id: 'review_456',
      reply: '  Cảm ơn bạn đã ủng hộ shop!  ',
    });
    assert.strictEqual(resReply.valid, true);
    assert.strictEqual(resReply.data?.reply, 'Cảm ơn bạn đã ủng hộ shop!');

    const resClear = validateReviewModeration({
      id: 'review_456',
      reply: null,
    });
    assert.strictEqual(resClear.valid, true);
    assert.strictEqual(resClear.data?.reply, null);
  });
});
