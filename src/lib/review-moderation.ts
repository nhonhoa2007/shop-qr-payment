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
