'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatVND, formatDate } from '@shared/utils';
import { Truck, Search, ArrowLeft, Calendar, MapPin, User, Package, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { ShipmentStatus, CarrierName } from '@shared/types';

export interface AdminShipmentLog {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

export interface AdminShipment {
  id: string;
  orderId: string;
  carrier: CarrierName;
  trackingCode: string;
  shippingFee: number;
  codAmount: number;
  status: ShipmentStatus;
  estimatedArrival?: string | null;
  shippingLogs?: AdminShipmentLog[] | null;
  createdAt: string;
  order: {
    id: string;
    orderCode: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    totalAmount: number;
    status: string;
    paymentStatus: string;
  };
}

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  READY_TO_PICK: { label: 'Chờ GHN lấy hàng', bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  PICKING: { label: 'Đang lấy hàng', bg: 'bg-blue-50', text: 'text-blue-700', icon: Package },
  DELIVERING: { label: 'Đang giao hàng', bg: 'bg-purple-50', text: 'text-purple-700', icon: Truck },
  DELIVERED: { label: 'Đã giao thành công', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  RETURNED: { label: 'Chuyển hoàn', bg: 'bg-rose-50', text: 'text-rose-700', icon: AlertCircle },
  CANCELLED: { label: 'Đã hủy', bg: 'bg-gray-100', text: 'text-gray-600', icon: AlertCircle },
};

export function AdminShipmentsView({ initialShipments }: { initialShipments: AdminShipment[] }) {
  const [shipments] = useState<AdminShipment[]>(initialShipments);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<AdminShipment | null>(null);

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchSearch =
        !query ||
        s.trackingCode.toLowerCase().includes(query) ||
        s.order.orderCode.toLowerCase().includes(query) ||
        s.order.customerName.toLowerCase().includes(query) ||
        s.order.customerPhone.includes(query);
      return matchStatus && matchSearch;
    });
  }, [shipments, search, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Bảng điều khiển Quản trị</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Quản lý Vận đơn (GHN Logistics)
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Theo dõi hành trình bưu phẩm, mã vận đơn GHN OpenAPI v2 và tiến độ giao nhận
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/orders"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-full transition"
          >
            Quản lý Đơn hàng
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã vận đơn GHN, mã đơn, tên khách, số ĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-gray-200 focus:outline-none focus:border-[#5433eb] transition"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Tổng cộng: <strong className="text-gray-900">{filteredShipments.length}</strong> vận đơn
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              statusFilter === 'ALL'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả ({shipments.length})
          </button>
          {(Object.keys(STATUS_CONFIG) as ShipmentStatus[]).map((st) => {
            const count = shipments.filter((s) => s.status === st).length;
            const config = STATUS_CONFIG[st];
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-[#5433eb] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{config.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === st ? 'bg-white/20 text-white' : 'bg-white text-gray-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shipment Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredShipments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-10 h-10 text-slate-300 stroke-[1.5] mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">Không tìm thấy vận đơn nào phù hợp</p>
            <p className="text-xs text-gray-400 mt-1">Khi đơn hàng chuyển sang trạng thái &quot;PROCESSING&quot;, vận đơn sẽ tự động được tạo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Mã vận đơn / Đơn vị</th>
                  <th className="py-3.5 px-4">Đơn hàng liên kết</th>
                  <th className="py-3.5 px-4">Khách hàng & Địa chỉ</th>
                  <th className="py-3.5 px-4">Cước phí / COD</th>
                  <th className="py-3.5 px-4">Trạng thái vận chuyển</th>
                  <th className="py-3.5 px-4">Ngày tạo / Dự kiến</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShipments.map((s) => {
                  const statusConf = STATUS_CONFIG[s.status] || STATUS_CONFIG.READY_TO_PICK;
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-gray-900 text-sm">{s.trackingCode}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="bg-[#ff6b00]/10 text-[#ff6b00] font-semibold text-[10px] px-1.5 py-0.5 rounded">
                            {s.carrier}
                          </span>
                          <span className="text-[11px] text-gray-400">OpenAPI v2</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{s.order.orderCode}</div>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          Đơn: <span className="font-medium text-gray-700">{formatVND(s.order.totalAmount)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-gray-900 truncate">{s.order.customerName}</div>
                        <div className="text-gray-500 text-[11px]">{s.order.customerPhone}</div>
                        <div className="text-gray-400 text-[11px] truncate mt-0.5" title={s.order.customerAddress}>
                          {s.order.customerAddress}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-gray-900 font-medium">Cước: {formatVND(s.shippingFee)}</div>
                        <div className="text-gray-500 text-[11px]">
                          COD: {s.codAmount > 0 ? formatVND(s.codAmount) : '0 ₫ (Đã thanh toán)'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-[11px] ${statusConf.bg} ${statusConf.text}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span>{statusConf.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-gray-700">{formatDate(s.createdAt)}</div>
                        {s.estimatedArrival && (
                          <div className="text-[11px] text-purple-600 mt-0.5">
                            Giao: {formatDate(s.estimatedArrival)}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedShipment(s)}
                          className="px-3 py-1.5 bg-[#5433eb]/10 hover:bg-[#5433eb]/20 text-[#5433eb] font-semibold text-xs rounded-full transition"
                        >
                          Lộ trình
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#5433eb]" />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Hành trình Vận đơn GHN</h3>
                  <p className="text-xs text-gray-500 font-mono">{selectedShipment.trackingCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Recipient card */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <User className="w-3.5 h-3.5 text-gray-500" />
                <span>{selectedShipment.order.customerName} - {selectedShipment.order.customerPhone}</span>
              </div>
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                <span>{selectedShipment.order.customerAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 pt-1 border-t border-gray-200/60">
                <Calendar className="w-3.5 h-3.5" />
                <span>Mã đơn hàng: <strong>{selectedShipment.order.orderCode}</strong></span>
              </div>
            </div>

            {/* Timeline logs */}
            <div>
              <h4 className="font-semibold text-xs text-gray-900 uppercase tracking-wider mb-3">
                Nhật ký hành trình bưu phẩm (GHN Logs)
              </h4>
              {selectedShipment.shippingLogs && selectedShipment.shippingLogs.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {selectedShipment.shippingLogs.map((log, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#5433eb] ring-4 ring-purple-100" />
                      <div className="text-xs font-semibold text-gray-900">{log.description || log.status}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {log.timestamp ? formatDate(log.timestamp) : ''}
                        {log.location ? ` • ${log.location}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Chưa có cập nhật trạng thái chi tiết từ bưu cục GHN.</p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                className="px-5 py-2 rounded-full bg-gray-900 text-white font-medium text-xs hover:bg-gray-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminShipmentsView as ShipmentManager, AdminShipmentsView as default };
