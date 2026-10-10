import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateReviewSubmissionInput,
  resolveReviewEligibility,
  type OrderCandidate,
  type ReviewCandidate, } from '@server/modules/reviews/review.service';

describe('Review Submission DTO Validation', () => {
  it('should reject non-object or null input', () => {
    const res1 = validateReviewSubmissionInput(null);
    assert.strictEqual(res1.valid, false);

    const res2 = validateReviewSubmissionInput('invalid');
    assert.strictEqual(res2.valid, false);

    const res3 = validateReviewSubmissionInput([1, 2, 3]);
    assert.strictEqual(res3.valid, false);
  });

  it('should reject missing or invalid rating', () => {
    const resEmpty = validateReviewSubmissionInput({});
    assert.strictEqual(resEmpty.valid, false);

    const resZero = validateReviewSubmissionInput({ rating: 0 });
    assert.strictEqual(resZero.valid, false);

    const resOver = validateReviewSubmissionInput({ rating: 6 });
    assert.strictEqual(resOver.valid, false);

    const resFloat = validateReviewSubmissionInput({ rating: 4.5 });
    assert.strictEqual(resFloat.valid, false);

    const resStringInvalid = validateReviewSubmissionInput({ rating: 'five' });
    assert.strictEqual(resStringInvalid.valid, false);
  });

  it('should accept valid rating (1-5) and normalize string numbers', () => {
    const res1 = validateReviewSubmissionInput({ rating: 5 });
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.data?.rating, 5);

    const resString = validateReviewSubmissionInput({ rating: '4' });
    assert.strictEqual(resString.valid, true);
    assert.strictEqual(resString.data?.rating, 4);
  });

  it('should sanitize comment and trim whitespace', () => {
    const res1 = validateReviewSubmissionInput({
      rating: 5,
      comment: '  Sản phẩm rất đẹp và chất lượng!  ',
    });
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.data?.comment, 'Sản phẩm rất đẹp và chất lượng!');

    const resEmptyComment = validateReviewSubmissionInput({
      rating: 5,
      comment: '   ',
    });
    assert.strictEqual(resEmptyComment.valid, true);
    assert.strictEqual(resEmptyComment.data?.comment, null);
  });

  it('should reject comment exceeding max character limit', () => {
    const longComment = 'a'.repeat(2001);
    const res = validateReviewSubmissionInput({
      rating: 5,
      comment: longComment,
    });
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /2000 ký tự/);
  });

  it('should handle optional orderId correctly', () => {
    const resWithoutOrder = validateReviewSubmissionInput({
      rating: 5,
      comment: 'Tốt',
    });
    assert.strictEqual(resWithoutOrder.valid, true);
    assert.strictEqual(resWithoutOrder.data?.orderId, undefined);

    const resWithOrder = validateReviewSubmissionInput({
      rating: 5,
      orderId: 'order_123',
    });
    assert.strictEqual(resWithOrder.valid, true);
    assert.strictEqual(resWithOrder.data?.orderId, 'order_123');

    const resWithEmptyOrder = validateReviewSubmissionInput({
      rating: 5,
      orderId: '   ',
    });
    assert.strictEqual(resWithEmptyOrder.valid, true);
    assert.strictEqual(resWithEmptyOrder.data?.orderId, undefined);
  });
});

describe('Review Order Resolution & Eligibility', () => {
  const userId = 'user_1';
  const productId = 'prod_100';

  const sampleOrders: OrderCandidate[] = [
    {
      id: 'order_comp_1',
      orderCode: 'DH1001',
      userId: 'user_1',
      status: 'COMPLETED',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      items: [{ productId: 'prod_100' }, { productId: 'prod_200' }],
    },
    {
      id: 'order_comp_2',
      orderCode: 'DH1002',
      userId: 'user_1',
      status: 'COMPLETED',
      createdAt: new Date('2026-03-10T10:00:00Z'),
      items: [{ productId: 'prod_100' }],
    },
    {
      id: 'order_pending',
      orderCode: 'DH1003',
      userId: 'user_1',
      status: 'PENDING',
      createdAt: new Date('2026-03-15T10:00:00Z'),
      items: [{ productId: 'prod_100' }],
    },
    {
      id: 'order_other_user',
      orderCode: 'DH9999',
      userId: 'user_2',
      status: 'COMPLETED',
      createdAt: new Date('2026-03-20T10:00:00Z'),
      items: [{ productId: 'prod_100' }],
    },
  ];

  it('should auto-resolve to newest COMPLETED unreviewed order when orderId is omitted', () => {
    const existingReviews: ReviewCandidate[] = [];

    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews,
    });

    assert.strictEqual(res.eligible, true);
    // Newest is order_comp_2 (2026-03-10 vs 2026-03-01)
    assert.strictEqual(res.selectedOrderId, 'order_comp_2');
    assert.strictEqual(res.availableOrders?.length, 2);
  });

  it('should auto-resolve to remaining unreviewed COMPLETED order if one order was already reviewed', () => {
    const existingReviews: ReviewCandidate[] = [
      { orderId: 'order_comp_2', productId, userId },
    ];

    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews,
    });

    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.selectedOrderId, 'order_comp_1');
    assert.strictEqual(res.availableOrders?.length, 1);
  });

  it('should reject auto-resolution if user has already reviewed all completed orders', () => {
    const existingReviews: ReviewCandidate[] = [
      { orderId: 'order_comp_1', productId, userId },
      { orderId: 'order_comp_2', productId, userId },
    ];

    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews,
    });

    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.alreadyReviewedAll, true);
    assert.match(res.error || '', /tất cả đơn hàng/);
  });

  it('should reject auto-resolution if user has never completed an order for this product', () => {
    const unpurchasedProductId = 'prod_unpurchased';

    const res = resolveReviewEligibility({
      userId,
      productId: unpurchasedProductId,
      userOrders: sampleOrders,
      existingReviews: [],
    });

    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || '', /sau khi đã mua và hoàn thành/);
  });

  it('should validate and accept explicitly requested valid orderId', () => {
    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews: [],
      requestedOrderId: 'order_comp_1',
    });

    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.selectedOrderId, 'order_comp_1');
  });

  it('should reject explicit orderId if order does not exist', () => {
    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews: [],
      requestedOrderId: 'order_non_existent',
    });

    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.statusCode, 404);
  });

  it('should reject explicit orderId if order belongs to another user', () => {
    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews: [],
      requestedOrderId: 'order_other_user',
    });

    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || '', /không có quyền/);
  });

  it('should reject explicit orderId if order is not COMPLETED (e.g. PENDING)', () => {
    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews: [],
      requestedOrderId: 'order_pending',
    });

    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.error || '', /COMPLETED/);
  });

  it('should reject explicit orderId if order already has a review for this product', () => {
    const existingReviews: ReviewCandidate[] = [
      { orderId: 'order_comp_1', productId, userId },
    ];

    const res = resolveReviewEligibility({
      userId,
      productId,
      userOrders: sampleOrders,
      existingReviews,
      requestedOrderId: 'order_comp_1',
    });

    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.error || '', /đã đánh giá sản phẩm này trong đơn hàng này/);
  });
});
