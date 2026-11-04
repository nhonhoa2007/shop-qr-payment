export interface AdminPageUser {
  role?: string;
  permissions?: readonly string[];
}

const STAFF_PAGE_PERMISSIONS: Record<string, string> = {
  orders: 'orders',
  products: 'products',
  shipments: 'shipments',
  chat: 'chat',
  reviews: 'reviews',
  warranties: 'warranties',
  returns: 'warranties',
};

export function canAccessAdminPage(user: AdminPageUser | null | undefined, pathname: string): boolean {
  if (!user || !['ADMIN', 'STAFF'].includes(user.role ?? '')) return false;
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return false;
  if (user.role === 'ADMIN') return true;
  if (pathname === '/admin') return true;

  const section = pathname.slice('/admin/'.length).split(/[/?#]/, 1)[0];
  const permission = STAFF_PAGE_PERMISSIONS[section];
  return Boolean(permission && user.permissions?.includes(permission));
}

export function canUseAdminOnlyAction(role: string | undefined): boolean {
  return role === 'ADMIN';
}
