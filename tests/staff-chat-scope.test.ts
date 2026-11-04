import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessChatRoom, staffChatRoomWhere } from '@server/modules/chat/chat-room-scope';

describe('staff chat room scope', () => {
  it('limits old schemas to rooms assigned to the staff member', () => {
    assert.deepEqual(staffChatRoomWhere('staff-1', false), { assignedStaffId: 'staff-1' });
  });

  it('also includes explicit participant rooms on the current schema', () => {
    assert.deepEqual(staffChatRoomWhere('staff-1', true), {
      OR: [
        { assignedStaffId: 'staff-1' },
        { participants: { some: { userId: 'staff-1' } } },
      ],
    });
  });
});

describe('chat room access', () => {
  const room = { customerId: 'customer-1', assignedStaffId: 'staff-1' };

  it('lets an ADMIN access any room and a customer access their own room', () => {
    assert.equal(canAccessChatRoom({ id: 'admin-1', role: 'ADMIN' }, room), true);
    assert.equal(canAccessChatRoom({ id: 'customer-1', role: 'CUSTOMER' }, room), true);
  });

  it('limits STAFF to their assigned room and chat permission', () => {
    assert.equal(canAccessChatRoom({ id: 'staff-1', role: 'STAFF', permissions: ['chat'] }, room), true);
    assert.equal(canAccessChatRoom({ id: 'staff-2', role: 'STAFF', permissions: ['chat'] }, room), false);
    assert.equal(canAccessChatRoom({ id: 'staff-1', role: 'STAFF', permissions: [] }, room), false);
  });

  it('denies a different customer or a missing room', () => {
    assert.equal(canAccessChatRoom({ id: 'customer-2', role: 'CUSTOMER' }, room), false);
    assert.equal(canAccessChatRoom({ id: 'admin-1', role: 'ADMIN' }, null), false);
  });
});
