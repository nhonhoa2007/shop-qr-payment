'use client';

import Link from 'next/link';
import { ChatRoomList } from '@/client/components/chat/ChatRoomList';
import { MessageSquare, ChevronRight, Headphones, Inbox } from 'lucide-react';
import type { ChatRoom } from '@/types';

interface AdminChatViewProps {
  rooms: ChatRoom[];
}

export function AdminChatView({ rooms }: AdminChatViewProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/admin" className="hover:text-slate-900 transition-colors">
          Quản trị
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="font-medium text-slate-900">Hỗ trợ khách hàng</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
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

        {rooms.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Headphones className="w-3.5 h-3.5" />
            {rooms.length} phiên trò chuyện
          </span>
        )}
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5">
          <ChatRoomList rooms={rooms} />
        </div>
      )}
    </div>
  );
}
