import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@server/modules/auth/auth-options';
import { canAccessChatRoom } from './chat-room-scope';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await req.json();
    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    const room = await (prisma as any).chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const isCustomer = room.customerId === session.user.id;
    if (!canAccessChatRoom(session.user, room)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark messages sent by OTHERS in this room as read
    await prisma.message.updateMany({
      where: {
        roomId,
        senderId: { not: session.user.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    // Update customerReadAt or staffReadAt directly on ChatRoom
    const updateData: any = {};
    if (isCustomer) {
      updateData.customerReadAt = new Date();
    } else {
      updateData.staffReadAt = new Date();
      if (session.user.role === 'ADMIN' && !room.assignedStaffId) {
        updateData.assignedStaffId = session.user.id;
      }
    }

    await (prisma as any).chatRoom.update({
      where: { id: roomId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update read state error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật trạng thái đọc' }, { status: 500 });
  }
}
