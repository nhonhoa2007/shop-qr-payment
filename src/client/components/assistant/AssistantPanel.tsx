'use client';

import { AssistantProductCards } from './AssistantProductCards';
import { AssistantComparison } from './AssistantComparison';
import { assistantRefKey, toggleAssistantSelection, type AssistantSelection } from '@client/lib/assistant-selection';
import type { AssistantProductCard, AssistantProductRef } from '@shared/types/assistant-commerce';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, ChevronRight, CircleHelp, Scale, Search, Send, Sparkles, X } from 'lucide-react';
import type {
  AssistantMessageDto,
  AssistantAnswerDto,
} from '@shared/types/assistant';

export interface AssistantPanelProps {
  initialConversationId?: string;
  defaultProductIds?: string[];
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
  onAnswerSuccess?: () => void;
  onClose?: () => void;
}

export function AssistantPanel({
  initialConversationId,
  defaultProductIds = [],
  className = '',
  onLoadingChange,
  onAnswerSuccess,
  onClose,
}: AssistantPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [selected, setSelected] = useState<AssistantSelection[]>([]);
  const initRequest = useRef<Promise<{ id: string; messages: AssistantMessageDto[] }> | null>(null);
  const [messages, setMessages] = useState<AssistantMessageDto[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!initRequest.current) initRequest.current = (async () => {
      let saved: string | null = initialConversationId || null;
      try { saved ||= sessionStorage.getItem('shop_assistant_conversation'); } catch { /* storage unavailable */ }
      if (saved) {
        const res = await fetch(`/api/assistant/conversations/${encodeURIComponent(saved)}/messages`);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.messages)) return { id: saved, messages: data.messages };
      }
      const res = await fetch('/api/assistant/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Tìm và so sánh sản phẩm' }),
      });
      const data = await res.json();
      if (!res.ok || !data.conversation?.id) throw new Error('Không thể khởi tạo phiên trò chuyện.');
      return { id: data.conversation.id, messages: [] };
    })();
    initRequest.current.then(result => {
      if (cancelled) return;
      setConversationId(result.id); setMessages(result.messages);
      try { sessionStorage.setItem('shop_assistant_conversation', result.id); } catch { /* storage unavailable */ }
    }).catch(() => { if (!cancelled) setError('Không thể kết nối trợ lý. Vui lòng mở lại để thử.'); });
    return () => { cancelled = true; };
  }, [initialConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(
    async (textToSend?: string, comparison?: AssistantProductRef[]) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || !conversationId || isLoading) return;

      setInputMessage('');
      setError(null);
      setIsLoading(true);
      onLoadingChange?.(true);

      const nowIso = new Date().toISOString();
      const tempUserMsg: AssistantMessageDto = {
        id: `temp_${nowIso}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId,
        role: 'USER',
        content: text,
        citations: [],
        claims: [],
        isGrounded: true,
        createdAt: nowIso,
      };

      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        const res = await fetch(`/api/assistant/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: text,
            productIds: defaultProductIds,
            comparison,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Lỗi xử lý phản hồi từ trợ lý.');
        }

        const answerDto = data.answer as AssistantAnswerDto;
        const assistantMsg: AssistantMessageDto = {
          id: answerDto.messageId || `msg_${nowIso}_${Math.random().toString(36).substring(2, 6)}`,
          conversationId,
          role: 'ASSISTANT',
          content: answerDto.answer,
          commerce: answerDto.commerce,
          followUpQuestion: answerDto.followUpQuestion,
          citations: answerDto.citations,
          claims: answerDto.claims,
          isGrounded: answerDto.isGrounded,
          fallbackReason: answerDto.fallbackReason,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        if (answerDto.commerce?.kind === 'comparison') setSelected([]);
        onAnswerSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Lỗi kết nối trợ lý.');
      } finally {
        setIsLoading(false);
        onLoadingChange?.(false);
      }
    },
    [inputMessage, conversationId, isLoading, defaultProductIds, onLoadingChange, onAnswerSuccess]
  );

  return (
    <div
      className={`flex flex-col h-[min(720px,92dvh)] sm:h-[min(720px,calc(100dvh-128px))] min-h-0 max-w-lg w-full overflow-hidden rounded-[26px] border border-slate-200/80 bg-[#f8fafc] text-sm shadow-[0_24px_80px_rgba(15,23,42,0.2)] ring-1 ring-white/70 ${className}`}
    >
      {/* Header */}
      <div className="relative shrink-0 overflow-hidden border-b border-slate-700/60 bg-slate-950 px-4 py-3.5 text-white">
        <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-lg shadow-violet-950/40">
              <Bot aria-hidden="true" className="h-5 w-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold tracking-tight">Trợ lý mua sắm</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">AI</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">Sẵn sàng tìm sản phẩm cho bạn</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-slate-200 sm:inline-flex">Tìm & so sánh</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng trợ lý"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top,#f5f3ff_0,transparent_34%),#f8fafc] p-3 sm:p-4">
        {messages.length === 0 && (
          <div className="mx-auto flex w-full max-w-sm flex-col items-center px-2 py-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-shop-violet shadow-[0_12px_30px_rgba(91,33,182,0.14)] ring-1 ring-violet-100">
              <Sparkles aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="font-semibold tracking-tight text-slate-900">Bạn muốn tìm gì hôm nay?</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600">Mình có thể tìm sản phẩm đang bán, lọc theo nhu cầu và so sánh hai lựa chọn.</p>
            <div className="mt-5 grid w-full gap-2 text-left">
              {[
                ['Tìm laptop đang bán', 'Xem các laptop hiện có'],
                ['Tìm tai nghe Sony', 'Khám phá phụ kiện âm thanh'],
                ['Tìm điện thoại dưới 20 triệu', 'Lọc theo ngân sách'],
              ].map(([query, hint]) => (
                <button key={query} type="button" onClick={() => handleSendMessage(query)} disabled={!conversationId || isLoading} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md disabled:opacity-50">
                  <span className="min-w-0"><span className="block text-xs font-semibold text-slate-800">{query}</span><span className="mt-0.5 block text-[10px] text-slate-500">{hint}</span></span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-shop-violet" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'USER';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2 min-w-0`}
            >
              <div
                className={`max-w-[95%] break-words leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'rounded-[20px] rounded-br-md bg-violet-700 px-3.5 py-2.5 text-white shadow-sm'
                    : 'rounded-[20px] rounded-bl-md border border-slate-200/80 bg-white px-3.5 py-3 text-slate-800 shadow-sm'
                }`}
              >
                {m.content}

                {/* Citations if available */}
                {!isUser && m.citations?.some(c => !c.commerceContext) && (
                  <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <CircleHelp aria-hidden="true" className="h-3 w-3" />
                      {m.commerce ? 'Dữ liệu từ shop:' : 'Căn cứ xác minh:'}
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {m.citations.filter(c => !c.commerceContext).map((c) => (
                        <li key={c.id} className="truncate">
                          {c.title} {c.publisher ? `(${c.publisher})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {!isUser && m.commerce && <div className="w-full min-w-0 space-y-2">
                {m.commerce.refreshed && <p className="px-1 text-[10px] font-medium text-slate-500">Giá và tình trạng đã cập nhật khi mở lại hội thoại.</p>}
                {m.commerce.notice && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">{m.commerce.notice}</p>}
                {m.commerce.comparison ? <AssistantComparison comparison={m.commerce.comparison} /> : <AssistantProductCards products={m.commerce.products} selected={selected} disabled={isLoading || !conversationId} onSelect={(product: AssistantProductCard) => {
                  const result = toggleAssistantSelection(selected, { productId: product.productId, variantId: product.variantId, name: product.name, categoryId: product.categoryId });
                  setSelected(result.selected); setError(result.error || null);
                }} />}
              </div>}

              {/* Follow-up Question Suggestion */}
              {!isUser && m.followUpQuestion && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(m.followUpQuestion || undefined)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
                >
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> {m.followUpQuestion}
                </button>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 shadow-sm">
            <Search aria-hidden="true" className="h-3.5 w-3.5 text-shop-violet" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.4s]" />
            <span className="ml-1">Đang tìm sản phẩm...</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><CircleHelp aria-hidden="true" className="h-3.5 w-3.5" /> Có lỗi xảy ra</div>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {selected.length > 0 && <div className="shrink-0 border-t border-violet-100 bg-white/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(91,33,182,0.08)] backdrop-blur" aria-label="Sản phẩm đã chọn">
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-800">Đã chọn <span className="text-shop-violet">{selected.length}/2</span></p><button type="button" disabled={isLoading || selected.length !== 2} onClick={() => handleSendMessage(`So sánh ${selected.map(p => p.name).join(' và ')}`, selected.map(({productId, variantId}) => ({productId, variantId})))} className="inline-flex items-center gap-1.5 rounded-full bg-shop-violet px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-violet-300 transition hover:bg-violet-700 disabled:opacity-40"><Scale aria-hidden="true" className="h-3.5 w-3.5" /> So sánh</button></div>
        <div className="mt-2 flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">{selected.map(p => <button key={assistantRefKey(p)} type="button" disabled={isLoading || !conversationId} onClick={() => setSelected(prev => prev.filter(item => assistantRefKey(item) !== assistantRefKey(p)))} aria-label={`Bỏ chọn ${p.name}`} className="max-w-[48%] shrink-0 truncate rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium text-violet-700 transition hover:bg-violet-100">{p.name} ×</button>)}</div>
      </div>}

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex shrink-0 gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          aria-label="Tin nhắn cho trợ lý"
          placeholder="Tìm sản phẩm hoặc so sánh..."
          disabled={isLoading || !conversationId}
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-500 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !conversationId || !inputMessage.trim()}
          aria-label="Gửi tin nhắn"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-40"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
