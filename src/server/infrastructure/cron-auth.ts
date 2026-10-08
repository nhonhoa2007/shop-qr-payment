import crypto from "node:crypto";

export function verifyCronAuth(
  req: Request,
  cronSecret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!cronSecret || cronSecret.trim() === "") {
    return false;
  }

  const safeCompare = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  // 1. Check Authorization: Bearer ***
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (safeCompare(token, cronSecret)) {
      return true;
    }
  }

  // 2. Check query param: ?secret=[secret]
  try {
    const url = new URL(req.url, "http://localhost");
    const querySecret = url.searchParams.get("secret");
    if (querySecret && safeCompare(querySecret, cronSecret)) {
      return true;
    }
  } catch {
    // If URL parsing fails, continue to deny access
  }

  return false;
}
