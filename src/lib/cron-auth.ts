/**
 * Verifies if an incoming request is authorized to execute cron jobs.
 * Supports:
 * 1. Authorization header: "Bearer <CRON_SECRET>"
 * 2. URL query param: "?secret=<CRON_SECRET>"
 *
 * If CRON_SECRET is not configured in the environment, it returns true (dev / unconfigured fallback).
 */
export function verifyCronAuth(
  req: Request,
  cronSecret: string | undefined = process.env.CRON_SECRET
): boolean {
  if (!cronSecret) {
    return true;
  }

  // 1. Check Authorization: Bearer <secret>
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === cronSecret) {
      return true;
    }
  }

  // 2. Check query param: ?secret=<secret>
  try {
    const url = new URL(req.url, 'http://localhost');
    const querySecret = url.searchParams.get('secret');
    if (querySecret && querySecret === cronSecret) {
      return true;
    }
  } catch {
    // If URL parsing fails, continue to deny access
  }

  return false;
}
