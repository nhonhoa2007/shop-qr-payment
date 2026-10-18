export interface RoomAnomaly {
  roomId: string;
  reason: string;
}

export async function migrateChatParticipantsToRooms(
  tx: any
): Promise<{ migratedCount: number; anomalies: RoomAnomaly[] }> {
  let migratedCount = 0;
  const anomalies: RoomAnomaly[] = [];

  if (!('chatRoomParticipant' in tx) || typeof (tx as any).chatRoomParticipant?.findMany !== 'function') {
    return { migratedCount: 0, anomalies: [] };
  }

  const rooms = await tx.chatRoom.findMany();

  for (const room of rooms) {
    if (room.customerId) {
      continue;
    }

    const participants = await tx.chatRoomParticipant.findMany({
      where: { chatRoomId: room.id },
    });

    if (participants.length === 0) {
      continue;
    }

    const participantsWithUser = [];
    for (const p of participants) {
      const user = await tx.user.findUnique({
        where: { id: p.userId },
      });
      if (user) {
        participantsWithUser.push({ ...p, user });
      }
    }

    const customers = participantsWithUser.filter((p) => p.user.role === 'CUSTOMER');
    const staff = participantsWithUser.filter((p) => p.user.role === 'STAFF' || p.user.role === 'ADMIN');

    if (customers.length > 1) {
      anomalies.push({
        roomId: room.id,
        reason: `Room has multiple customers (${customers.map((c) => c.userId).join(', ')})`,
      });
      continue;
    }

    if (staff.length > 1) {
      anomalies.push({
        roomId: room.id,
        reason: `Room has multiple staff (${staff.map((s) => s.userId).join(', ')})`,
      });
      continue;
    }

    const customerId = customers[0]?.userId ?? null;
    const assignedStaffId = staff[0]?.userId ?? null;

    await tx.chatRoom.update({
      where: { id: room.id },
      data: {
        customerId,
        assignedStaffId,
      },
    });

    migratedCount++;
  }

  return { migratedCount, anomalies };
}

export async function getCompactChatRoomDetails(
  tx: any,
  roomId: string,
  userId: string
): Promise<{ allowed: boolean; otherUserName: string }> {
  const room = await tx.chatRoom.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return { allowed: false, otherUserName: '' };
  }

  const isCustomer = room.customerId === userId;
  const isStaff = room.assignedStaffId === userId;

  if (!isCustomer && !isStaff) {
    return { allowed: false, otherUserName: '' };
  }

  const otherId = isCustomer ? room.assignedStaffId : room.customerId;
  if (!otherId) {
    return { allowed: true, otherUserName: 'Hỗ trợ khách hàng' };
  }

  const otherUser = await tx.user.findUnique({
    where: { id: otherId },
  });

  return {
    allowed: true,
    otherUserName: otherUser?.name ?? 'Người dùng',
  };
}
