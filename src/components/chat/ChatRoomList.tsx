'use client';

import Link from 'next/link';
import { formatTime } from '@/lib/utils';
import type { ChatRoom } from '@/types';

export function ChatRoomList({ rooms, currentRoomId }: { rooms: ChatRoom[]; currentRoomId?: string }) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>💬</p>
        <p className="text-sm mt-2">Chưa có cuộc trò chuyện nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rooms.map((room) => {
        const otherUser = room.participants[0]?.user;
        const isActive = room.id === currentRoomId;
        return (
          <Link
            key={room.id}
            href={`/chat/${room.id}`}
            className={`flex items-center gap-3 p-3 rounded-xl transition ${
              isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
              {otherUser?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm truncate">{otherUser?.name || 'Đơn hàng'}</p>
                <span className="text-xs text-gray-400">{formatTime(room.lastActiveAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500 truncate">
                  {room.order?.orderCode ? `🛒 ${room.order.orderCode} • ` : ''}
                  {room.lastMessage || 'Chưa có tin nhắn'}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
