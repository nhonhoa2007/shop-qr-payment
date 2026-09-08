import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleGoogleSignIn,
  type GoogleSignInUser,
  type UserDbRecord,
  type UserPrismaDelegate,
} from '../src/lib/auth-helpers.ts';

describe('Google OAuth Sign In Callback Logic', () => {
  it('should create a new customer user if email does not exist in db', async () => {
    const db: Record<string, UserDbRecord> = {};
    let createCalledWith: unknown = null;

    const mockPrismaUser: UserPrismaDelegate = {
      async findUnique({ where }) {
        return db[where.email] || null;
      },
      async create({ data }) {
        createCalledWith = data;
        const record: UserDbRecord = {
          id: 'new-cuid-123',
          email: data.email,
          name: data.name ?? null,
          role: data.role,
          isVerified: data.isVerified,
        };
        db[data.email] = record;
        return record;
      },
    };

    const user: GoogleSignInUser = {
      name: 'Google Tester',
      email: 'tester@gmail.com',
      image: 'https://example.com/photo.jpg',
    };

    const result = await handleGoogleSignIn({
      user,
      account: { provider: 'google' },
      prismaUser: mockPrismaUser,
    });

    assert.equal(result, true);
    assert.equal(user.id, 'new-cuid-123');
    assert.equal(user.role, 'CUSTOMER');
    assert.deepEqual(createCalledWith, {
      email: 'tester@gmail.com',
      name: 'Google Tester',
      avatar: 'https://example.com/photo.jpg',
      role: 'CUSTOMER',
      isVerified: true,
      passwordHash: '',
    });
  });

  it('should find existing user and attach id and role without creating duplicate', async () => {
    const existingUser: UserDbRecord = {
      id: 'existing-cuid-456',
      email: 'existing@gmail.com',
      name: 'Existing User',
      role: 'ADMIN',
      isVerified: true,
    };

    let createCalled = false;
    const mockPrismaUser: UserPrismaDelegate = {
      async findUnique({ where }) {
        if (where.email === 'existing@gmail.com') return existingUser;
        return null;
      },
      async create() {
        createCalled = true;
        throw new Error('Should not call create');
      },
    };

    const user: GoogleSignInUser = {
      name: 'Google Name',
      email: 'EXISTING@gmail.com', // test case-insensitivity
      image: 'https://example.com/photo.jpg',
    };

    const result = await handleGoogleSignIn({
      user,
      account: { provider: 'google' },
      prismaUser: mockPrismaUser,
    });

    assert.equal(result, true);
    assert.equal(createCalled, false);
    assert.equal(user.id, 'existing-cuid-456');
    assert.equal(user.role, 'ADMIN');
  });

  it('should return false if user email is missing for google provider', async () => {
    const mockPrismaUser: UserPrismaDelegate = {
      async findUnique() {
        return null;
      },
      async create() {
        throw new Error('Should not be called');
      },
    };

    const user: GoogleSignInUser = {
      name: 'No Email User',
      email: null,
    };

    const result = await handleGoogleSignIn({
      user,
      account: { provider: 'google' },
      prismaUser: mockPrismaUser,
    });

    assert.equal(result, false);
  });

  it('should return true without modifying user for non-google provider', async () => {
    const mockPrismaUser: UserPrismaDelegate = {
      async findUnique() {
        return null;
      },
      async create() {
        throw new Error('Should not be called');
      },
    };

    const user: GoogleSignInUser = {
      id: 'credentials-id',
      email: 'user@example.com',
      role: 'CUSTOMER',
    };

    const result = await handleGoogleSignIn({
      user,
      account: { provider: 'credentials' },
      prismaUser: mockPrismaUser,
    });

    assert.equal(result, true);
    assert.equal(user.id, 'credentials-id');
    assert.equal(user.role, 'CUSTOMER');
  });
});
