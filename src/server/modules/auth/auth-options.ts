import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../database/prisma.ts';
import { authorizeCredentialsLogin } from '../admin/admin-rbac.service.ts';
import { getStaffPermissions } from '../admin/permission.service.ts';
import type { StaffPermission } from '../../../shared/constants/permissions.ts';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        return authorizeCredentialsLogin({
          credentials,
          prismaUser: prisma.user as unknown as Parameters<
            typeof authorizeCredentialsLogin
          >[0]['prismaUser'],
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isBlocked = user.isBlocked;
      }
      if (token.role === 'STAFF' && token.id) {
        token.permissions = await getStaffPermissions(token.id as string);
      } else {
        token.permissions = [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isBlocked = token.isBlocked as boolean;
        session.user.permissions = (token.permissions as StaffPermission[]) || [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' as const },
  secret: process.env.NEXTAUTH_SECRET,
};
