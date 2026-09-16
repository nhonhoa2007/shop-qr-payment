import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { AdminService } from './admin.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || undefined;
    const role = searchParams.get('role')?.trim() || undefined;
    const status = searchParams.get('status')?.trim() || undefined;

    const customers = await AdminService.getAdminCustomers({
      search,
      role,
      status,
    });

    return NextResponse.json({ customers, users: customers });
  } catch (error: unknown) {
    console.error('Fetch customers error:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách người dùng' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await req.json();
    const userId = body.userId || body.id;
    const { role, isBlocked, isVerified } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Thiếu mã người dùng (userId)' }, { status: 400 });
    }

    const result = await AdminService.updateUser({
      adminId: session.user.id,
      userId,
      role,
      isBlocked,
      isVerified,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error: unknown) {
    console.error('Update customer error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật người dùng' }, { status: 500 });
  }
}
