import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';

interface ReviewBody {
  orderId?: unknown;
  outcome?: unknown;
  trackingCode?: unknown;
  shippingFee?: unknown;
  note?: unknown;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  try {
    const body = await req.json() as ReviewBody;
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const outcome = body.outcome;
    const trackingCode = typeof body.trackingCode === 'string' ? body.trackingCode.trim() : '';
    if (!orderId || !note || (outcome !== 'NOT_CREATED' && outcome !== 'CREATED')) return NextResponse.json({ error: 'Thiếu đơn, kết quả kiểm tra hoặc ghi chú' }, { status: 400 });
    if (outcome === 'CREATED' && (!/^[A-Za-z0-9-]{5,80}$/.test(trackingCode) || !Number.isSafeInteger(body.shippingFee) || Number(body.shippingFee) < 0)) {
      return NextResponse.json({ error: 'Mã vận đơn hoặc phí GHN không hợp lệ' }, { status: 400 });
    }
    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { shipment: true } });
      if (current.fulfillmentState !== 'REVIEW' || current.status !== 'CONFIRMED' || current.paymentStatus !== 'PAID') throw new Error('Đơn không còn chờ kiểm tra GHN');
      if (current.shipment && (outcome === 'NOT_CREATED' || current.shipment.trackingCode !== trackingCode)) throw new Error('Đơn đã có vận đơn; dùng đúng mã vận đơn đã lưu để xác nhận');
      const reviewLog = `[GHN ${new Date().toISOString()} admin:${session.user.id} ${outcome}] ${note}`;
      const claimed = await tx.order.updateMany({
        where: { id: orderId, fulfillmentState: 'REVIEW', status: 'CONFIRMED', paymentStatus: 'PAID' },
        data: { fulfillmentState: outcome === 'CREATED' ? 'CREATED' : 'NONE', status: outcome === 'CREATED' ? 'PROCESSING' : 'CONFIRMED', note: [current.note, reviewLog].filter(Boolean).join('\n') },
      });
      if (claimed.count !== 1) throw new Error('Đơn đã được xử lý đồng thời');
      if (outcome === 'CREATED' && !current.shipment) await tx.shipment.create({ data: {
        orderId, carrier: 'GHN', trackingCode, shippingFee: Number(body.shippingFee), codAmount: 0,
        status: 'READY_TO_PICK', shippingLogs: [{ status: 'READY_TO_PICK', description: reviewLog, timestamp: new Date().toISOString() }],
      } });
      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể đối soát GHN' }, { status: 400 });
  }
}
