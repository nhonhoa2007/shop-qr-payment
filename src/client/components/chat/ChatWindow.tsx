'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useChatMessages } from '@client/hooks/useChatMessages';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { MessageSquare, ArrowLeft, ShoppingBag } from 'lucide-react';
import type { Message } from '@shared/types';

export interface ChatWindowProps {
  roomId: string;
  currentUserId: string;
  initialMessages?: Message[];
  otherUserName?: string;
  orderInfo?: {
    orderCode: string;
    totalAmount?: number;
    status?: string;
  };
  backHref?: string;
  className?: string;
}

export function ChatWindow({
  roomId,
  currentUserId,
  initialMessages = [],
  otherUserName,
  orderInfo,
  backHref,
  className,
}: ChatWindowProps) {
  const { messages, isTyping, typingUser, sendMessage, triggerTyping } = useChatMessages(
    roomId,
    currentUserId,
    initialMessages
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className={`flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200/80 ${
        className || 'h-[600px]'
      }`}
    >
      {/* Chat Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-shop-violet to-shop-violet-deep text-white font-semibold flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="p-1.5 -ml-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0"
              aria-label="Quay lại danh sách"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {otherUserName?.[0]?.toUpperCase() || <MessageSquare className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate leading-tight">
              {otherUserName || 'Chat'}
            </h2>
            <p className="text-[11px] text-violet-wash/90 font-normal leading-none mt-0.5">
              Đang trực tuyến
            </p>
          </div>
        </div>

        {orderInfo?.orderCode && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-xs text-white shrink-0">
            <ShoppingBag className="w-3.5 h-3.5 text-violet-wash" />
            <span className="font-medium text-[11px]">Đơn {orderInfo.orderCode}</span>
          </div>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="text-xs font-medium text-slate-500">Chưa có tin nhắn nào</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUserId} />
        ))}
        {isTyping && <TypingIndicator name={typingUser} />}
        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <MessageInput onSend={sendMessage} onTyping={triggerTyping} />
    </div>
  );
}
