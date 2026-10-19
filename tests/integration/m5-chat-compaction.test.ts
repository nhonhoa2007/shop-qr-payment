import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateChatParticipantsToRooms,
  getCompactChatRoomDetails,
} from '@server/modules/chat/chat-compaction.service';

describe('M5 Compaction - ChatRoomParticipant to ChatRoom 1:1 Migration', () => {
  function createChatMockDb() {
    const rooms = new Map<string, any>();
    const legacyParticipants: any[] = [];
    const users = new Map<string, any>();

    const tx: any = {
      chatRoom: {
        findMany: async () => Array.from(rooms.values()).map((r) => ({ ...r })),
        findUnique: async ({ where }: any) => {
          const r = rooms.get(where.id);
          return r ? { ...r } : null;
        },
        update: async ({ where, data }: any) => {
          const r = rooms.get(where.id);
          if (!r) throw new Error('Room not found');
          Object.assign(r, data);
          return { ...r };
        },
      },
      chatRoomParticipant: {
        findMany: async ({ where }: any) => {
          return legacyParticipants.filter((p) => {
            if (where.chatRoomId && p.chatRoomId !== where.chatRoomId) return false;
            return true;
          });
        },
      },
      user: {
        findUnique: async ({ where }: any) => {
          const u = users.get(where.id);
          return u ? { ...u } : null;
        },
      },
      _seedRoom: (r: any) => rooms.set(r.id, { ...r }),
      _seedParticipant: (p: any) => legacyParticipants.push({ ...p }),
      _seedUser: (u: any) => users.set(u.id, { ...u }),
    };

    return tx;
  }

  it('migrates valid 1:1 buyer/staff chat rooms directly into ChatRoom columns', async () => {
    const db = createChatMockDb();
    db._seedUser({ id: 'cust_1', role: 'CUSTOMER', name: 'Nguyen Van A' });
    db._seedUser({ id: 'staff_1', role: 'STAFF', name: 'Staff Support' });

    db._seedRoom({
      id: 'room_valid_1',
      orderId: 'ord_1',
      customerId: null,
      assignedStaffId: null,
    });

    db._seedParticipant({
      id: 'p1',
      chatRoomId: 'room_valid_1',
      userId: 'cust_1',
    });

    db._seedParticipant({
      id: 'p2',
      chatRoomId: 'room_valid_1',
      userId: 'staff_1',
    });

    const report = await migrateChatParticipantsToRooms(db);
    assert.equal(report.migratedCount, 1);
    assert.equal(report.anomalies.length, 0);

    const roomAfter = await db.chatRoom.findUnique({ where: { id: 'room_valid_1' } });
    assert.equal(roomAfter.customerId, 'cust_1');
    assert.equal(roomAfter.assignedStaffId, 'staff_1');
  });

  it('detects and reports multi-party or ambiguous rooms as anomalies', async () => {
    const db = createChatMockDb();
    db._seedUser({ id: 'cust_1', role: 'CUSTOMER' });
    db._seedUser({ id: 'cust_2', role: 'CUSTOMER' }); // 2 customers!

    db._seedRoom({
      id: 'room_ambiguous',
      customerId: null,
      assignedStaffId: null,
    });

    db._seedParticipant({ id: 'p1', chatRoomId: 'room_ambiguous', userId: 'cust_1' });
    db._seedParticipant({ id: 'p2', chatRoomId: 'room_ambiguous', userId: 'cust_2' });

    const report = await migrateChatParticipantsToRooms(db);
    assert.equal(report.anomalies.length, 1);
    assert.equal(report.anomalies[0].roomId, 'room_ambiguous');
    assert.match(report.anomalies[0].reason, /multiple customers/i);
  });

  it('retrieves compact room details without querying join table', async () => {
    const db = createChatMockDb();
    db._seedUser({ id: 'c_1', role: 'CUSTOMER', name: 'Buyer' });
    db._seedUser({ id: 's_1', role: 'STAFF', name: 'Agent' });

    db._seedRoom({
      id: 'room_direct',
      customerId: 'c_1',
      assignedStaffId: 's_1',
      customerReadAt: new Date(),
      staffReadAt: null,
    });

    const details = await getCompactChatRoomDetails(db, 'room_direct', 'c_1');
    assert.equal(details.allowed, true);
    assert.equal(details.otherUserName, 'Agent');
  });
});
