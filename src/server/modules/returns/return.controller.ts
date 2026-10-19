import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import { bigIntJsonReplacer } from '@server/modules/money/money-serialization';
import {
  requestReturn,
  transitionReturn,
  applyReturnDisposition,
} from '@server/modules/returns/return.service';
import type {
  RequestReturnInput,
  ReturnTransitionInput,
  ReturnDispositionInput,
} from '@shared/types/return';

function toSafeJson<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, bigIntJsonReplacer));
}

export async function createReturnRequestHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để tạo yêu cầu đổi trả' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as RequestReturnInput;
    if (!body.orderId || !body.items || body.items.length === 0 || !body.reason) {
      return NextResponse.json(
        { error: 'Thiếu thông tin đơn hàng, danh sách sản phẩm hoặc lý do đổi trả' },
        { status: 400 }
      );
    }

    const ret = await (prisma as any).$transaction(async (tx: any) => {
      return requestReturn(tx, body, session.user.id);
    });

    return NextResponse.json({ returnRequest: ret }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi xử lý yêu cầu đổi trả' },
      { status: error.message?.includes('not found') ? 404 : 400 }
    );
  }
}

export async function getReturnRequestsHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');

  const isOperator = resolveOperatorAccess(session.user, 'warranties');

  const where: any = {};
  if (!isOperator) {
    where.customerId = session.user.id;
  } else if (searchParams.get('customerId')) {
    where.customerId = searchParams.get('customerId');
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const returnRequests = await (prisma as any).returnRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          orderCode: true,
          status: true,
          completedAt: true,
        },
      },
    },
  });

  return NextResponse.json(toSafeJson({ returnRequests }));
}

export async function getReturnRequestDetailHandler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { id } = await params;

  const returnRequest = await (prisma as any).returnRequest.findUnique({
    where: { id },
    include: {
      order: true,
      refundCase: true,
    },
  });

  if (!returnRequest) {
    return NextResponse.json({ error: 'Không tìm thấy yêu cầu đổi trả' }, { status: 404 });
  }

  const isOperator = resolveOperatorAccess(session.user, 'warranties');
  if (!isOperator && returnRequest.customerId !== session.user.id) {
    return NextResponse.json({ error: 'Bạn không có quyền xem yêu cầu này' }, { status: 403 });
  }

  return NextResponse.json(toSafeJson({ returnRequest }));
}

export async function transitionReturnHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { id } = await params;
  const isOperator = resolveOperatorAccess(session.user, 'warranties');

  try {
    const body = await req.json();
    const { targetStatus, expectedVersion, operationKey, note, reason, disposition, dispositionNotes } = body;

    if (!targetStatus || expectedVersion === undefined || !operationKey) {
      return NextResponse.json(
        { error: 'Thiếu targetStatus, expectedVersion hoặc operationKey' },
        { status: 400 }
      );
    }

    // Customer can only CANCEL their own return
    if (!isOperator) {
      const existing = await (prisma as any).returnRequest.findUnique({ where: { id } });
      if (!existing || existing.customerId !== session.user.id) {
        return NextResponse.json({ error: 'Không có quyền thao tác' }, { status: 403 });
      }
      if (targetStatus !== 'CANCELLED') {
        return NextResponse.json({ error: 'Khách hàng chỉ có thể hủy yêu cầu đổi trả' }, { status: 403 });
      }
    }

    const input: ReturnTransitionInput = {
      requestId: id,
      targetStatus,
      expectedVersion,
      operationKey,
      actorId: session.user.id,
      actorRole: session.user.role || (isOperator ? 'STAFF' : 'CUSTOMER'),
      note,
      reason,
      disposition,
      dispositionNotes,
    };

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      return transitionReturn(tx, input);
    });

    return NextResponse.json({ returnRequest: updated });
  } catch (error: any) {
    const status = error.message?.includes('Stale return request version') ? 409 : 400;
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật trạng thái đổi trả' }, { status });
  }
}

export async function applyReturnDispositionHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const isOperator = resolveOperatorAccess(session.user, 'warranties');
  if (!isOperator) {
    return NextResponse.json({ error: 'Không có quyền kiểm định kho' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { disposition, operationKey, notes } = body;

    if (!disposition || !operationKey) {
      return NextResponse.json({ error: 'Thiếu disposition hoặc operationKey' }, { status: 400 });
    }

    const input: ReturnDispositionInput = {
      requestId: id,
      disposition,
      operationKey,
      actorId: session.user.id,
      actorRole: session.user.role || 'STAFF',
      notes,
    };

    await (prisma as any).$transaction(async (tx: any) => {
      return applyReturnDisposition(tx, input);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi xử lý kiểm định kho' }, { status: 400 });
  }
}
