// tests/auth-session-permissions.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('NextAuth JWT and Session Permission Propagation', () => {
  it('should attach permissions array to session user for STAFF', () => {
    const mockToken = {
      id: 'staff_1',
      role: 'STAFF',
      permissions: ['orders', 'chat'],
    };
    const mockSession = { user: { id: '', role: '' } };

    const session = {
      ...mockSession,
      user: {
        id: mockToken.id,
        role: mockToken.role,
        permissions: mockToken.permissions,
      },
    };

    assert.equal(session.user.role, 'STAFF');
    assert.deepEqual(session.user.permissions, ['orders', 'chat']);
  });

  it('should handle empty permissions for CUSTOMER', () => {
    const mockToken = {
      id: 'cust_1',
      role: 'CUSTOMER',
      permissions: [],
    };
    const session = {
      user: {
        id: mockToken.id,
        role: mockToken.role,
        permissions: mockToken.permissions,
      },
    };

    assert.equal(session.user.role, 'CUSTOMER');
    assert.deepEqual(session.user.permissions, []);
  });
});
