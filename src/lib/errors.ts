export function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống'): string {
  return error instanceof Error ? error.message : fallback;
}
