import type React from 'react';
import { canAccessAdminPage } from '@shared/admin-page-access';
import {
  LayoutDashboard, Package, Truck, Boxes, CreditCard, Tag, Users,
  Star, MessageSquare, ShieldCheck, RotateCcw, History,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { title: 'Tổng quan', items: [
    { name: 'Bảng điều khiển', href: '/admin', icon: LayoutDashboard, exact: true },
  ] },
  { title: 'Bán hàng & Kho', items: [
    { name: 'Đơn hàng', href: '/admin/orders', icon: Package },
    { name: 'Vận đơn GHN', href: '/admin/shipments', icon: Truck },
    { name: 'Sản phẩm & Biến thể', href: '/admin/products', icon: Boxes },
  ] },
  { title: 'Tài chính & Ưu đãi', items: [
    { name: 'Đối soát VietQR', href: '/admin/transactions', icon: CreditCard },
    { name: 'Mã giảm giá (Coupon)', href: '/admin/coupons', icon: Tag },
  ] },
  { title: 'Khách hàng & CSKH', items: [
    { name: 'Khách hàng & RBAC', href: '/admin/customers', icon: Users },
    { name: 'Tin nhắn trực tuyến', href: '/admin/chat', icon: MessageSquare },
    { name: 'Đánh giá sản phẩm', href: '/admin/reviews', icon: Star },
  ] },
  { title: 'Hậu mãi & Kiểm định', items: [
    { name: 'Hồ sơ bảo hành', href: '/admin/warranties', icon: ShieldCheck },
    { name: 'Yêu cầu đổi trả', href: '/admin/returns', icon: RotateCcw },
    { name: 'Nhật ký kiểm toán', href: '/admin/audit-logs', icon: History },
  ] },
];

export function getVisibleAdminNavGroups(role?: string, permissions: readonly string[] = []): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessAdminPage({ role, permissions }, item.href)),
  })).filter((group) => group.items.length > 0);
}

export function isAdminNavItemActive(pathname: string, href: string, exact = false): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
