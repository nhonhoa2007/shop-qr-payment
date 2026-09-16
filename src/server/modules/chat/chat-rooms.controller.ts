import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rooms = await prisma.chatRoom.findMany({
      where: { participants: { some: { userId: session.user.id } } },
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

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
