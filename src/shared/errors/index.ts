export class AppError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public errors?: Record<string, string> | string[];

  constructor(message = 'Dữ liệu không hợp lệ', errors?: Record<string, string> | string[]) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class AuthError extends AppError {
  constructor(message = 'Chưa xác thực hoặc không có quyền truy cập', statusCode = 401) {
    super(message, statusCode, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống'): string {
  return error instanceof Error ? error.message : fallback;
}
