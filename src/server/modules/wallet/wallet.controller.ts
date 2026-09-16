import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getWalletDetails } from '@/lib/wallet';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để xem thông tin ví' }, { status: 401 });
    }

    const wallet = await getWalletDetails(session.user.id);

    return NextResponse.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    return NextResponse.json({ error: 'Lỗi lấy thông tin ví nội bộ' }, { status: 500 });
  }
}
