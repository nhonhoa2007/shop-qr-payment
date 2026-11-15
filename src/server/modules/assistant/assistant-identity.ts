import crypto from 'node:crypto';
import type { Principal } from '@shared/types/assistant';

const COOKIE_NAME = 'shop_assistant_session';
export function resolveAssistantIdentity(req: Request, session: { user?: { id?: string; role?: string } } | null): { principal: Principal; cookie?: string } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  if (session?.user?.id) return { principal: { userId: session.user.id, role: session.user.role || 'CUSTOMER', ip } };
  const stored = req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  const valid = stored && /^[a-f0-9]{64}$/.test(stored);
  const token = valid ? stored : crypto.randomBytes(32).toString('hex');
  return { principal: { anonymousTokenHash: crypto.createHash('sha256').update(token).digest('hex'), ip },
    ...(!valid ? { cookie: `${COOKIE_NAME}=${token}; Path=/api/assistant; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` } : {}) };
}
