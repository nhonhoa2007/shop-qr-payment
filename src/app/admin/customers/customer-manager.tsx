'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatVND, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils';
import {
  Users,
  Search,
  ShoppingBag,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  X,
} from 'lucide-react';

export interface CustomerItem {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
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

export function CustomerManager({ initialCustomers }: { initialCustomers: CustomerItem[] }) {
  const [customers] = useState<CustomerItem[]>(initialCustomers);
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  const filtered = customers.filter((c) => {
    if (filterVerified === 'VERIFIED' && !c.isVerified) return false;
    if (filterVerified === 'UNVERIFIED' && c.isVerified) return false;

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

  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div>
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium">Khách hàng</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Quản lý Khách hàng & Thành viên
          </h1>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng số khách hàng</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{customers.length}</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đã xác minh Email OTP</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">
            {customers.filter((c) => c.isVerified).length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng giá trị chi tiêu (LTV)</p>
          <h3 className="text-2xl font-bold text-indigo-600 mt-1">{formatVND(totalSpentAll)}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT, địa chỉ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value as 'ALL' | 'VERIFIED' | 'UNVERIFIED')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">Tất cả tài khoản</option>
            <option value="VERIFIED">Đã xác minh OTP</option>
            <option value="UNVERIFIED">Chưa xác minh</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">Không tìm thấy khách hàng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Liên hệ & Địa chỉ</th>
                  <th className="py-3 px-4 text-center">Xác thực OTP</th>
                  <th className="py-3 px-4 text-center">Đơn hàng</th>
                  <th className="py-3 px-4">Tổng chi tiêu</th>
                  <th className="py-3 px-4">Ngày đăng ký</th>
                  <th className="py-3 px-4 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                          {customer.name?.[0]?.toUpperCase() || customer.email[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{customer.name || 'Khách vãng lai'}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Mail className="w-3 h-3 text-gray-400" />
                            {customer.email}
                          </div>
                        </div>
                      </div>
                    </td>
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
                          <div className="flex items-center gap-1 text-gray-500 max-w-xs truncate" title={customer.address}>
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    </td>
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
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-800">
                        <ShoppingBag className="w-3 h-3 text-gray-500" />
                        {customer.orderCount} đơn
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-indigo-600">
                      {formatVND(customer.totalSpent)}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(customer.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        Xem
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Hồ sơ Khách hàng
              </h2>
              <button
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
                <div>
                  <h3 className="font-bold text-gray-900">{selectedCustomer.name || 'Khách hàng'}</h3>
                  <p className="text-xs text-gray-500">{selectedCustomer.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedCustomer.phone || 'Chưa cập nhật SĐT'}</p>
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
                  <p className="text-xs text-gray-400 italic">Khách hàng chưa có đơn hàng nào.</p>
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
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(order.status)}`}>
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
