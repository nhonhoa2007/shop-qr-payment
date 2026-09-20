'use client';

import { useEffect, useRef } from 'react';
import { useChatMessages } from '@client/hooks/useChatMessages';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { MessageSquare } from 'lucide-react';
import type { Message } from '@shared/types';

interface ChatWindowProps {
  roomId: string;
  currentUserId: string;
  initialMessages?: Message[];
  otherUserName?: string;
}

export function ChatWindow({ roomId, currentUserId, initialMessages = [], otherUserName }: ChatWindowProps) {
  const { messages, isTyping, typingUser, sendMessage, triggerTyping } = useChatMessages(roomId, currentUserId, initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
      <div className="px-4 py-3 bg-blue-600 text-white font-semibold flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        <span>{otherUserName || 'Chat'}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 py-8">Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUserId} />
        ))}
        {isTyping && <TypingIndicator name={typingUser} />}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} onTyping={triggerTyping} />
    </div>
  );
}
