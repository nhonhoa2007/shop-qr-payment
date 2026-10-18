import { NextResponse } from 'next/server';
import { requireOperatorPermission } from '@server/modules/admin/guards';
import { prisma } from '@server/database/prisma';
import {
  createDataSource,
  transitionDataSource,
  updateDataSourcePayloadOrChecksum,
} from '@server/modules/catalog/data-source.service';
import type { DataSourceType, SourceStatus } from '@shared/types/catalog';

/**
 * GET /api/admin/data-sources
 * Liệt kê danh sách DataSource theo bộ lọc
 * Yêu cầu quyền: Operator 'knowledge' (hoặc ADMIN)
 */
export async function GET(req: Request) {
  try {
    const guard = await requireOperatorPermission('knowledge');
    if (!guard.authorized) {
      return guard.response;
    }

    const { searchParams } = new URL(req.url);
    const sourceType = searchParams.get('sourceType') as DataSourceType | null;
    const status = searchParams.get('status') as SourceStatus | null;
    const market = searchParams.get('market');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);

    const where: Record<string, unknown> = {};
    if (sourceType) where.sourceType = sourceType;
    if (status) where.status = status;
    if (market) where.market = market;

    const [dataSources, total] = await Promise.all([
      prisma.dataSource.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reviewer: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.dataSource.count({ where }),
    ]);

    return NextResponse.json({
      dataSources,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch data sources error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/data-sources
 * Tạo mới, chuyển trạng thái hoặc cập nhật payload DataSource
 * - STAFF 'knowledge' có thể tạo mới và chuẩn bị nguồn (LICENSE_REVIEW, MAPPING_REVIEW)
 * - ADMIN độc quyền kích hoạt (ACTIVE) nguồn dữ liệu
 */
export async function POST(req: Request) {
  try {
    const guard = await requireOperatorPermission('knowledge');
    if (!guard.authorized) {
      return guard.response;
    }

    const { user } = guard;
    const body = await req.json();
    const action = body.action || 'create';

    // 1. Chuyển trạng thái
    if (action === 'transition') {
      const { id, targetStatus, rejectionReason } = body;
      if (!id || !targetStatus) {
        return NextResponse.json(
          { error: 'id và targetStatus là bắt buộc' },
          { status: 400 }
        );
      }

      // Invariant: Chỉ ADMIN mới được kích hoạt trạng thái ACTIVE
      if (targetStatus === 'ACTIVE' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Chỉ Quản trị viên cấp cao (ADMIN) mới có quyền kích hoạt (ACTIVE) nguồn dữ liệu' },
          { status: 403 }
        );
      }

      const updated = await transitionDataSource({
        id,
        targetStatus,
        reviewerId: user.id,
        rejectionReason,
      });

      return NextResponse.json({ success: true, dataSource: updated });
    }

    // 2. Cập nhật payload hoặc checksum
    if (action === 'update_payload') {
      const { id, checksum, payload } = body;
      if (!id) {
        return NextResponse.json({ error: 'id là bắt buộc' }, { status: 400 });
      }

      const updated = await updateDataSourcePayloadOrChecksum(id, {
        checksum,
        payload,
      });

      return NextResponse.json({ success: true, dataSource: updated });
    }

    // 3. Tạo mới DataSource (Mặc định ở DISCOVERED)
    const {
      name,
      sourceType,
      publisher,
      url,
      license,
      market,
      version,
      checksum,
      isSynthetic,
      payload,
    } = body;

    const created = await createDataSource({
      name,
      sourceType,
      publisher,
      url,
      license,
      market,
      version,
      checksum,
      isSynthetic,
      payload,
    });

    return NextResponse.json({ success: true, dataSource: created }, { status: 201 });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errMessage }, { status: 400 });
  }
}
