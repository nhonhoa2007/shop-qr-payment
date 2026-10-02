'use client';

import Link from 'next/link';
import { formatTime } from '@shared/utils';
import { MessageSquare, ShoppingBag } from 'lucide-react';
import type { ChatRoom } from '@shared/types';

export interface ChatRoomListProps {
  rooms: ChatRoom[];
  currentRoomId?: string;
  basePath?: string;
  currentUserId?: string;
}

export function ChatRoomList({
  rooms,
  currentRoomId,
  basePath = '/chat',
  currentUserId,
}: ChatRoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <MessageSquare className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2" />
        <p className="text-sm font-medium text-slate-500">Chưa có cuộc trò chuyện nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {rooms.map((room) => {
        const otherParticipant = currentUserId
          ? room.participants.find((p) => p.user?.id !== currentUserId) || room.participants[0]
          : room.participants[0];
        const otherUser = otherParticipant?.user;
        const isActive = room.id === currentRoomId;

        return (
          <Link
            key={room.id}
            href={`${basePath}/${room.id}`}
            className={`flex items-center gap-3.5 p-3 rounded-xl transition-all duration-150 ${
              isActive
                ? 'bg-indigo-50/90 border border-indigo-200 text-indigo-950 shadow-sm ring-1 ring-indigo-200'
                : 'hover:bg-slate-50 border border-transparent text-slate-800 hover:border-slate-200/60'
            }`}
          >
            <div className={`w-10 h-10 rounded-full font-semibold flex items-center justify-center text-sm shadow-sm flex-shrink-0 ${
              isActive
                ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-indigo-200'
                : 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white'
            }`}>
              {otherUser?.name?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <p className={`font-semibold text-sm truncate ${isActive ? 'text-indigo-950 font-bold' : 'text-slate-900'}`}>
                  {otherUser?.name || 'Khách hàng'}
                </p>
                <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                  {formatTime(room.lastActiveAt)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                {room.order?.orderCode && (
                  <span className="inline-flex items-center gap-1 text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    <ShoppingBag className="w-3 h-3" />
                    {room.order.orderCode}
                  </span>
                )}
                <span className="truncate">{room.lastMessage || 'Chưa có tin nhắn'}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
