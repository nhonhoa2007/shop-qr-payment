'use client';

import { ChatRoomList } from '@/client/components/chat/ChatRoomList';
import { MessageSquare, Inbox } from 'lucide-react';
import type { ChatRoom } from '@/types';

export interface ChatViewProps {
  rooms: ChatRoom[];
}

export function ChatView({ rooms }: ChatViewProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
          <MessageSquare className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tin nhắn & Hỗ trợ
        </h1>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Inbox className="w-8 h-8 stroke-[1.5]" />
          </div>
          <p className="text-base font-semibold text-slate-800">Chưa có cuộc trò chuyện nào</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Hộp thoại tư vấn sẽ tự động được kích hoạt ngay khi bạn tạo đơn hàng mới.
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

export default ChatView;
