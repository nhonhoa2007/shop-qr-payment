import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { pusherServer } from '@server/infrastructure/pusher';
import { createNotification } from '@server/modules/notifications/notifications.service';
import { authOptions } from '@server/modules/auth/auth-options';
import { resolveOperatorAccess } from '@server/modules/admin/guards';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId, content, type = 'TEXT' } = await req.json();
    if (!roomId || !content) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    const room = await (prisma as any).chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const isMember = room.customerId === session.user.id || room.assignedStaffId === session.user.id;
    const canAccessChat = resolveOperatorAccess(session.user, 'chat');
    if (!isMember && !canAccessChat) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!isMember && canAccessChat && !room.assignedStaffId) {
      await (prisma as any).chatRoom.update({
        where: { id: roomId },
        data: { assignedStaffId: session.user.id },
      });
    }

    const message = await prisma.message.create({
      data: { roomId, senderId: session.user.id, content, type },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessage: content, lastActiveAt: new Date() },
    });

    await pusherServer.trigger(`private-chat-${roomId}`, 'new-message', {
      id: message.id,
      content: message.content,
      sender: message.sender,
      senderId: message.senderId,
      createdAt: message.createdAt,
      type: message.type,
      roomId: message.roomId,
      isRead: false,
    });

    const otherUserId = room.customerId === session.user.id ? room.assignedStaffId : room.customerId;
    if (otherUserId) {
      await createNotification({
        userId: otherUserId,
        type: 'NEW_MESSAGE',
        title: `Tin nhắn mới từ ${session.user.name || 'User'}`,
        message: content.slice(0, 100),
        data: { chatRoomId: roomId },
      });
    }

    return NextResponse.json({ message, ...message });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Lỗi gửi tin nhắn' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });

    const room = await (prisma as any).chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const isMember = room.customerId === session.user.id || room.assignedStaffId === session.user.id;
    const canAccessChat = resolveOperatorAccess(session.user, 'chat');
    if (!isMember && !canAccessChat) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!isMember && canAccessChat && !room.assignedStaffId) {
      await (prisma as any).chatRoom.update({
        where: { id: roomId },
        data: { assignedStaffId: session.user.id },
      });
    }

    const messages = await prisma.message.findMany({
      where: { roomId },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Lỗi lấy tin nhắn' }, { status: 500 });
  }
}
