import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkDistributedRateLimit, getClientIp } from '@server/infrastructure/rate-limit';
import { createWalletTopupPaymentLink } from './wallet-topup.service.ts';

interface CreateWalletTopupBody {
  amount?: unknown;
  idempotencyToken?: unknown;
}

/**
 * Controller xử lý yêu cầu khởi tạo phiên nạp tiền ví điện tử qua VietQR PayOS
 *
 * @endpoint POST /api/wallet/topup
 * @security
 * - Bắt buộc xác thực người dùng (Auth Session Guard)
 * - Rate Limiting: Giới hạn 15 request/phút theo IP và User để ngăn chặn spam tạo link
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

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';

    const result = await createWalletTopupPaymentLink({
      userId: session.user.id,
      amount,
      host,
      protocol,
      idempotencyToken,
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Không thể tạo liên kết thanh toán PayOS' },
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
