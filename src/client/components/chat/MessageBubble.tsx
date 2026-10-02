import { formatTime } from '@shared/utils';
import type { Message } from '@shared/types';

export function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (message.type === 'SYSTEM') {
    return (
      <div className="text-center py-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
        isOwn
          ? 'bg-shop-violet text-white rounded-br-md shadow-sm'
          : 'bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100'
      }`}>
        {!isOwn && message.sender?.name && (
          <p className="text-xs font-semibold text-shop-violet mb-1">{message.sender.name}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'text-violet-wash' : 'text-slate-400'}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
