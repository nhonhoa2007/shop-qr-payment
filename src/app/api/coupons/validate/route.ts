import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { validateCoupon } from '@server/modules/admin/coupon.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, subtotal } = body;

    if (!code || typeof subtotal !== 'number') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const result = await validateCoupon(code, userId, subtotal);

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Coupon validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}