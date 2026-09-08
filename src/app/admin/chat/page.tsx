import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { ChatRoomList } from '@/components/chat/ChatRoomList';
import Link from 'next/link';
import type { ChatRoom } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const rooms: ChatRoom[] = await prisma.chatRoom.findMany({
    include: {
      order: { select: { orderCode: true } },
      participants: {
        where: { userId: { not: session.user.id } },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
          Admin
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium">Hỗ trợ khách hàng</span>
      </div>
      <h1 className="text-2xl font-bold mb-6">💬 Cuộc trò chuyện với khách hàng</h1>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
          <span className="text-5xl block mb-3">💬</span>
          <p className="font-medium text-gray-600">Chưa có cuộc trò chuyện nào từ khách</p>
          <p className="text-xs text-gray-400 mt-1">Khi khách đặt hàng hoặc gửi tin nhắn, danh sách sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <ChatRoomList rooms={rooms} />
        </div>
      )}
    </div>
  );
}
