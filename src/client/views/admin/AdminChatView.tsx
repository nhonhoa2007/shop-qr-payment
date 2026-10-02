'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChatRoomList } from '@client/components/chat/ChatRoomList';
import { ChatWindow } from '@client/components/chat/ChatWindow';
import {
  MessageSquare,
  ChevronRight,
  Headphones,
  Inbox,
  Search,
  ShoppingBag,
} from 'lucide-react';
import type { ChatRoom, Message } from '@shared/types';

export interface AdminChatViewProps {
  rooms: ChatRoom[];
  selectedRoomId?: string;
  initialMessages?: Message[];
  currentUserId?: string;
  otherUserName?: string;
  orderInfo?: {
    orderCode: string;
    totalAmount?: number;
    status?: string;
  };
}

export function AdminChatView({
  rooms,
  selectedRoomId,
  initialMessages = [],
  currentUserId,
  otherUserName,
  orderInfo,
}: AdminChatViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter rooms by customer name or order code or last message
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const query = searchQuery.toLowerCase().trim();
    return rooms.filter((room) => {
      const otherParticipant = currentUserId
        ? room.participants?.find((p) => p.user?.id !== currentUserId) || room.participants?.[0]
        : room.participants?.[0];
      const customerName = otherParticipant?.user?.name?.toLowerCase() || '';
      const orderCode = room.order?.orderCode?.toLowerCase() || '';
      const lastMessage = room.lastMessage?.toLowerCase() || '';
      return (
        customerName.includes(query) ||
        orderCode.includes(query) ||
        lastMessage.includes(query)
      );
    });
  }, [rooms, searchQuery, currentUserId]);

  const activeRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  const activeOrderInfo = orderInfo || (activeRoom?.order ? { orderCode: activeRoom.order.orderCode } : undefined);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/admin" className="hover:text-slate-900 transition-colors">
          Quản trị
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <Link
          href="/admin/chat"
          className={
            selectedRoomId
              ? 'hover:text-slate-900 transition-colors'
              : 'font-medium text-slate-900'
          }
        >
          Hỗ trợ khách hàng
        </Link>
        {selectedRoomId && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900 truncate max-w-[200px]">
              {otherUserName || `Phòng #${selectedRoomId.slice(-6)}`}
            </span>
          </>
        )}
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Cuộc trò chuyện với khách hàng
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ tư vấn, giải đáp thắc mắc và cập nhật trạng thái đơn hàng thời gian thực
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {rooms.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Headphones className="w-3.5 h-3.5" />
              {rooms.length} phiên trò chuyện
            </span>
          )}
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
            <span>Xem đơn hàng</span>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {rooms.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Inbox className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Chưa có cuộc trò chuyện nào từ khách
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Khi khách hàng gửi yêu cầu tư vấn hoặc đặt đơn hàng mới, danh sách phòng chat sẽ tự động hiển thị tại đây.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Room List (Hidden on mobile if a room is actively selected) */}
          <div
            className={`lg:col-span-5 xl:col-span-4 ${
              selectedRoomId ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-[700px]">
              {/* Filter / Search header */}
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    Hộp thư hỗ trợ
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {filteredRooms.length}/{rooms.length}
                  </span>
                </div>
                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo khách hoặc mã đơn..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <p className="text-xs font-medium text-slate-500">
                      Không tìm thấy cuộc trò chuyện nào
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Thử tìm kiếm với từ khóa khác
                    </p>
                  </div>
                ) : (
                  <ChatRoomList
                    rooms={filteredRooms}
                    currentRoomId={selectedRoomId}
                    basePath="/admin/chat"
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Chat Window or Placeholder State */}
          <div
            className={`lg:col-span-7 xl:col-span-8 ${
              selectedRoomId ? 'block' : 'hidden lg:block'
            }`}
          >
            {selectedRoomId && currentUserId ? (
              <div className="h-[700px] flex flex-col">
                <ChatWindow
                  roomId={selectedRoomId}
                  currentUserId={currentUserId}
                  initialMessages={initialMessages}
                  otherUserName={otherUserName}
                  orderInfo={activeOrderInfo}
                  backHref="/admin/chat"
                  className="h-full flex-1"
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center h-[700px] flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600 shadow-sm">
                  <Headphones className="w-8 h-8 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Chọn một cuộc trò chuyện để bắt đầu
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mb-6">
                  Vui lòng chọn khách hàng từ danh sách bên trái để xem lịch sử trao đổi, giải đáp thắc mắc và gửi cập nhật đơn hàng tức thì.
                </p>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Kênh Pusher realtime sẵn sàng kết nối
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminChatView;
