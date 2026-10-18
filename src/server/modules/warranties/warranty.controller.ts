import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import {
  createWarrantyClaim,
  transitionWarranty,
} from '@server/modules/warranties/warranty.service';
import type { CreateWarrantyInput, WarrantyTransitionInput } from '@shared/types/warranty';

export async function createWarrantyClaimHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để tạo yêu cầu bảo hành' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateWarrantyInput;
    if (!body.orderId || !body.orderItemId || !body.issueDescription) {
      return NextResponse.json(
        { error: 'Thiếu thông tin đơn hàng, sản phẩm hoặc mô tả lỗi' },
        { status: 400 }
      );
    }

    const claim = await (prisma as any).$transaction(async (tx: any) => {
      return createWarrantyClaim(tx, body, session.user.id);
    });

    return NextResponse.json({ claim }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi xử lý yêu cầu bảo hành' },
      { status: error.message?.includes('not found') ? 404 : 400 }
    );
  }
}

export async function getWarrantyClaimsHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');

  const isOperator = resolveOperatorAccess(session.user, 'warranties');

  const where: any = {};
  if (!isOperator) {
    // Customers can only list their own claims
    where.customerId = session.user.id;
  } else if (searchParams.get('customerId')) {
    where.customerId = searchParams.get('customerId');
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const claims = await (prisma as any).warrantyClaim.findMany({
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
      orderItem: {
        select: {
          productName: true,
          quantity: true,
          price: true,
        },
      },
      serializedUnit: {
        select: {
          serialNumber: true,
          imei1: true,
        },
      },
    },
  });

  return NextResponse.json({ claims });
}

export async function getWarrantyClaimDetailHandler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { id } = await params;

  const claim = await (prisma as any).warrantyClaim.findUnique({
    where: { id },
    include: {
      order: true,
      orderItem: true,
      serializedUnit: true,
      replacementUnit: true,
      refundCase: true,
    },
  });

  if (!claim) {
    return NextResponse.json({ error: 'Không tìm thấy hồ sơ bảo hành' }, { status: 404 });
  }

  const isOperator = resolveOperatorAccess(session.user, 'warranties');
  if (!isOperator && claim.customerId !== session.user.id) {
    return NextResponse.json({ error: 'Bạn không có quyền xem hồ sơ bảo hành này' }, { status: 403 });
  }

  return NextResponse.json({ claim });
}

export async function transitionWarrantyHandler(
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
    const { targetStatus, expectedVersion, operationKey, note, reason, resolution } = body;

    if (!targetStatus || expectedVersion === undefined || !operationKey) {
      return NextResponse.json(
        { error: 'Thiếu targetStatus, expectedVersion hoặc operationKey' },
        { status: 400 }
      );
    }

    // Customer can only CANCEL their own claim
    if (!isOperator) {
      const claim = await (prisma as any).warrantyClaim.findUnique({ where: { id } });
      if (!claim || claim.customerId !== session.user.id) {
        return NextResponse.json({ error: 'Không có quyền thao tác' }, { status: 403 });
      }
      if (targetStatus !== 'CANCELLED') {
        return NextResponse.json({ error: 'Khách hàng chỉ có thể hủy yêu cầu bảo hành' }, { status: 403 });
      }
    }

    const input: WarrantyTransitionInput = {
      claimId: id,
      targetStatus,
      expectedVersion,
      operationKey,
      actorId: session.user.id,
      actorRole: session.user.role || (isOperator ? 'STAFF' : 'CUSTOMER'),
      note,
      reason,
      resolution,
    };

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      return transitionWarranty(tx, input);
    });

    return NextResponse.json({ claim: updated });
  } catch (error: any) {
    const status = error.message?.includes('Stale warranty claim version') ? 409 : 400;
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật trạng thái bảo hành' }, { status });
  }
}
