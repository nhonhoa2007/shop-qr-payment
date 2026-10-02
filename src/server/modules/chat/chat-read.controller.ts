import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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

    let participant = await prisma.chatRoomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: session.user.id } },
    });

    if (!participant) {
      if (session.user.role === 'ADMIN') {
        try {
          participant = await prisma.chatRoomParticipant.create({
            data: { roomId, userId: session.user.id },
          });
        } catch {
          participant = await prisma.chatRoomParticipant.findUnique({
            where: { roomId_userId: { roomId, userId: session.user.id } },
          });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
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

    // Update lastReadAt for the current user
    await prisma.chatRoomParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
