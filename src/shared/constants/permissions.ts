export const STAFF_PERMISSIONS = [
  'orders',
  'products',
  'shipments',
  'chat',
  'reviews',
  'inventory',
  'warranties',
  'knowledge',
  'scoring',
  'assistant',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  orders: 'Quản lý đơn hàng',
  products: 'Quản lý sản phẩm & danh mục',
  shipments: 'Quản lý vận đơn',
  chat: 'Chat CSKH',
  reviews: 'Quản lý đánh giá',
  inventory: 'Quản lý kho & nhập hàng',
  warranties: 'Quản lý bảo hành & đổi trả',
  knowledge: 'Quản lý tri thức & nguồn dữ liệu',
  scoring: 'Quản lý công thức đánh giá & P/P',
  assistant: 'Giám sát trợ lý AI',
};

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === 'string' && (STAFF_PERMISSIONS as readonly string[]).includes(value);
}
