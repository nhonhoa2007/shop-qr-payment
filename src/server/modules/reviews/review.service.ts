export interface ReviewSubmissionInput {
  rating?: unknown;
  comment?: unknown;
  images?: unknown;
  orderId?: unknown;
}

export interface ValidatedReviewSubmission {
  rating: number;
  comment: string | null;
  images: string[];
  orderId?: string;
}

export interface ReviewSubmissionValidationResult {
  valid: boolean;
  error?: string;
  data?: ValidatedReviewSubmission;
}

export interface OrderItemCandidate {
  productId: string;
}

export interface OrderCandidate {
  id: string;
  orderCode?: string;
  userId: string | null;
  status: string;
  createdAt: Date | string;
  items: OrderItemCandidate[];
}

export interface ReviewCandidate {
  orderId: string;
  productId?: string;
  userId?: string;
}

export interface OrderEligibilityResult {
  eligible: boolean;
  error?: string;
  statusCode?: number;
  selectedOrderId?: string;
  availableOrders?: Array<{ id: string; orderCode: string; createdAt: Date | string }>;
  alreadyReviewedAll?: boolean;
}

/**
 * Validate raw review submission payload from client
 */
export function validateReviewSubmissionInput(input: unknown): ReviewSubmissionValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'Dữ liệu gửi lên không hợp lệ' };
  }

  const raw = input as Record<string, unknown>;

  const ratingNum = typeof raw.rating === 'string' ? Number(raw.rating) : raw.rating;
  if (
    typeof ratingNum !== 'number' ||
    isNaN(ratingNum) ||
    ratingNum < 1 ||
    ratingNum > 5 ||
    !Number.isInteger(ratingNum)
  ) {
    return { valid: false, error: 'Điểm đánh giá không hợp lệ (phải từ 1 đến 5 sao)' };
  }

  let comment: string | null = null;
  if (typeof raw.comment === 'string') {
    const trimmed = raw.comment.trim();
    if (trimmed.length > 2000) {
      return { valid: false, error: 'Nội dung đánh giá không được vượt quá 2000 ký tự' };
    }
    comment = trimmed.length > 0 ? trimmed : null;
  }

  let images: string[] = [];
  if (Array.isArray(raw.images)) {
    images = raw.images.filter(
      (img): img is string => typeof img === 'string' && img.trim().length > 0
    );
  }

  let orderId: string | undefined = undefined;
  if (typeof raw.orderId === 'string' && raw.orderId.trim().length > 0) {
    orderId = raw.orderId.trim();
  }

  return {
    valid: true,
    data: {
      rating: ratingNum,
      comment,
      images,
      ...(orderId ? { orderId } : {}),
    },
  };
}

/**
 * Resolve order eligibility for review submission
 */
export function resolveReviewEligibility({
  userId,
  productId,
  userOrders,
  existingReviews,
  requestedOrderId,
}: {
  userId: string;
  productId: string;
  userOrders: OrderCandidate[];
  existingReviews: ReviewCandidate[];
  requestedOrderId?: string | null;
}): OrderEligibilityResult {
  if (!userId) {
    return { eligible: false, error: 'Unauthorized', statusCode: 401 };
  }

  const reviewedOrderIds = new Set(
    existingReviews
      .filter((r) => !r.productId || r.productId === productId)
      .map((r) => r.orderId)
  );

  if (requestedOrderId && requestedOrderId.trim().length > 0) {
    const targetId = requestedOrderId.trim();
    const order = userOrders.find((o) => o.id === targetId);

    if (!order) {
      return { eligible: false, error: 'Không tìm thấy đơn hàng tương ứng', statusCode: 404 };
    }

    if (order.userId !== userId) {
      return { eligible: false, error: 'Bạn không có quyền đánh giá đơn hàng này', statusCode: 403 };
    }

    if (order.status !== 'COMPLETED') {
      return { eligible: false, error: 'Đơn hàng phải ở trạng thái COMPLETED mới có thể đánh giá', statusCode: 400 };
    }

    const hasProduct = order.items.some((item) => item.productId === productId);
    if (!hasProduct) {
      return { eligible: false, error: 'Bạn chỉ có thể đánh giá sản phẩm đã mua trong đơn hàng này', statusCode: 403 };
    }

    if (reviewedOrderIds.has(targetId)) {
      return { eligible: false, error: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này', statusCode: 400 };
    }

    return {
      eligible: true,
      selectedOrderId: targetId,
    };
  }

  const completedOrders = userOrders.filter(
    (order) =>
      order.userId === userId &&
      order.status === 'COMPLETED' &&
      order.items.some((item) => item.productId === productId)
  );

  if (completedOrders.length === 0) {
    return {
      eligible: false,
      error: 'Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và hoàn thành đơn hàng',
      statusCode: 403,
    };
  }

  const unreviewedOrders = completedOrders.filter((order) => !reviewedOrderIds.has(order.id));

  if (unreviewedOrders.length === 0) {
    return {
      eligible: false,
      alreadyReviewedAll: true,
      error: 'Bạn đã đánh giá sản phẩm này cho tất cả đơn hàng đã mua',
      statusCode: 400,
    };
  }

  const sorted = [...unreviewedOrders].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeB - timeA;
  });

  return {
    eligible: true,
    selectedOrderId: sorted[0].id,
    availableOrders: sorted.map((o) => ({
      id: o.id,
      orderCode: o.orderCode || o.id,
      createdAt: o.createdAt,
    })),
  };
}

export interface ReviewModerationInput {
  id?: unknown;
  isApproved?: unknown;
  reply?: unknown;
}

export interface ReviewModerationResult {
  valid: boolean;
  error?: string;
  data?: {
    id: string;
    isApproved?: boolean;
    reply?: string | null;
  };
}

export function validateReviewModeration(input: unknown): ReviewModerationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' };
  }

  const raw = input as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null;

  if (!id) {
    return { valid: false, error: 'Thiếu ID đánh giá' };
  }

  let isApproved: boolean | undefined = undefined;
  if (typeof raw.isApproved === 'boolean') {
    isApproved = raw.isApproved;
  }

  let reply: string | null | undefined = undefined;
  if (typeof raw.reply === 'string') {
    reply = raw.reply.trim().length > 0 ? raw.reply.trim() : null;
  } else if (raw.reply === null) {
    reply = null;
  }

  if (isApproved === undefined && reply === undefined) {
    return { valid: false, error: 'Không có thông tin cần cập nhật (isApproved hoặc reply)' };
  }

  return {
    valid: true,
    data: {
      id,
      isApproved,
      reply,
    },
  };
}
