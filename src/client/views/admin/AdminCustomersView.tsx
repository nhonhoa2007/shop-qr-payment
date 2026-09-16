'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatVND, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils';
import {
  Users,
  Search,
  ShoppingBag,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  X,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface CustomerItem {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  role?: UserRole;
  isBlocked?: boolean;
  isVerified: boolean;
  createdAt: string;
  orderCount: number;
  paidOrderCount: number;
  totalSpent: number;
  recentOrders: {
    id: string;
    orderCode: string;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }[];
}

interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  confirmColor: 'red' | 'purple' | 'blue' | 'green';
  action: () => Promise<void>;
}

export function CustomerManager({ initialCustomers }: { initialCustomers: CustomerItem[] }) {
  const [customers, setCustomers] = useState<CustomerItem[]>(() =>
    initialCustomers.map((c) => ({
      ...c,
      role: c.role || 'CUSTOMER',
      isBlocked: c.isBlocked ?? false,
    }))
  );

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | UserRole>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'VERIFIED'>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  // Filter logic
  const filtered = customers.filter((c) => {
    // Role filter
    const userRole = c.role || 'CUSTOMER';
    if (filterRole !== 'ALL' && userRole !== filterRole) return false;

    // Status filter
    if (filterStatus === 'ACTIVE' && c.isBlocked) return false;
    if (filterStatus === 'BLOCKED' && !c.isBlocked) return false;
    if (filterStatus === 'VERIFIED' && !c.isVerified) return false;

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchEmail = c.email.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchAddress = c.address?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchAddress) return false;
    }

    return true;
  });

  // KPI Calculations
  const totalAccounts = customers.length;
  const totalCustomers = customers.filter((c) => (c.role || 'CUSTOMER') === 'CUSTOMER').length;
  const totalStaffAndAdmin = customers.filter((c) => c.role === 'ADMIN' || c.role === 'STAFF').length;
  const totalBlocked = customers.filter((c) => c.isBlocked).length;

  // Generic Update Handler (PATCH /api/admin/customers)
  const handleUpdate = async (
    userId: string,
    data: { role?: UserRole; isBlocked?: boolean; isVerified?: boolean },
    successMessage: string
  ) => {
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...data }),
      });

      const resData = await res.json();

      if (!res.ok) {
        toast.error(resData.error || 'Cập nhật thất bại');
        return false;
      }

      // Optimistically / immediately update local customer list
      setCustomers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? {
                ...item,
                ...(data.role !== undefined ? { role: data.role } : {}),
                ...(data.isBlocked !== undefined ? { isBlocked: data.isBlocked } : {}),
                ...(data.isVerified !== undefined ? { isVerified: data.isVerified } : {}),
              }
            : item
        )
      );

      // Also update selectedCustomer in modal if open
      if (selectedCustomer?.id === userId) {
        setSelectedCustomer((prev) =>
          prev
            ? {
                ...prev,
                ...(data.role !== undefined ? { role: data.role } : {}),
                ...(data.isBlocked !== undefined ? { isBlocked: data.isBlocked } : {}),
                ...(data.isVerified !== undefined ? { isVerified: data.isVerified } : {}),
              }
            : null
        );
      }

      toast.success(successMessage);
      return true;
    } catch {
      toast.error('Lỗi kết nối máy chủ khi thực hiện thao tác');
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  // Safe confirm helper
  const promptConfirm = (
    title: string,
    message: string,
    confirmText: string,
    confirmColor: 'red' | 'purple' | 'blue' | 'green',
    action: () => Promise<void>
  ) => {
    setConfirmDialog({
      title,
      message,
      confirmText,
      confirmColor,
      action: async () => {
        await action();
        setConfirmDialog(null);
      },
    });
  };

  // Role Change Confirmation
  const confirmChangeRole = (customer: CustomerItem, newRole: UserRole) => {
    if ((customer.role || 'CUSTOMER') === newRole) return;

    const roleLabels: Record<UserRole, string> = {
      CUSTOMER: 'Khách hàng',
      STAFF: 'Nhân viên vận hành',
      ADMIN: 'Quản trị viên (Admin)',
    };

    promptConfirm(
      'Thay đổi vai trò người dùng',
      `Bạn có chắc chắn muốn phân quyền tài khoản "${customer.name || customer.email}" thành "${roleLabels[newRole]}"?`,
      'Cập nhật vai trò',
      newRole === 'ADMIN' ? 'purple' : newRole === 'STAFF' ? 'blue' : 'green',
      async () => {
        await handleUpdate(customer.id, { role: newRole }, `Đã chuyển vai trò thành ${roleLabels[newRole]}`);
      }
    );
  };

  // Block/Unblock Confirmation
  const confirmToggleBlock = (customer: CustomerItem) => {
    const willBlock = !customer.isBlocked;
    if (willBlock) {
      promptConfirm(
        'Khóa tài khoản người dùng',
        `Bạn có chắc chắn muốn KHÓA tài khoản "${customer.name || customer.email}"? Tài khoản này sẽ bị chặn đăng nhập và ngừng mọi giao dịch ngay lập tức.`,
        'Xác nhận khóa tài khoản',
        'red',
        async () => {
          await handleUpdate(customer.id, { isBlocked: true }, 'Đã khóa tài khoản thành công');
        }
      );
    } else {
      promptConfirm(
        'Mở khóa tài khoản',
        `Mở khóa tài khoản cho "${customer.name || customer.email}"? Người dùng sẽ có thể đăng nhập và mua hàng lại bình thường.`,
        'Mở khóa tài khoản',
        'green',
        async () => {
          await handleUpdate(customer.id, { isBlocked: false }, 'Đã mở khóa tài khoản thành công');
        }
      );
    }
  };

  // Manual Email Verification Confirmation
  const confirmVerifyEmail = (customer: CustomerItem) => {
    if (customer.isVerified) return;
    promptConfirm(
      'Xác thực email thủ công',
      `Kích hoạt trạng thái "Đã xác thực OTP" cho tài khoản "${customer.email}" mà không cần gửi mã OTP xác nhận?`,
      'Xác thực ngay',
      'green',
      async () => {
        await handleUpdate(customer.id, { isVerified: true }, 'Đã xác thực tài khoản thành công');
      }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium">Người dùng & Phân quyền</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900">
            <Users className="w-7 h-7 text-indigo-600" />
            Quản lý Người dùng & Phân quyền Hệ thống
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Phân quyền vai trò (Admin / Staff / Customer), kiểm soát trạng thái khóa và xác thực tài khoản
          </p>
        </div>
      </div>

      {/* KPI Stats (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng số tài khoản</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalAccounts}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Khách hàng (Customer)</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{totalCustomers}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin & Nhân viên</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">{totalStaffAndAdmin}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tài khoản bị khóa</p>
            <h3 className="text-2xl font-bold text-red-600 mt-1">{totalBlocked}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Role Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as 'ALL' | UserRole)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="CUSTOMER">Khách hàng (Customer)</option>
              <option value="STAFF">Nhân viên (Staff)</option>
              <option value="ADMIN">Quản trị viên (Admin)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'BLOCKED' | 'VERIFIED')}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="BLOCKED">Đã bị khóa</option>
              <option value="VERIFIED">Đã xác minh OTP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">Không tìm thấy người dùng phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Người dùng</th>
                  <th className="py-3 px-4">Liên hệ</th>
                  <th className="py-3 px-4 text-center">Vai trò</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Xác thực OTP</th>
                  <th className="py-3 px-4 text-center">Đơn hàng</th>
                  <th className="py-3 px-4">Tổng chi tiêu</th>
                  <th className="py-3 px-4">Ngày tạo</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((customer) => {
                  const role = customer.role || 'CUSTOMER';
                  const isBlocked = !!customer.isBlocked;
                  const isBusy = updatingId === customer.id;

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50/50 transition">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                            {customer.name?.[0]?.toUpperCase() || customer.email[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{customer.name || 'Người dùng'}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="truncate max-w-[180px]" title={customer.email}>
                                {customer.email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Address */}
                      <td className="py-3 px-4">
                        <div className="text-xs space-y-1">
                          {customer.phone ? (
                            <div className="flex items-center gap-1 text-gray-700">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{customer.phone}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Chưa có SĐT</span>
                          )}
                          {customer.address && (
                            <div
                              className="flex items-center gap-1 text-gray-500 max-w-xs truncate"
                              title={customer.address}
                            >
                              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">{customer.address}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4 text-center">
                        {role === 'ADMIN' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        )}
                        {role === 'STAFF' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
                            <Shield className="w-3 h-3" />
                            Staff
                          </span>
                        )}
                        {role === 'CUSTOMER' && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-medium">
                            Khách hàng
                          </span>
                        )}
                      </td>

                      {/* Status Badge (Blocked / Active) */}
                      <td className="py-3 px-4 text-center">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Đã khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Hoạt động
                          </span>
                        )}
                      </td>

                      {/* OTP Verification */}
                      <td className="py-3 px-4 text-center">
                        {customer.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Đã xác minh
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Chưa xác minh
                          </span>
                        )}
                      </td>

                      {/* Orders */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-800">
                          <ShoppingBag className="w-3 h-3 text-gray-500" />
                          {customer.orderCount} đơn
                        </div>
                      </td>

                      {/* Total Spent */}
                      <td className="py-3 px-4 font-semibold text-indigo-600">
                        {formatVND(customer.totalSpent)}
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(customer.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Quick lock/unlock toggle button */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => confirmToggleBlock(customer)}
                            title={isBlocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            className={`p-1.5 rounded-lg border transition ${
                              isBlocked
                                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isBlocked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* View detail modal */}
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                          >
                            Chi tiết
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmDialog.confirmColor === 'red'
                    ? 'bg-red-100 text-red-600'
                    : confirmDialog.confirmColor === 'purple'
                    ? 'bg-purple-100 text-purple-600'
                    : confirmDialog.confirmColor === 'blue'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900">{confirmDialog.title}</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-6">{confirmDialog.message}</p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDialog.action}
                className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition ${
                  confirmDialog.confirmColor === 'red'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmDialog.confirmColor === 'purple'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : confirmDialog.confirmColor === 'blue'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail & RBAC Management Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Hồ sơ & Phân quyền Người dùng
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Summary Profile */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-lg">
                  {selectedCustomer.name?.[0]?.toUpperCase() || selectedCustomer.email[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 truncate">
                      {selectedCustomer.name || 'Người dùng'}
                    </h3>
                    {selectedCustomer.isBlocked && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                        ĐÃ KHÓA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{selectedCustomer.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedCustomer.phone || 'Chưa cập nhật SĐT'}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Tham gia: {formatDateTime(selectedCustomer.createdAt)}
                  </p>
                </div>
              </div>

              {/* SECTION: Phân quyền & Quản trị tài khoản */}
              <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Phân quyền & Kiểm soát tài khoản
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Vai trò hệ thống (Role)
                    </label>
                    <select
                      value={selectedCustomer.role || 'CUSTOMER'}
                      disabled={updatingId === selectedCustomer.id}
                      onChange={(e) => confirmChangeRole(selectedCustomer, e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="CUSTOMER">Khách hàng (Customer)</option>
                      <option value="STAFF">Nhân viên (Staff)</option>
                      <option value="ADMIN">Quản trị viên (Admin)</option>
                    </select>
                  </div>

                  {/* Account Lock/Unlock */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Trạng thái tài khoản
                    </label>
                    <button
                      type="button"
                      disabled={updatingId === selectedCustomer.id}
                      onClick={() => confirmToggleBlock(selectedCustomer)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                        selectedCustomer.isBlocked
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      }`}
                    >
                      {updatingId === selectedCustomer.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : selectedCustomer.isBlocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Mở khóa tài khoản</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Khóa tài khoản này</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Email Verification Action */}
                <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Xác thực OTP Email: </span>
                    {selectedCustomer.isVerified ? (
                      <span className="text-emerald-700 font-semibold">Đã xác minh</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Chưa xác minh</span>
                    )}
                  </div>

                  {!selectedCustomer.isVerified && (
                    <button
                      type="button"
                      disabled={updatingId === selectedCustomer.id}
                      onClick={() => confirmVerifyEmail(selectedCustomer)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Xác thực thủ công</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium">Tổng chi tiêu</p>
                  <p className="text-base font-bold text-indigo-700 mt-0.5">
                    {formatVND(selectedCustomer.totalSpent)}
                  </p>
                </div>
                <div className="p-3 bg-green-50/50 border border-green-100 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium">Đơn đã hoàn thành</p>
                  <p className="text-base font-bold text-green-700 mt-0.5">
                    {selectedCustomer.paidOrderCount} / {selectedCustomer.orderCount} đơn
                  </p>
                </div>
              </div>

              {/* Recent Orders List */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Đơn hàng gần nhất
                </h4>
                {selectedCustomer.recentOrders.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Người dùng chưa có đơn hàng nào.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs border border-gray-100"
                      >
                        <div>
                          <span className="font-bold text-gray-900">{order.orderCode}</span>
                          <span className="text-gray-400 ml-2">{formatDateTime(order.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{formatVND(order.totalAmount)}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CustomerManager as AdminCustomersView };
