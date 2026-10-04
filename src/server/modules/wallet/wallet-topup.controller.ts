import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { checkDistributedRateLimit, getClientIp } from '@server/infrastructure/rate-limit';
import { prisma } from '@server/database/prisma';
import {
  createWalletTopupPaymentLink,
  getWalletTopupSession,
  processWalletTopup,
} from './wallet-topup.service.ts';

interface CreateWalletTopupBody {
  amount?: unknown;
  idempotencyToken?: unknown;
}

/**
 * Controller xử lý yêu cầu khởi tạo phiên nạp tiền ví điện tử qua VietQR (Casso)
 *
 * @endpoint POST /api/wallet/topup
 * @security
 * - Bắt buộc xác thực người dùng (Auth Session Guard)
 * - Rate Limiting: Giới hạn 15 request/phút theo IP và User để ngăn chặn spam tạo mã QR
 * - Zero-Trust Client Payload: Kiểm tra nghiêm ngặt số tiền nạp (tối thiểu 10.000đ, tối đa 50.000.000đ)
 */
export async function HandleCreateWalletTopup(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để nạp tiền vào ví' },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(req);
    const rateLimit = await checkDistributedRateLimit(
      `wallet:topup:${session.user.id}:${clientIp}`,
      15,
      60_000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as CreateWalletTopupBody;
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount < 10_000 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { error: 'Số tiền nạp tối thiểu là 10.000đ và phải là số nguyên' },
        { status: 400 }
      );
    }

    if (amount > 50_000_000) {
      return NextResponse.json(
        { error: 'Số tiền nạp tối đa là 50.000.000đ cho mỗi lần nạp' },
        { status: 400 }
      );
    }

    const idempotencyToken =
      req.headers.get('x-idempotency-key') ||
      req.headers.get('idempotency-key') ||
      (typeof body.idempotencyToken === 'string' ? body.idempotencyToken : undefined);

    const result = await createWalletTopupPaymentLink({
      userId: session.user.id,
      amount,
      idempotencyToken,
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Không thể tạo mã VietQR nạp ví' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[Wallet Topup Controller] Lỗi tạo phiên nạp tiền:', error);
    return NextResponse.json(
      { error: 'Lỗi máy chủ trong quá trình khởi tạo phiên nạp tiền ví' },
      { status: 500 }
    );
  }
}

export const POST = HandleCreateWalletTopup;

/**
 * DEV SANDBOX ONLY — mô phỏng "khách đã quét QR & chuyển khoản thành công".
 *
 * @endpoint POST /api/wallet/topup/simulate
 * Chỉ tồn tại để demo/test nạp ví trên máy local (không có Casso webhook gọi về localhost).
 * Endpoint tự vô hiệu ở production: mọi request đều bị từ chối 404.
 */
export async function HandleSimulateWalletTopup(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để mô phỏng nạp tiền' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { topupCode?: unknown };
    const topupCode = typeof body.topupCode === 'string' ? body.topupCode.trim() : '';

    const topupSession = await getWalletTopupSession(topupCode);
    if (!topupSession || topupSession.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Không tìm thấy phiên nạp tiền hợp lệ cho mã đã cung cấp' },
        { status: 400 }
      );
    }

    const result = await processWalletTopup(prisma, {
      topupCode: topupSession.topupCode,
      amount: topupSession.amount,
      userId: topupSession.userId,
      bankTransId: `SANDBOX_${Date.now()}`,
      description: `Nạp tiền vào ví (${topupSession.topupCode}) [dev sandbox]`,
    });

    if (!result.success) {
      return NextResponse.json({ message: result.error || 'Mô phỏng nạp tiền thất bại' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      topupCode: result.topupCode,
    });
  } catch (error) {
    console.error('[Wallet Topup Controller] Lỗi mô phỏng nạp tiền:', error);
    return NextResponse.json({ message: 'Lỗi máy chủ khi mô phỏng nạp tiền' }, { status: 500 });
  }
}
