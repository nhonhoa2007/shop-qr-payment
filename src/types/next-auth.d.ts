import { DefaultSession } from 'next-auth';
import type { StaffPermission } from '@/shared/constants/permissions';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      permissions?: StaffPermission[];
      isBlocked?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    permissions?: StaffPermission[];
    isBlocked?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    permissions?: StaffPermission[];
    isBlocked?: boolean;
  }
}
