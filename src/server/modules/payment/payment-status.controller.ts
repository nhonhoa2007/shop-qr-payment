import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@server/modules/auth/auth-options';
import {
  findPaymentRequestByCode,
  type PaymentRequestRecord,
  type PaymentRequestStore,
} from '@server/modules/payment/payment-request.service';

export interface PaymentStatusDependencies {
  now(): Date;
  findByCode(code: string): Promise<PaymentRequestRecord | null>;
  getCurrentUserId(): Promise<string | null>;
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function getPaymentStatusResponse(
  inputCode: string,
  deps: PaymentStatusDependencies
): Promise<NextResponse> {
  const code = inputCode.trim().toUpperCase();
  if (!/^(?:DH|NAP)[A-Z0-9]{4,}$/.test(code)) {
    return json({ error: 'Mã thanh toán không hợp lệ' }, 400);
  }

  const request = await deps.findByCode(code);
  if (!request) return json({ error: 'Không tìm thấy yêu cầu thanh toán' }, 404);

  if (request.kind === 'WALLET_TOPUP') {
    const userId = await deps.getCurrentUserId();
    if (!userId) return json({ error: 'Unauthorized' }, 401);
    if (request.userId !== userId) return json({ error: 'Forbidden' }, 403);
  }

  const status = request.status === 'PENDING' && request.expiresAt <= deps.now()
    ? 'EXPIRED'
    : request.status;

  return json({
    success: true,
    data: {
      code: request.code,
      kind: request.kind,
      status,
      expiresAt: request.expiresAt.toISOString(),
      completedAt: request.completedAt?.toISOString() ?? null,
    },
  });
}

function createDefaultDependencies(): PaymentStatusDependencies {
  return {
    now: () => new Date(),
    findByCode: (code) => findPaymentRequestByCode(
      prisma as unknown as PaymentRequestStore,
      code
    ),
    getCurrentUserId: async () => {
      const session = await getServerSession(authOptions);
      return session?.user?.id ?? null;
    },
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  try {
    const { code } = await params;
    return await getPaymentStatusResponse(code, createDefaultDependencies());
  } catch (error) {
    console.error('[Payment Status] Lỗi truy vấn trạng thái:', error);
    return json({ error: 'Không thể kiểm tra trạng thái thanh toán' }, 500);
  }
}
