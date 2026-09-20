'use client';

import { useEffect, useState, useCallback } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { toast } from 'sonner';
import type { Message } from '@shared/types';

export function useChatMessages(roomId: string, currentUserId: string, initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const markAsRead = useCallback(async () => {
    try {
      await fetch('/api/chat/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
    } catch (e) {
      console.warn('Failed to mark messages as read', e);
    }
  }, [roomId]);

  useEffect(() => {
    const channel = pusherClient.subscribe(`private-chat-${roomId}`);

    channel.bind('new-message', (data: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setIsTyping(false);

      // If window is in focus, auto mark new messages as read
      if (document.hasFocus() && data.senderId !== currentUserId) {
        markAsRead();
      }
    });

    channel.bind('client-typing', (data: { userId: string; name: string }) => {
      if (data.userId !== currentUserId) {
        setTypingUser(data.name);
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
      }
    });

    return () => {
      pusherClient.unsubscribe(`private-chat-${roomId}`);
    };
  }, [roomId, currentUserId, markAsRead]);

  // Mark as read when entering the room or focusing the window
  useEffect(() => {
    markAsRead();

    const handleFocus = () => markAsRead();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [markAsRead]);

  const sendMessage = useCallback(
    async (content: string) => {
      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempId,
        roomId,
        content,
        senderId: currentUserId,
        sender: { id: currentUserId, name: 'Bạn' },
        type: 'TEXT',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);

      try {
        const res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, content }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to send message');
        }

        // Replace temp message with actual server message
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...data.message } : msg))
        );
      } catch (error: unknown) {
        // Rollback on error
        console.error('Send message error:', error);
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        toast.error('Gửi tin nhắn thất bại. Vui lòng thử lại.');
      }
    },
    [roomId, currentUserId]
  );

  const triggerTyping = useCallback(() => {
    const channel = pusherClient.channel(`private-chat-${roomId}`);
    channel?.trigger('client-typing', { userId: currentUserId, name: 'User' });
  }, [roomId, currentUserId]);

  return { messages, isTyping, typingUser, sendMessage, triggerTyping };
}
