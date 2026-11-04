import { canAccessAdminPage, type AdminPageUser } from '@shared/admin-page-access';

export function getAdminSearchDestination(query: string, user: AdminPageUser): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const canSearchOrders = canAccessAdminPage(user, '/admin/orders');
  const canSearchProducts = canAccessAdminPage(user, '/admin/products');
  if (!canSearchOrders && !canSearchProducts) return null;

  const orderLike = /^(DH|\d{4,})/i.test(trimmed);
  if (canSearchOrders && (orderLike || !canSearchProducts)) {
    return `/admin/orders?q=${encodeURIComponent(trimmed)}`;
  }
  return `/admin/products?search=${encodeURIComponent(trimmed)}`;
}

export function initialAdminSearchQuery(params: { q?: string | string[]; search?: string | string[] }): string {
  const value = params.q ?? params.search;
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}
