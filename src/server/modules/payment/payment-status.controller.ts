import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@server/database/prisma';
import { authOptions } from '@server/modules/auth/auth-options';
import {
  expirePendingPaymentRequest,
  findPaymentRequestByCode,
  isPaymentRequestPastGrace,
  type PaymentRequestRecord,
  type PaymentRequestStore,
} from '@server/modules/payment/payment-request.service';

export interface PaymentStatusDependencies {
  now(): Date;
  findByCode(code: string): Promise<PaymentRequestRecord | null>;
  expireByCode(code: string, now: Date): Promise<boolean>;
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

  let currentUserId: string | null = null;
  if (code.startsWith('NAP')) {
    currentUserId = await deps.getCurrentUserId();
    if (!currentUserId) return json({ error: 'Unauthorized' }, 401);
  }

  let request = await deps.findByCode(code);
  if (!request) return json({ error: 'Không tìm thấy yêu cầu thanh toán' }, 404);

  if (request.kind === 'WALLET_TOPUP') {
    currentUserId ??= await deps.getCurrentUserId();
    if (!currentUserId) return json({ error: 'Unauthorized' }, 401);
    if (request.userId !== currentUserId) {
      return json({ error: 'Không tìm thấy yêu cầu thanh toán' }, 404);
    }
  }

  const now = deps.now();
  if (request.status === 'PENDING' && isPaymentRequestPastGrace(request.expiresAt, now)) {
    const expired = await deps.expireByCode(code, now);
    if (expired) {
      request = { ...request, status: 'EXPIRED' };
    } else {
      request = await deps.findByCode(code) ?? request;
    }
  }

  return json({
    success: true,
    data: {
      code: request.code,
      kind: request.kind,
      status: request.status,
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
    expireByCode: (code, now) => expirePendingPaymentRequest(
      prisma as unknown as PaymentRequestStore,
      code,
      now
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
