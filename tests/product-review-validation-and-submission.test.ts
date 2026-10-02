import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReviewSubmissionInput,
  resolveReviewEligibility,
  type OrderCandidate,
  type ReviewCandidate,
} from '../src/lib/review-submission.ts';

// Helper mô phỏng cách tính toán điểm trung bình trong ProductReviews Controller
function calculateAverageRating(reviews: Array<{ rating: number }>): { avgRating: number; total: number } {
  const total = reviews.length;
  if (total === 0) return { avgRating: 0, total: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avgRating = Number((sum / total).toFixed(1));
  return { avgRating, total };
}

describe('Product Review - Validation & Boundary Testing (Pillar 2)', () => {
  it('should reject invalid, null, undefined or non-object payloads', () => {
    assert.equal(validateReviewSubmissionInput(null).valid, false);
    assert.equal(validateReviewSubmissionInput(undefined).valid, false);
    assert.equal(validateReviewSubmissionInput('plain-text').valid, false);
    assert.equal(validateReviewSubmissionInput(12345).valid, false);
    assert.equal(validateReviewSubmissionInput([]).valid, false);
    assert.equal(validateReviewSubmissionInput(true).valid, false);
  });

  it('should strictly reject invalid rating boundaries (min 1, max 5, integer only)', () => {
    // Giá trị âm hoặc 0
    assert.equal(validateReviewSubmissionInput({ rating: 0 }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: -1 }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: -99 }).valid, false);

    // Giá trị vượt quá 5 sao
    assert.equal(validateReviewSubmissionInput({ rating: 6 }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: 100 }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: Number.MAX_SAFE_INTEGER }).valid, false);

    // Số thực thập phân không hợp lệ
    assert.equal(validateReviewSubmissionInput({ rating: 4.5 }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: 3.14159 }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: 0.999 }).valid, false);

    // NaN và Infinity
    assert.equal(validateReviewSubmissionInput({ rating: Number.NaN }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: Number.POSITIVE_INFINITY }).valid, false);

    // Chuỗi chữ không thể parse
    assert.equal(validateReviewSubmissionInput({ rating: 'five-stars' }).valid, false);
    assert.equal(validateReviewSubmissionInput({ rating: '' }).valid, false);
  });

  it('should accept and normalize valid ratings (1, 2, 3, 4, 5) both numeric and string-encoded', () => {
    for (let r = 1; r <= 5; r++) {
      const numRes = validateReviewSubmissionInput({ rating: r });
      assert.equal(numRes.valid, true);
      assert.equal(numRes.data?.rating, r);

      const strRes = validateReviewSubmissionInput({ rating: String(r) });
      assert.equal(strRes.valid, true);
      assert.equal(strRes.data?.rating, r);
    }
  });

  it('should enforce comment length boundaries and trim whitespaces', () => {
    // Chuỗi rỗng hoặc chỉ có khoảng trắng -> chuẩn hóa về null
    const emptyRes = validateReviewSubmissionInput({ rating: 5, comment: '   \n\t   ' });
    assert.equal(emptyRes.valid, true);
    assert.equal(emptyRes.data?.comment, null);

    // Comment hợp lệ chuẩn
    const normalRes = validateReviewSubmissionInput({
      rating: 5,
      comment: '  Chất lượng vải rất tốt, đóng gói kỹ càng.  ',
    });
    assert.equal(normalRes.valid, true);
    assert.equal(normalRes.data?.comment, 'Chất lượng vải rất tốt, đóng gói kỹ càng.');

    // Biên chuẩn: Đúng 2000 ký tự -> hợp lệ
    const maxBoundaryComment = 'A'.repeat(2000);
    const validMaxRes = validateReviewSubmissionInput({ rating: 5, comment: maxBoundaryComment });
    assert.equal(validMaxRes.valid, true);
    assert.equal(validMaxRes.data?.comment?.length, 2000);

    // Vượt biên: 2001 ký tự -> Bị từ chối
    const overBoundaryComment = 'A'.repeat(2001);
    const overRes = validateReviewSubmissionInput({ rating: 5, comment: overBoundaryComment });
    assert.equal(overRes.valid, false);
    assert.match(overRes.error || '', /2000 ký tự/);
  });

  it('should safely handle adversarial inputs: script tags, unicode, emojis, SQL strings', () => {
    const adversarialPayload = {
      rating: 5,
      comment: '<script>alert("xss")</script> "><img src=x onerror=alert(1)> DROP TABLE reviews; 🚀🔥🌟',
    };
    const res = validateReviewSubmissionInput(adversarialPayload);
    assert.equal(res.valid, true);
    assert.equal(res.data?.comment, adversarialPayload.comment);
  });

  it('should sanitize and filter image URL array', () => {
    const res = validateReviewSubmissionInput({
      rating: 4,
      images: [
        'https://res.cloudinary.com/demo/image1.jpg',
        '   ',
        '',
        123,
        null,
        'https://res.cloudinary.com/demo/image2.jpg',
      ],
    });
    assert.equal(res.valid, true);
    assert.deepEqual(res.data?.images, [
      'https://res.cloudinary.com/demo/image1.jpg',
      'https://res.cloudinary.com/demo/image2.jpg',
    ]);
  });

  it('should normalize orderId parameter correctly', () => {
    const withOrder = validateReviewSubmissionInput({ rating: 5, orderId: '  order_uuid_123  ' });
    assert.equal(withOrder.valid, true);
    assert.equal(withOrder.data?.orderId, 'order_uuid_123');

    const emptyOrder = validateReviewSubmissionInput({ rating: 5, orderId: '   ' });
    assert.equal(emptyOrder.valid, true);
    assert.equal(emptyOrder.data?.orderId, undefined);
  });
});

describe('Product Review - Order Eligibility & Authorization Gating (Pillar 1 & 4)', () => {
  const currentUserId = 'user_customer_01';
  const targetProductId = 'prod_vietnam_silk';

  const mockOrders: OrderCandidate[] = [
    {
      id: 'ord_completed_old',
      orderCode: 'DH1001',
      userId: currentUserId,
      status: 'COMPLETED',
      createdAt: new Date('2026-03-01T08:00:00Z'),
      items: [{ productId: targetProductId }],
    },
    {
      id: 'ord_completed_newest',
      orderCode: 'DH1002',
      userId: currentUserId,
      status: 'COMPLETED',
      createdAt: new Date('2026-03-15T12:00:00Z'),
      items: [{ productId: targetProductId }, { productId: 'other_prod' }],
    },
    {
      id: 'ord_pending',
      orderCode: 'DH1003',
      userId: currentUserId,
      status: 'PENDING',
      createdAt: new Date('2026-03-20T10:00:00Z'),
      items: [{ productId: targetProductId }],
    },
    {
      id: 'ord_other_user',
      orderCode: 'DH1004',
      userId: 'user_stranger_99',
      status: 'COMPLETED',
      createdAt: new Date('2026-03-21T10:00:00Z'),
      items: [{ productId: targetProductId }],
    },
  ];

  it('should require authenticated userId (fail-closed 401)', () => {
    const res = resolveReviewEligibility({
      userId: '',
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews: [],
    });
    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 401);
  });

  it('should auto-select the NEWEST unreviewed COMPLETED order when orderId is omitted', () => {
    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews: [],
    });

    assert.equal(res.eligible, true);
    assert.equal(res.selectedOrderId, 'ord_completed_newest');
    assert.ok(res.availableOrders);
    assert.equal(res.availableOrders.length, 2);
    assert.equal(res.availableOrders[0].id, 'ord_completed_newest');
    assert.equal(res.availableOrders[1].id, 'ord_completed_old');
  });

  it('should auto-select the remaining older COMPLETED order if the newest was already reviewed', () => {
    const existingReviews: ReviewCandidate[] = [
      { orderId: 'ord_completed_newest', productId: targetProductId, userId: currentUserId },
    ];

    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews,
    });

    assert.equal(res.eligible, true);
    assert.equal(res.selectedOrderId, 'ord_completed_old');
    assert.equal(res.availableOrders?.length, 1);
  });

  it('should block review with 400 when all eligible COMPLETED orders have been reviewed', () => {
    const existingReviews: ReviewCandidate[] = [
      { orderId: 'ord_completed_newest', productId: targetProductId },
      { orderId: 'ord_completed_old', productId: targetProductId },
    ];

    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews,
    });

    assert.equal(res.eligible, false);
    assert.equal(res.alreadyReviewedAll, true);
    assert.equal(res.statusCode, 400);
    assert.match(res.error || '', /tất cả đơn hàng đã mua/);
  });

  it('should reject with 403 when user has never completed an order for this product', () => {
    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: 'prod_unpurchased',
      userOrders: mockOrders,
      existingReviews: [],
    });

    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.error || '', /sau khi đã mua và hoàn thành/);
  });

  it('should validate explicit requestedOrderId: accept valid completed order containing product', () => {
    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews: [],
      requestedOrderId: 'ord_completed_old',
    });

    assert.equal(res.eligible, true);
    assert.equal(res.selectedOrderId, 'ord_completed_old');
  });

  it('should reject requestedOrderId if order does not exist in user orders (404)', () => {
    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews: [],
      requestedOrderId: 'non_existent_order_id',
    });

    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 404);
  });

  it('should reject requestedOrderId if order belongs to another customer (403)', () => {
    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews: [],
      requestedOrderId: 'ord_other_user',
    });

    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.error || '', /không có quyền đánh giá/);
  });

  it('should reject requestedOrderId if order is not in COMPLETED state (400)', () => {
    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews: [],
      requestedOrderId: 'ord_pending',
    });

    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.error || '', /trạng thái COMPLETED/);
  });

  it('should reject requestedOrderId if order does not contain the specified product (403)', () => {
    const orderWithoutTarget: OrderCandidate = {
      id: 'ord_different_item',
      userId: currentUserId,
      status: 'COMPLETED',
      createdAt: new Date(),
      items: [{ productId: 'different_product_uuid' }],
    };

    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: [orderWithoutTarget],
      existingReviews: [],
      requestedOrderId: 'ord_different_item',
    });

    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.error || '', /đã mua trong đơn hàng này/);
  });

  it('should reject requestedOrderId if this specific order was already reviewed (400)', () => {
    const existingReviews: ReviewCandidate[] = [
      { orderId: 'ord_completed_newest', productId: targetProductId },
    ];

    const res = resolveReviewEligibility({
      userId: currentUserId,
      productId: targetProductId,
      userOrders: mockOrders,
      existingReviews,
      requestedOrderId: 'ord_completed_newest',
    });

    assert.equal(res.eligible, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.error || '', /đã đánh giá sản phẩm này trong đơn hàng này/);
  });
});

describe('Product Review - Average Rating Calculation & Stats (Pillar 1 & 4)', () => {
  it('should calculate 0 rating when review list is empty', () => {
    const result = calculateAverageRating([]);
    assert.equal(result.total, 0);
    assert.equal(result.avgRating, 0);
  });

  it('should calculate accurate average rating rounded to 1 decimal place', () => {
    // 5 + 4 = 9 / 2 = 4.5
    assert.deepEqual(calculateAverageRating([{ rating: 5 }, { rating: 4 }]), {
      total: 2,
      avgRating: 4.5,
    });

    // 5 + 5 + 4 = 14 / 3 = 4.6666... -> 4.7
    assert.deepEqual(calculateAverageRating([{ rating: 5 }, { rating: 5 }, { rating: 4 }]), {
      total: 3,
      avgRating: 4.7,
    });

    // 5 + 4 + 4 = 13 / 3 = 4.3333... -> 4.3
    assert.deepEqual(calculateAverageRating([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), {
      total: 3,
      avgRating: 4.3,
    });

    // 1 star review
    assert.deepEqual(calculateAverageRating([{ rating: 1 }]), {
      total: 1,
      avgRating: 1.0,
    });
  });
});
