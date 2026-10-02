export interface GoogleSignInUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  isBlocked?: boolean;
}

export interface GoogleSignInAccount {
  provider: string;
}

export interface UserDbRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isVerified: boolean;
  isBlocked?: boolean;
}

export interface UserPrismaDelegate {
  findUnique(args: { where: { email: string } }): Promise<UserDbRecord | null>;
  create(args: {
    data: {
      email: string;
      name?: string | null;
      avatar?: string | null;
      role: 'CUSTOMER' | 'ADMIN';
      isVerified: boolean;
      passwordHash: string;
    };
  }): Promise<UserDbRecord>;
}

export async function handleGoogleSignIn({
  user,
  account,
  prismaUser,
}: {
  user: GoogleSignInUser;
  account?: GoogleSignInAccount | null;
  prismaUser: UserPrismaDelegate;
}): Promise<boolean> {
  if (account?.provider === 'google') {
    if (!user.email) return false;
    const email = user.email.trim().toLowerCase();

    let dbUser = await prismaUser.findUnique({
      where: { email },
    });

    if (!dbUser) {
      dbUser = await prismaUser.create({
        data: {
          email,
          name: user.name || null,
          avatar: user.image || null,
          role: 'CUSTOMER',
          isVerified: true,
          passwordHash: '',
        },
      });
    }

    if (dbUser.isBlocked) {
      throw new Error('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.');
    }

    user.id = dbUser.id;
    user.role = dbUser.role;
    user.isBlocked = dbUser.isBlocked ?? false;
    return true;
  }
  return true;
}
