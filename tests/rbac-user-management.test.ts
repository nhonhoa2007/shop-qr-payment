import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  validateUserUpdatePayload,
  updateUserRbac,
  authorizeCredentialsLogin,
  type AdminUserRecord,
  type UserPrismaRbacDelegate,
} from '../src/lib/admin-rbac.ts';
import {
  handleGoogleSignIn,
  type GoogleSignInUser,
  type UserPrismaDelegate,
  type UserDbRecord,
} from '../src/lib/auth-helpers.ts';

// ─── Helpers: In-memory mock delegates ──────────────────────────────────────

function createMockPrismaUsers(initialUsers: AdminUserRecord[] = []) {
  const users: Map<string, AdminUserRecord> = new Map();
  for (const u of initialUsers) {
    users.set(u.id, { ...u });
    if (u.email) {
      users.set(u.email.toLowerCase(), { ...u });
    }
  }

  const delegate: UserPrismaRbacDelegate = {
    async findUnique({ where }) {
      if (where.id && users.has(where.id)) {
        return users.get(where.id) || null;
      }
      if (where.email && users.has(where.email.toLowerCase())) {
        return users.get(where.email.toLowerCase()) || null;
      }
      return null;
    },
    async count({ where }) {
      let count = 0;
      const seenIds = new Set<string>();
      for (const u of users.values()) {
        if (!seenIds.has(u.id)) {
          seenIds.add(u.id);
          if (!where?.role || u.role === where.role) {
            count++;
          }
        }
      }
      return count;
    },
    async update({ where, data }) {
      const user = users.get(where.id);
      if (!user) throw new Error('User not found');
      if (data.role !== undefined) user.role = data.role;
      if (data.isBlocked !== undefined) user.isBlocked = data.isBlocked;
      if (data.isVerified !== undefined) user.isVerified = data.isVerified;
      user.updatedAt = new Date();
      // Update map for both id and email
      users.set(user.id, { ...user });
      if (user.email) users.set(user.email.toLowerCase(), { ...user });
      return { ...user };
    },
  };

  return { delegate, users };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('RBAC - Request Payload Validation', () => {
  it('should reject non-object or null payload', () => {
    assert.equal(validateUserUpdatePayload(null).valid, false);
    assert.equal(validateUserUpdatePayload('string').valid, false);
    assert.equal(validateUserUpdatePayload([]).valid, false);
  });

  it('should reject missing userId or id', () => {
    const res = validateUserUpdatePayload({ role: 'STAFF' });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /userId/);
  });

  it('should reject invalid role string', () => {
    const invalidRoles = ['SUPERADMIN', 'MODERATOR', 'GUEST', 'CUSTOMER_VIP', ''];
    for (const r of invalidRoles) {
      const res = validateUserUpdatePayload({ userId: 'u_1', role: r });
      assert.equal(res.valid, false);
      assert.match(res.error || '', /vai trò không hợp lệ/i);
    }
  });

  it('should reject payload when no update fields are provided', () => {
    const res = validateUserUpdatePayload({ userId: 'u_1' });
    assert.equal(res.valid, false);
    assert.match(res.error || '', /không có dữ liệu cập nhật/i);
  });

  it('should accept valid payload with userId, role, isBlocked, and isVerified', () => {
    const res = validateUserUpdatePayload({
      userId: 'u_1',
      role: 'ADMIN',
      isBlocked: false,
      isVerified: true,
    });
    assert.equal(res.valid, true);
    assert.equal(res.data?.userId, 'u_1');
    assert.equal(res.data?.role, 'ADMIN');
    assert.equal(res.data?.isBlocked, false);
    assert.equal(res.data?.isVerified, true);
  });

  it('should accept id as fallback when userId is not provided', () => {
    const res = validateUserUpdatePayload({
      id: 'u_fallback_id',
      isBlocked: true,
    });
    assert.equal(res.valid, true);
    assert.equal(res.data?.userId, 'u_fallback_id');
    assert.equal(res.data?.isBlocked, true);
  });
});

describe('RBAC - User Role Transitions (CUSTOMER <-> STAFF <-> ADMIN)', () => {
  it('should upgrade CUSTOMER to STAFF', async () => {
    const customer: AdminUserRecord = {
      id: 'user_cust',
      email: 'cust@shop.vn',
      name: 'Customer One',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Super Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([customer, admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: customer.id, role: 'STAFF' },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.role, 'STAFF');
  });

  it('should upgrade STAFF to ADMIN', async () => {
    const staff: AdminUserRecord = {
      id: 'user_staff',
      email: 'staff@shop.vn',
      name: 'Staff Member',
      role: 'STAFF',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Admin Boss',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([staff, admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: staff.id, role: 'ADMIN' },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.role, 'ADMIN');
  });

  it('should demote ADMIN to STAFF when other admins exist', async () => {
    const admin1: AdminUserRecord = {
      id: 'admin_1',
      email: 'admin1@shop.vn',
      name: 'First Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin2: AdminUserRecord = {
      id: 'admin_2',
      email: 'admin2@shop.vn',
      name: 'Second Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([admin1, admin2]);

    // Admin 1 demotes Admin 2 to STAFF
    const result = await updateUserRbac(
      { adminId: admin1.id, userId: admin2.id, role: 'STAFF' },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.role, 'STAFF');
  });

  it('should demote ADMIN to CUSTOMER when other admins exist', async () => {
    const admin1: AdminUserRecord = {
      id: 'admin_1',
      email: 'admin1@shop.vn',
      name: 'First Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin2: AdminUserRecord = {
      id: 'admin_2',
      email: 'admin2@shop.vn',
      name: 'Second Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([admin1, admin2]);

    const result = await updateUserRbac(
      { adminId: admin1.id, userId: admin2.id, role: 'CUSTOMER' },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.role, 'CUSTOMER');
  });

  it('should return 404 when target user is not found', async () => {
    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: 'nonexistent_user', role: 'STAFF' },
      delegate
    );

    assert.equal(result.success, false);
    assert.equal(result.statusCode, 404);
    assert.match(result.error || '', /không tồn tại/i);
  });
});

describe('RBAC - Account Lock and Unlock (isBlocked: true / false)', () => {
  it('should lock an active user (isBlocked: true)', async () => {
    const targetUser: AdminUserRecord = {
      id: 'u_active',
      email: 'active@shop.vn',
      name: 'Active User',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([targetUser, admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: targetUser.id, isBlocked: true },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.isBlocked, true);
  });

  it('should unlock a blocked user (isBlocked: false)', async () => {
    const blockedUser: AdminUserRecord = {
      id: 'u_blocked',
      email: 'blocked@shop.vn',
      name: 'Blocked User',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([blockedUser, admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: blockedUser.id, isBlocked: false },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.isBlocked, false);
  });

  it('should update manual verification status (isVerified: true / false)', async () => {
    const unverifiedUser: AdminUserRecord = {
      id: 'u_unverified',
      email: 'unverified@shop.vn',
      name: 'Unverified User',
      role: 'CUSTOMER',
      isVerified: false,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([unverifiedUser, admin]);

    // Admin manually verifies user
    const resVerify = await updateUserRbac(
      { adminId: admin.id, userId: unverifiedUser.id, isVerified: true },
      delegate
    );
    assert.equal(resVerify.success, true);
    assert.equal(resVerify.user?.isVerified, true);

    // Admin reverts verification
    const resUnverify = await updateUserRbac(
      { adminId: admin.id, userId: unverifiedUser.id, isVerified: false },
      delegate
    );
    assert.equal(resUnverify.success, true);
    assert.equal(resUnverify.user?.isVerified, false);
  });

  it('should support simultaneous updates of role and isBlocked status', async () => {
    const user: AdminUserRecord = {
      id: 'u_mixed',
      email: 'mixed@shop.vn',
      name: 'Mixed Update',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin: AdminUserRecord = {
      id: 'admin_root',
      email: 'admin@shop.vn',
      name: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([user, admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: user.id, role: 'STAFF', isBlocked: true },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.role, 'STAFF');
    assert.equal(result.user?.isBlocked, true);
  });
});

describe('RBAC - Safety Rules & Invariants', () => {
  it('should PREVENT admin from self-blocking (userId === adminId && isBlocked === true)', async () => {
    const admin: AdminUserRecord = {
      id: 'admin_current',
      email: 'admin@shop.vn',
      name: 'Current Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([admin]);

    const result = await updateUserRbac(
      { adminId: admin.id, userId: admin.id, isBlocked: true },
      delegate
    );

    assert.equal(result.success, false);
    assert.equal(result.statusCode, 400);
    assert.match(result.error || '', /không thể tự khóa tài khoản của chính mình/i);
  });

  it('should ALLOW admin to lock another user or staff or another admin', async () => {
    const admin1: AdminUserRecord = {
      id: 'admin_1',
      email: 'admin1@shop.vn',
      name: 'Admin One',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin2: AdminUserRecord = {
      id: 'admin_2',
      email: 'admin2@shop.vn',
      name: 'Admin Two',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([admin1, admin2]);

    // Admin 1 blocks Admin 2 (different users) -> Allowed
    const result = await updateUserRbac(
      { adminId: admin1.id, userId: admin2.id, isBlocked: true },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.isBlocked, true);
  });

  it('should PREVENT demoting the sole ADMIN in the system (adminCount <= 1)', async () => {
    const soleAdmin: AdminUserRecord = {
      id: 'sole_admin_id',
      email: 'soleadmin@shop.vn',
      name: 'The Only Admin',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const customer: AdminUserRecord = {
      id: 'cust_1',
      email: 'cust1@shop.vn',
      name: 'Customer',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([soleAdmin, customer]);

    // Attempt 1: Sole admin tries to self-demote to STAFF
    const selfDemoteRes = await updateUserRbac(
      { adminId: soleAdmin.id, userId: soleAdmin.id, role: 'STAFF' },
      delegate
    );
    assert.equal(selfDemoteRes.success, false);
    assert.equal(selfDemoteRes.statusCode, 400);
    assert.match(selfDemoteRes.error || '', /hạ quyền Admin duy nhất/i);

    // Attempt 2: Sole admin tries to demote to CUSTOMER
    const toCustomerRes = await updateUserRbac(
      { adminId: soleAdmin.id, userId: soleAdmin.id, role: 'CUSTOMER' },
      delegate
    );
    assert.equal(toCustomerRes.success, false);
    assert.equal(toCustomerRes.statusCode, 400);
    assert.match(toCustomerRes.error || '', /hạ quyền Admin duy nhất/i);
  });

  it('should ALLOW sole admin to update other fields (e.g. isVerified) without triggering demotion error', async () => {
    const soleAdmin: AdminUserRecord = {
      id: 'sole_admin_id',
      email: 'soleadmin@shop.vn',
      name: 'The Only Admin',
      role: 'ADMIN',
      isVerified: false,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([soleAdmin]);

    const result = await updateUserRbac(
      { adminId: soleAdmin.id, userId: soleAdmin.id, isVerified: true },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.isVerified, true);
    assert.equal(result.user?.role, 'ADMIN');
  });

  it('should ALLOW demoting an admin when multiple admins exist (adminCount > 1)', async () => {
    const admin1: AdminUserRecord = {
      id: 'admin_1',
      email: 'admin1@shop.vn',
      name: 'Admin 1',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const admin2: AdminUserRecord = {
      id: 'admin_2',
      email: 'admin2@shop.vn',
      name: 'Admin 2',
      role: 'ADMIN',
      isVerified: true,
      isBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([admin1, admin2]);

    // Admin 1 demotes Admin 2 -> since there are 2 admins, this must be allowed
    const result = await updateUserRbac(
      { adminId: admin1.id, userId: admin2.id, role: 'STAFF' },
      delegate
    );

    assert.equal(result.success, true);
    assert.equal(result.user?.role, 'STAFF');

    // Now only 1 admin remains (Admin 1). Attempting to demote Admin 1 should fail!
    const failedDemote = await updateUserRbac(
      { adminId: admin1.id, userId: admin1.id, role: 'CUSTOMER' },
      delegate
    );
    assert.equal(failedDemote.success, false);
    assert.equal(failedDemote.statusCode, 400);
    assert.match(failedDemote.error || '', /Admin duy nhất/i);
  });
});

describe('RBAC - Login Enforcement for Blocked Accounts', () => {
  it('should BLOCK credentials login if user isBlocked === true with explicit error', async () => {
    const hash = await bcrypt.hash('SecretPass123', 10);
    const blockedUser: AdminUserRecord = {
      id: 'blocked_user_id',
      email: 'blocked@shop.vn',
      name: 'Blocked Person',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: true, // BLOCKED
      passwordHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([blockedUser]);

    await assert.rejects(
      async () => {
        await authorizeCredentialsLogin({
          credentials: { email: 'blocked@shop.vn', password: 'SecretPass123' },
          prismaUser: delegate,
        });
      },
      (err: Error) => {
        assert.match(err.message, /Tài khoản của bạn đã bị tạm khóa/i);
        return true;
      }
    );
  });

  it('should ALLOW credentials login if user isBlocked === false and password is valid', async () => {
    const hash = await bcrypt.hash('CorrectPassword123', 10);
    const activeUser: AdminUserRecord = {
      id: 'active_user_id',
      email: 'active@shop.vn',
      name: 'Nguyen Van Active',
      role: 'STAFF',
      isVerified: true,
      isBlocked: false,
      passwordHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([activeUser]);

    const sessionUser = await authorizeCredentialsLogin({
      credentials: { email: '  Active@shop.vn ', password: 'CorrectPassword123' },
      prismaUser: delegate,
    });

    assert.ok(sessionUser);
    assert.equal(sessionUser?.id, 'active_user_id');
    assert.equal(sessionUser?.email, 'active@shop.vn');
    assert.equal(sessionUser?.name, 'Nguyen Van Active');
    assert.equal(sessionUser?.role, 'STAFF');
    assert.equal(sessionUser?.isBlocked, false);
  });

  it('should REJECT credentials login if user is not verified (isVerified === false)', async () => {
    const hash = await bcrypt.hash('SomePassword', 10);
    const unverifiedUser: AdminUserRecord = {
      id: 'unverified_id',
      email: 'unverified@shop.vn',
      name: 'Unverified',
      role: 'CUSTOMER',
      isVerified: false, // NOT VERIFIED
      isBlocked: false,
      passwordHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([unverifiedUser]);

    const result = await authorizeCredentialsLogin({
      credentials: { email: 'unverified@shop.vn', password: 'SomePassword' },
      prismaUser: delegate,
    });

    assert.equal(result, null);
  });

  it('should REJECT credentials login if password does not match', async () => {
    const hash = await bcrypt.hash('RealPassword123', 10);
    const activeUser: AdminUserRecord = {
      id: 'user_active',
      email: 'user@shop.vn',
      name: 'User',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: false,
      passwordHash: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { delegate } = createMockPrismaUsers([activeUser]);

    const result = await authorizeCredentialsLogin({
      credentials: { email: 'user@shop.vn', password: 'WrongPassword' },
      prismaUser: delegate,
    });

    assert.equal(result, null);
  });

  it('should BLOCK Google OAuth sign-in if existing account isBlocked === true with explicit error', async () => {
    const blockedDbUser: UserDbRecord = {
      id: 'google_blocked_id',
      email: 'blocked.google@gmail.com',
      name: 'Google Blocked User',
      role: 'CUSTOMER',
      isVerified: true,
      isBlocked: true, // BLOCKED
    };

    const mockPrismaUser: UserPrismaDelegate = {
      async findUnique({ where }) {
        if (where.email === 'blocked.google@gmail.com') return blockedDbUser;
        return null;
      },
      async create() {
        throw new Error('Should not create new user');
      },
    };

    const user: GoogleSignInUser = {
      name: 'Google User',
      email: 'blocked.google@gmail.com',
    };

    await assert.rejects(
      async () => {
        await handleGoogleSignIn({
          user,
          account: { provider: 'google' },
          prismaUser: mockPrismaUser,
        });
      },
      (err: Error) => {
        assert.match(err.message, /Tài khoản của bạn đã bị tạm khóa/i);
        return true;
      }
    );
  });

  it('should ALLOW Google OAuth sign-in for active account and populate session properties', async () => {
    const activeDbUser: UserDbRecord = {
      id: 'google_active_id',
      email: 'active.google@gmail.com',
      name: 'Active Google',
      role: 'STAFF',
      isVerified: true,
      isBlocked: false,
    };

    const mockPrismaUser: UserPrismaDelegate = {
      async findUnique({ where }) {
        if (where.email === 'active.google@gmail.com') return activeDbUser;
        return null;
      },
      async create() {
        throw new Error('Should not create new user');
      },
    };

    const user: GoogleSignInUser = {
      name: 'Active Google',
      email: 'Active.Google@gmail.com',
    };

    const result = await handleGoogleSignIn({
      user,
      account: { provider: 'google' },
      prismaUser: mockPrismaUser,
    });

    assert.equal(result, true);
    assert.equal(user.id, 'google_active_id');
    assert.equal(user.role, 'STAFF');
    assert.equal(user.isBlocked, false);
  });
});
