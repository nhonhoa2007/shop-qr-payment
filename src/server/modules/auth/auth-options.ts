import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@server/database/prisma';
import { handleGoogleSignIn } from '@/lib/auth-helpers';
import { authorizeCredentialsLogin } from '@/lib/admin-rbac';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
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
    async signIn({ user, account }) {
      return handleGoogleSignIn({
        user,
        account,
        prismaUser: prisma.user,
      });
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isBlocked = user.isBlocked;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isBlocked = token.isBlocked as boolean;
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
