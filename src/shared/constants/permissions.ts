export const STAFF_PERMISSIONS = [
  'orders',
  'products',
  'shipments',
  'chat',
  'reviews',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  orders: 'Quản lý đơn hàng',
  products: 'Quản lý sản phẩm & kho',
  shipments: 'Quản lý vận đơn',
  chat: 'Chat CSKH',
  reviews: 'Quản lý đánh giá',
};

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === 'string' && (STAFF_PERMISSIONS as readonly string[]).includes(value);
}
