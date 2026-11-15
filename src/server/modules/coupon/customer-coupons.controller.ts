import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { CustomerCouponError, listCustomerCoupons, saveCustomerCoupon, removeCustomerCoupon } from '@server/modules/coupon/customer-coupons.service';

const headers = { 'Cache-Control': 'private, no-store' };
function handleError(error: unknown) {
  if (error instanceof CustomerCouponError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  console.error('Customer coupon request failed:', error);
  return NextResponse.json({ error: 'Không thể tải hoặc lưu voucher. Vui lòng thử lại.' }, { status: 500, headers });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    return NextResponse.json({ coupons: await listCustomerCoupons(session?.user?.id ?? null) }, { headers });
  } catch (error) { return handleError(error); }
}

export async function GET_SAVED() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Vui lòng đăng nhập để xem voucher đã lưu' }, { status: 401, headers });
    return NextResponse.json({ coupons: await listCustomerCoupons(session.user.id, true) }, { headers });
  } catch (error) { return handleError(error); }
}

async function mutate(req: Request, remove: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Vui lòng đăng nhập để lưu voucher' }, { status: 401, headers });
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400, headers }); }
    const couponId = body && typeof body === 'object' && 'couponId' in body ? body.couponId : null;
    if (typeof couponId !== 'string' || !couponId.trim() || couponId.length > 128) {
      return NextResponse.json({ error: 'Voucher không hợp lệ' }, { status: 400, headers });
    }
    if (remove) await removeCustomerCoupon(session.user.id, couponId);
    else await saveCustomerCoupon(session.user.id, couponId);
    return NextResponse.json({ saved: !remove }, { headers });
  } catch (error) { return handleError(error); }
}

export async function POST(req: Request) { return mutate(req, false); }
export async function DELETE(req: Request) { return mutate(req, true); }
