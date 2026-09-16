import { prisma } from '../../database/prisma';
import type { ChatRoom, Message } from '@/types';

/**
 * Chat Service - Xử lý nghiệp vụ hội thoại realtime và hỗ trợ khách hàng
 */
export class ChatService {
  /**
   * Lấy danh sách các phòng chat đang hoạt động dành cho Quản trị viên
   */
  static async getAdminChatRooms(adminUserId: string): Promise<ChatRoom[]> {
    const rooms = await prisma.chatRoom.findMany({
      include: {
        order: { select: { orderCode: true } },
        participants: {
          where: { userId: { not: adminUserId } },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return rooms as unknown as ChatRoom[];
  }

  /**
   * Lấy danh sách phòng chat của một khách hàng
   */
  static async getCustomerChatRooms(customerId: string): Promise<ChatRoom[]> {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        participants: {
          some: { userId: customerId },
        },
      },
      include: {
        order: { select: { orderCode: true } },
        participants: {
          where: { userId: { not: customerId } },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return rooms as unknown as ChatRoom[];
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
  }> {
    const participant = await prisma.chatRoomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!participant) {
      return { allowed: false, messages: [], otherName: '' };
    }

    const rawMessages = await prisma.message.findMany({
      where: { roomId },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        order: { select: { orderCode: true } },
        participants: {
          where: { userId: { not: userId } },
          include: { user: { select: { name: true } } },
        },
      },
    });

    const otherName =
      room?.participants[0]?.user?.name || (room?.order ? `Đơn ${room.order.orderCode}` : 'Chat');

    const messages: Message[] = rawMessages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    return {
      allowed: true,
      messages,
      otherName,
    };
  }
}
