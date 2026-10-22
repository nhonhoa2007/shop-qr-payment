import { prisma } from '@server/database/prisma';
import type { ChatRoom, Message } from '@shared/types';

/**
 * Chat Service - Xử lý nghiệp vụ hội thoại realtime và hỗ trợ khách hàng
 */
export class ChatService {
  /**
   * Lấy danh sách các phòng chat đang hoạt động dành cho Quản trị viên
   */
  static async getAdminChatRooms(adminUserId: string): Promise<ChatRoom[]> {
    try {
      const hasParticipants = 'chatRoomParticipant' in prisma;
      const rooms = await (prisma as any).chatRoom.findMany({
        include: {
          order: { select: { orderCode: true } },
          customer: { select: { id: true, name: true, avatar: true } },
          assignedStaff: { select: { id: true, name: true, avatar: true } },
          ...(hasParticipants
            ? {
                participants: {
                  where: { userId: { not: adminUserId } },
                  include: { user: { select: { id: true, name: true, avatar: true } } },
                },
              }
            : {}),
          _count: { select: { messages: true } },
        },
        orderBy: { lastActiveAt: 'desc' },
      });

      const mapped = rooms.map((room: any) => {
        const otherUser = room.customer || (room.assignedStaffId !== adminUserId ? room.assignedStaff : null);
        const participants =
          room.participants && room.participants.length > 0
            ? room.participants
            : [otherUser ? { user: otherUser } : null].filter(Boolean);

        return {
          ...room,
          participants,
        };
      });

      return mapped as unknown as ChatRoom[];
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[ChatService] Không thể tải danh sách phòng chat quản trị (vui lòng chạy npx prisma db push):',
          err instanceof Error ? err.message : err
        );
      } else {
        console.error('ChatService.getAdminChatRooms error:', err);
      }
      return [];
    }
  }

  /**
   * Lấy danh sách phòng chat của một khách hàng
   */
  static async getCustomerChatRooms(customerId: string): Promise<ChatRoom[]> {
    try {
      const hasParticipants = 'chatRoomParticipant' in prisma;
      const rooms = await (prisma as any).chatRoom.findMany({
        where: {
          OR: [
            { customerId },
            ...(hasParticipants ? [{ participants: { some: { userId: customerId } } }] : []),
          ],
        },
        include: {
          order: { select: { orderCode: true } },
          customer: { select: { id: true, name: true, avatar: true } },
          assignedStaff: { select: { id: true, name: true, avatar: true } },
          ...(hasParticipants
            ? {
                participants: {
                  where: { userId: { not: customerId } },
                  include: { user: { select: { id: true, name: true, avatar: true } } },
                },
              }
            : {}),
          _count: { select: { messages: true } },
        },
        orderBy: { lastActiveAt: 'desc' },
      });

      const mapped = rooms.map((room: any) => {
        const otherUser = room.assignedStaff;
        const participants =
          room.participants && room.participants.length > 0
            ? room.participants
            : [otherUser ? { user: otherUser } : null].filter(Boolean);

        return {
          ...room,
          participants,
        };
      });

      return mapped as unknown as ChatRoom[];
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[ChatService] Không thể tải danh sách phòng chat (vui lòng chạy npx prisma db push):',
          err instanceof Error ? err.message : err
        );
      } else {
        console.error('ChatService.getCustomerChatRooms error:', err);
      }
      return [];
    }
  }

  /**
   * Lấy chi tiết cuộc hội thoại và lịch sử tin nhắn của một phòng chat
   */
  static async getRoomConversation(
    roomId: string,
    userId: string
  ): Promise<{
    allowed: boolean;
    messages: Message[];
    otherName: string;
    order?: { orderCode: string } | null;
  }> {
    const hasParticipants = 'chatRoomParticipant' in prisma;
    const room = await (prisma as any).chatRoom.findUnique({
      where: { id: roomId },
      include: {
        order: { select: { orderCode: true } },
        customer: { select: { id: true, name: true, avatar: true } },
        assignedStaff: { select: { id: true, name: true, avatar: true } },
        ...(hasParticipants
          ? {
              participants: {
                where: { userId: { not: userId } },
                include: { user: { select: { id: true, name: true, avatar: true } } },
              },
            }
          : {}),
      },
    });

    if (!room) {
      return { allowed: false, messages: [], otherName: '', order: null };
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isDirectMember = room.customerId === userId || room.assignedStaffId === userId;

    if (!isDirectMember) {
      if (hasParticipants) {
        let participant = await (prisma as any).chatRoomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });

        if (!participant) {
          if (user?.role === 'ADMIN') {
            try {
              participant = await (prisma as any).chatRoomParticipant.create({
                data: { roomId, userId },
              });
            } catch {
              participant = await (prisma as any).chatRoomParticipant.findUnique({
                where: { roomId_userId: { roomId, userId } },
              });
            }
          } else {
            return { allowed: false, messages: [], otherName: '', order: null };
          }
        }
      } else {
        if (user?.role === 'ADMIN') {
          if (!room.assignedStaffId) {
            await (prisma as any).chatRoom.update({
              where: { id: roomId },
              data: { assignedStaffId: userId },
            });
          }
        } else {
          return { allowed: false, messages: [], otherName: '', order: null };
        }
      }
    }

    const rawMessages = await prisma.message.findMany({
      where: { roomId },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const otherUser = room.customerId === userId ? room.assignedStaff : room.customer;
    const otherName =
      room.participants?.[0]?.user?.name ||
      otherUser?.name ||
      (room.order ? `Đơn ${room.order.orderCode}` : 'Chat');

    const messages: Message[] = rawMessages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    return {
      allowed: true,
      messages,
      otherName,
      order: room.order,
    };
  }
}
