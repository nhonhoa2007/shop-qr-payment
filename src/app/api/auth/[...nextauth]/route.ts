import NextAuth from 'next-auth';
import { authOptions } from '@/server/modules/auth/auth-options';

export { authOptions };

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
