'use client';

import { useRef, useState } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
}

export function MessageInput({ onSend, onTyping }: MessageInputProps) {
  const [value, setValue] = useState('');
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      onTyping();
    }, 300);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-slate-200/80 bg-white">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Nhập tin nhắn..."
        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-shop-violet/30 focus:border-shop-violet outline-none transition text-sm text-slate-800 placeholder:text-slate-400"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="bg-shop-violet text-white p-2.5 rounded-xl hover:bg-shop-violet-deep disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
}
