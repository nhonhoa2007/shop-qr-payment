import { NextResponse } from 'next/server';
import { requireAdmin, requireOperatorPermission } from '@server/modules/admin/guards.ts';
import {
  getProductScores,
  recomputeScores,
} from './scoring.service.ts';
import {
  getCategoryScoringConfig,
  saveCategoryScoringConfig,
} from './scoring-config.service.ts';
import type { RecomputeInput } from '@shared/types/intelligence.ts';

/**
 * GET /api/scores
 * Public endpoint: Tra cứu điểm đánh giá use-case và huy hiệu P/P (Good Value) của sản phẩm
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId') || undefined;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const scores = await getProductScores(productId, variantId);
    return NextResponse.json({ success: true, scores });
  } catch (error) {
    console.error('Get product scores error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/scores/recompute
 * Yêu cầu quyền: ADMIN độc quyền (STAFF không được phép kích hoạt tính toán lại)
 */
export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) {
      return guard.response;
    }

    let input: RecomputeInput = {};
    try {
      const body = await req.json();
      if (body && typeof body === 'object') {
        input = body;
      }
    } catch {
      // Empty body is valid: runs default recompute scope
    }

    const report = await recomputeScores(input, guard.user);
    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    console.error('Recompute scores error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/admin/scoring-rubrics
 * Tra cứu cấu hình chấm điểm của danh mục
 * Yêu cầu quyền: Operator 'scoring' hoặc ADMIN
 */
export async function scoringRubricGET(req: Request) {
  try {
    const guard = await requireOperatorPermission('scoring');
    if (!guard.authorized) {
      return guard.response;
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
    }

    const config = await getCategoryScoringConfig(categoryId);
    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    console.error('Get scoring rubric error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/scoring-rubrics
 * Cập nhật cấu hình chấm điểm của danh mục
 * Yêu cầu quyền: ADMIN độc quyền
 */
export async function scoringRubricPUT(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.authorized) {
      return guard.response;
    }

    const body = await req.json();
    const { categoryId, config } = body || {};

    if (!categoryId || !config) {
      return NextResponse.json({ error: 'categoryId and config are required' }, { status: 400 });
    }

    const savedConfig = await saveCategoryScoringConfig(categoryId, config);
    return NextResponse.json({ success: true, config: savedConfig });
  } catch (error: unknown) {
    console.error('Save scoring rubric error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
