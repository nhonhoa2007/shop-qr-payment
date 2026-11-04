export function staffChatRoomWhere(staffUserId: string, hasParticipants: boolean) {
  if (!hasParticipants) return { assignedStaffId: staffUserId };
  return {
    OR: [
      { assignedStaffId: staffUserId },
      { participants: { some: { userId: staffUserId } } },
    ],
  };
}

export function canAccessChatRoom(
  user: { id: string; role: string; permissions?: readonly string[] },
  room: { customerId: string | null; assignedStaffId: string | null } | null
): boolean {
  if (!room) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STAFF') {
    return Boolean(user.permissions?.includes('chat') && room.assignedStaffId === user.id);
  }
  return room.customerId === user.id;
}
