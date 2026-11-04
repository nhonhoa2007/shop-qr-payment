'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ArrowUpDown } from 'lucide-react';
import { formatVND } from '@shared/utils';
import { AdminFilterMenu } from '@client/components/admin/AdminFilterMenu';
import { filterRecentOrders } from './recent-orders-presentation';

export interface RecentOrderItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone?: string;
  itemsSummary: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

export interface AdminRecentOrdersTableProps {
  orders?: RecentOrderItem[];
  loading?: boolean;
  sampleSize?: number;
}

const ORDER_STATUS: Record<string, string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý', SHIPPING: 'Đang giao',
  DELIVERING: 'Đang giao', COMPLETED: 'Hoàn thành', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy',
};

function paymentLabel(status: string): string {
  if (status === 'PAID') return 'Đã thanh toán';
  if (status === 'WALLET') return 'Ví shop';
  return 'Chờ thanh toán';
}

export function AdminRecentOrdersTable({ orders, loading = false, sampleSize = 20 }: AdminRecentOrdersTableProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [amountSort, setAmountSort] = useState<'asc' | 'desc' | null>(null);
  const rows = filterRecentOrders(orders ?? [], { query, status, amountSort });
  return <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="recent-orders-title">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h2 id="recent-orders-title" className="text-sm font-semibold text-slate-900">Đơn hàng gần đây</h2><p className="mt-1 text-xs text-slate-500">Tìm và lọc trong {sampleSize} đơn mới nhất.</p></div>
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">Xem tất cả <ArrowRight className="size-3" /></Link>
    </div>
    <div className="mb-3 flex flex-wrap gap-2">
      <label className="relative min-w-44 flex-1 sm:max-w-64"><span className="sr-only">Tìm đơn hàng gần đây</span><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm đơn hàng" className="min-h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus-visible:border-slate-500" /></label>
      <AdminFilterMenu label="Lọc trạng thái" value={status} options={[{ value: 'ALL', label: 'Mọi trạng thái' }, { value: 'PENDING', label: 'Chờ xác nhận' }, { value: 'CONFIRMED', label: 'Đã xác nhận' }, { value: 'PROCESSING', label: 'Đang xử lý' }, { value: 'SHIPPING', label: 'Đang giao' }, { value: 'COMPLETED', label: 'Hoàn thành' }, { value: 'CANCELLED', label: 'Đã hủy' }]} onValueChange={setStatus} />
    </div>
    {loading && !orders ? <div className="h-24 rounded-md bg-slate-100" aria-hidden="true" /> : rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Không có đơn hàng phù hợp.</p> : <>
      <div className="space-y-0 divide-y divide-slate-100 sm:hidden">
        {rows.map((order) => <Link key={order.id} href={`/admin/orders?search=${encodeURIComponent(order.orderCode)}`} className="block py-3 hover:bg-slate-50">
          <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium text-slate-900">#{order.orderCode.replace(/^#/, '')}</span><span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatVND(order.totalAmount)}</span></div>
          <p className="mt-1 truncate text-xs text-slate-600">{order.customerName} · {ORDER_STATUS[order.status] ?? order.status}</p>
          <p className="mt-0.5 text-xs text-slate-500">{paymentLabel(order.paymentStatus)}</p>
        </Link>)}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="py-2 font-medium">Mã đơn</th><th scope="col" className="py-2 font-medium">Khách hàng / sản phẩm</th><th scope="col" className="py-2 font-medium">Thanh toán</th><th scope="col" className="py-2 font-medium">Trạng thái</th><th scope="col" className="py-2 text-right font-medium"><button type="button" onClick={() => setAmountSort((current) => current === 'desc' ? 'asc' : 'desc')} aria-label={`Sắp xếp tổng tiền ${amountSort === 'desc' ? 'tăng dần' : 'giảm dần'}`} className="inline-flex items-center gap-1 hover:text-slate-900">Tổng tiền <ArrowUpDown className="size-3" /></button></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((order) => <tr key={order.id} className="hover:bg-slate-50">
              <td className="py-3 font-medium text-slate-900"><Link href={`/admin/orders?search=${encodeURIComponent(order.orderCode)}`} className="hover:underline">#{order.orderCode.replace(/^#/, '')}</Link></td>
              <td className="max-w-[220px] py-3"><span className="block truncate font-medium text-slate-800">{order.customerName}</span><span className="block truncate text-slate-500" title={order.itemsSummary}>{order.itemsSummary}</span></td>
              <td className="py-3 text-slate-600">{paymentLabel(order.paymentStatus)}</td>
              <td className="py-3 text-slate-600">{ORDER_STATUS[order.status] ?? order.status}</td>
              <td className="py-3 text-right font-medium tabular-nums text-slate-900">{formatVND(order.totalAmount)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </>}
  </section>;
}
