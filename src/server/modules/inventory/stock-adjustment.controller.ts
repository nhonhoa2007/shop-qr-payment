import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import {
  validateAdjustmentInput,
  adjustStock,
} from './stock-adjustment.service.ts';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !resolveOperatorAccess(session.user, 'products')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateAdjustmentInput(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Dữ liệu không hợp lệ' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return await adjustStock(tx, validation.data!, session.user.id);
    });

    if (!result.success) {
      const isConflict =
        result.error?.toLowerCase().includes('xung đột') ||
        result.error?.toLowerCase().includes('stale');
      return NextResponse.json({ error: result.error }, { status: isConflict ? 409 : 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lỗi điều chỉnh tồn kho' },
      { status: 500 }
    );
  }
}
