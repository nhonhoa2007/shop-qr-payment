'use client';

import { ChatWindow } from '@client/components/chat/ChatWindow';
import type { Message } from '@shared/types';

export interface ChatRoomViewProps {
  roomId: string;
  currentUserId: string;
  initialMessages: Message[];
  otherUserName: string;
}

export function ChatRoomView({
  roomId,
  currentUserId,
  initialMessages,
  otherUserName,
}: ChatRoomViewProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <ChatWindow
        roomId={roomId}
        currentUserId={currentUserId}
        initialMessages={initialMessages}
        otherUserName={otherUserName}
      />
    </div>
  );
}

export default ChatRoomView;
