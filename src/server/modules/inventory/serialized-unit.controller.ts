import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import {
  assignSerializedUnits,
  registerSerializedUnitsOnReceipt,
} from './serialized-unit.service';

export async function listSerializedUnitsHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const variantId = searchParams.get('variantId');
  const status = searchParams.get('status');
  const orderId = searchParams.get('orderId');

  const where: any = {};
  if (productId) where.productId = productId;
  if (variantId) where.variantId = variantId;
  if (status) where.status = status;
  if (orderId) where.orderId = orderId;

  const units = await (prisma as any).serializedUnit.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      variant: { select: { id: true, title: true, sku: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ units });
}

export async function assignSerializedUnitsHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.orderId || !body.orderItemId || !body.productId || !Array.isArray(body.unitIds)) {
      return NextResponse.json({ error: 'Dữ liệu gán serial không hợp lệ' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await assignSerializedUnits(tx, {
        orderId: body.orderId,
        orderItemId: body.orderItemId,
        productId: body.productId,
        variantId: body.variantId,
        unitIds: body.unitIds,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi gán serial cho đơn hàng' },
      { status: 400 }
    );
  }
}

export async function registerSerializedUnitsHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.productId || !Array.isArray(body.units)) {
      return NextResponse.json({ error: 'Dữ liệu đăng ký serial không hợp lệ' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await registerSerializedUnitsOnReceipt(tx, {
        productId: body.productId,
        variantId: body.variantId,
        purchaseOrderItemId: body.purchaseOrderItemId,
        supplierId: body.supplierId,
        units: body.units,
      });
    });

    return NextResponse.json({ success: true, count: result.registeredCount }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi đăng ký serial / IMEI' },
      { status: 400 }
    );
  }
}
