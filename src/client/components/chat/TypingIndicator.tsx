export function TypingIndicator({ name }: { name: string | null }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-sm pl-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{name || 'Người bán'} đang nhập...</span>
    </div>
  );
}
