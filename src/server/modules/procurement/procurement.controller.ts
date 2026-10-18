import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import {
  createPurchaseOrder,
  receivePurchaseOrderItems,
  transitionPurchaseOrder,
} from '@server/modules/procurement/procurement.service';
import type { PurchaseOrderStatus } from '@shared/types/procurement';

export async function getSuppliersHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const suppliers = await (prisma as any).supplier.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ suppliers });
}

export async function createSupplierHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.name || !body.code) {
      return NextResponse.json({ error: 'Tên và mã nhà cung cấp là bắt buộc' }, { status: 400 });
    }

    const supplier = await (prisma as any).supplier.create({
      data: {
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        contactName: body.contactName ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        taxId: body.taxId ?? null,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Mã nhà cung cấp đã tồn tại' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Lỗi tạo nhà cung cấp' }, { status: 500 });
  }
}

export async function getPurchaseOrdersHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const pos = await (prisma as any).purchaseOrder.findMany({
    include: {
      supplier: true,
      items: {
        include: { product: true, variant: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = pos.map((po: any) => ({
    ...po,
    totalAmount: po.totalAmount.toString(),
    items: po.items.map((item: any) => ({
      ...item,
      unitCost: item.unitCost.toString(),
      totalCost: (BigInt(item.unitCost) * BigInt(item.orderedQuantity)).toString(),
    })),
  }));

  return NextResponse.json({ purchaseOrders: serialized });
}

export async function createPurchaseOrderHandler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const po = await prisma.$transaction(async (tx) => {
      return await createPurchaseOrder(tx, {
        ...body,
        createdById: session.user.id,
      });
    });

    return NextResponse.json({ purchaseOrder: po }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi tạo đơn đặt hàng nhập' },
      { status: 400 }
    );
  }
}

export async function getPurchaseOrderDetailHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  const { id } = await params;
  const po = await (prisma as any).purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: { product: true, variant: true },
      },
    },
  });

  if (!po) {
    return NextResponse.json({ error: 'Đơn đặt hàng không tồn tại' }, { status: 404 });
  }

  const serialized = {
    ...po,
    totalAmount: po.totalAmount.toString(),
    items: po.items.map((item: any) => ({
      ...item,
      unitCost: item.unitCost.toString(),
      totalCost: (BigInt(item.unitCost) * BigInt(item.orderedQuantity)).toString(),
    })),
  };

  return NextResponse.json({ purchaseOrder: serialized });
}

export async function updatePurchaseOrderStatusHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const po = await prisma.$transaction(async (tx) => {
      return await transitionPurchaseOrder(tx, {
        purchaseOrderId: id,
        nextStatus: body.nextStatus as PurchaseOrderStatus,
        actorId: session.user.id,
        reason: body.reason,
      });
    });

    return NextResponse.json({ purchaseOrder: po });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi chuyển trạng thái đơn đặt hàng' },
      { status: 400 }
    );
  }
}

export async function receivePurchaseOrderItemsHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !resolveOperatorAccess(session.user, 'inventory')) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.operationKey || !body.items || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: 'operationKey và danh sách items là bắt buộc' },
        { status: 400 }
      );
    }

    const receipt = await prisma.$transaction(async (tx) => {
      return await receivePurchaseOrderItems(tx, {
        operationKey: body.operationKey,
        purchaseOrderId: id,
        actorId: session.user.id,
        reason: body.reason,
        items: body.items,
      });
    });

    return NextResponse.json({ receipt });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Lỗi nhận hàng nhập kho' },
      { status: 400 }
    );
  }
}
