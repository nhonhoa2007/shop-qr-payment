'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BankReviewPanel } from '@client/components/admin/BankReviewPanel';
import { formatVND, formatDateTime } from '@shared/utils';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  ExternalLink,
} from 'lucide-react';

export interface AdminTransactionItem {
  id: string;
  orderId: string;
  bankTransId: string | null;
  amount: number;
  description: string;
  bankName: string | null;
  senderAccount: string | null;
  receivedAt: string | null;
  verified: boolean;
  createdAt: string;
  order?: {
    id: string;
    orderCode: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    totalAmount: number;
    status: string;
    paymentStatus: string;
  } | null;
}

export function AdminTransactionsView({
  initialTransactions,
}: {
  initialTransactions: AdminTransactionItem[];
}) {
  const [transactions] = useState<AdminTransactionItem[]>(initialTransactions);
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const filtered = transactions.filter((tx) => {
    if (filterVerified === 'VERIFIED' && !tx.verified) return false;
    if (filterVerified === 'UNVERIFIED' && tx.verified) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTransId = tx.bankTransId?.toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchOrderCode = tx.order?.orderCode.toLowerCase().includes(q);
      const matchCustomer = tx.order?.customerName.toLowerCase().includes(q);
      const matchSender = tx.senderAccount?.toLowerCase().includes(q);
      if (!matchTransId && !matchDesc && !matchOrderCode && !matchCustomer && !matchSender) {
        return false;
      }
    }
    return true;
  });

  const totalAmount = transactions
    .filter((tx) => tx.verified)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <BankReviewPanel />
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
              Admin
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium">Đối soát giao dịch VietQR</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-600" />
            Đối soát Giao dịch Ngân hàng & VietQR
          </h1>
        </div>

      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng giao dịch</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{transactions.length}</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đã xác thực thành công</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">
            {transactions.filter((t) => t.verified).length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng tiền đối soát</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">{formatVND(totalAmount)}</h3>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm mã giao dịch, mã đơn, người gửi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value as 'ALL' | 'VERIFIED' | 'UNVERIFIED')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="VERIFIED">Đã xác thực (Verified)</option>
            <option value="UNVERIFIED">Chưa xác thực</option>
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">Không tìm thấy giao dịch nào</p>
            <p className="text-xs text-gray-400 mt-1">Giao dịch đã khớp với đơn sẽ hiển thị tại đây; khoản chờ xử lý nằm trong bảng đối soát phía trên.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Mã GD Ngân hàng</th>
                  <th className="py-3 px-4">Đơn hàng</th>
                  <th className="py-3 px-4">Số tiền nhận</th>
                  <th className="py-3 px-4">Ngân hàng & Người gửi</th>
                  <th className="py-3 px-4">Nội dung chuyển khoản</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-gray-900">
                        {tx.bankTransId || 'Chưa có mã'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {tx.order ? (
                        <div>
                          <Link
                            href="/admin/orders"
                            className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {tx.order.orderCode}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <p className="text-xs text-gray-500">{tx.order.customerName}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Không gắn đơn</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-green-600">{formatVND(tx.amount)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <span>{tx.bankName || 'Ngân hàng'}</span>
                      </div>
                      {tx.senderAccount && (
                        <p className="text-xs text-gray-400 mt-0.5">STK: {tx.senderAccount}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="max-w-xs text-xs text-gray-600 truncate" title={tx.description}>
                        {tx.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(tx.receivedAt || tx.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.verified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Khớp tiền
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Chưa khớp
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export { AdminTransactionsView as TransactionManager, AdminTransactionsView as default };
