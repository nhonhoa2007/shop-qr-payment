'use client';

import React, { useState, useEffect, useRef } from 'react';
import type {
  AssistantMessageDto,
  ConversationDto,
  AssistantAnswerDto,
} from '@/shared/types/assistant.ts';

interface AssistantPanelProps {
  initialConversationId?: string;
  defaultProductIds?: string[];
  className?: string;
}

export function AssistantPanel({
  initialConversationId,
  defaultProductIds = [],
  className = '',
}: AssistantPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<AssistantMessageDto[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initConversation() {
      if (conversationId) {
        try {
          const res = await fetch(`/api/assistant/conversations/${conversationId}/messages`);
          const data = await res.json();
          if (data.success && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        } catch {
          // ignore initial fetch error
        }
      } else {
        try {
          const res = await fetch('/api/assistant/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Hỏi đáp kỹ thuật' }),
          });
          const data = await res.json();
          if (data.success && data.conversation) {
            setConversationId(data.conversation.id);
          }
        } catch (err) {
          setError('Không thể khởi tạo phiên trò chuyện trợ lý.');
        }
      }
    }

    initConversation();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !conversationId || isLoading) return;

    setInputMessage('');
    setError(null);
    setIsLoading(true);

    const tempUserMsg: AssistantMessageDto = {
      id: `temp_${Date.now()}`,
      conversationId,
      role: 'USER',
      content: text,
      citations: [],
      claims: [],
      isGrounded: true,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/assistant/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          productIds: defaultProductIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi xử lý phản hồi từ trợ lý.');
      }

      const answerDto = data.answer as AssistantAnswerDto;
      const assistantMsg: AssistantMessageDto = {
        id: answerDto.messageId || `msg_${Date.now()}`,
        conversationId,
        role: 'ASSISTANT',
        content: answerDto.answer,
        followUpQuestion: answerDto.followUpQuestion,
        citations: answerDto.citations,
        claims: answerDto.claims,
        isGrounded: answerDto.isGrounded,
        fallbackReason: answerDto.fallbackReason,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối trợ lý.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-[520px] max-w-lg w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg overflow-hidden text-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">
            Trợ lý Công nghệ Grounded
          </h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
          Evidence-backed
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 dark:text-neutral-400 py-10 space-y-2">
            <p className="font-medium">Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?</p>
            <p className="text-xs">
              Mọi câu trả lời được đối chiếu trực tiếp với thông số niêm yết và dữ liệu đo đạc thực tế.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'USER';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-none'
                }`}
              >
                {m.content}

                {/* Citations if available */}
                {!isUser && m.citations && m.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                    <p className="font-medium text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      Căn cứ xác minh:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {m.citations.map((c) => (
                        <li key={c.id} className="truncate">
                          {c.title} {c.publisher ? `(${c.publisher})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Follow-up Question Suggestion */}
              {!isUser && m.followUpQuestion && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(m.followUpQuestion || undefined)}
                  className="mt-1 text-xs text-left bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  💡 {m.followUpQuestion}
                </button>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-1.5 text-neutral-400 text-xs py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.4s]" />
            <span className="ml-1">Đang đối chiếu bằng chứng...</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border-t border-neutral-200 dark:border-neutral-800 flex gap-2"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Hỏi về RAM, giá niêm yết, thời lượng pin..."
          disabled={isLoading}
          className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-xs"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors shrink-0"
        >
          Gửi
        </button>
      </form>
    </div>
  );
}
