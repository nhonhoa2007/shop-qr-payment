import { NextResponse } from 'next/server';
import { compareProducts } from './comparison.service.ts';
import type { CompareInput } from '@shared/types/comparison.ts';

/**
 * POST /api/products/compare
 * So sánh 2–3 sản phẩm/biến thể cùng danh mục với thông số canonical, điểm số và bằng chứng thực tế
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CompareInput;

    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ: items phải là mảng sản phẩm cần so sánh' },
        { status: 400 }
      );
    }

    const comparison = await compareProducts(body);
    return NextResponse.json({ success: true, comparison });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi hệ thống khi so sánh sản phẩm';
    const status = message.includes('Yêu cầu') || message.includes('trùng') || message.includes('danh mục') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/products/compare?productIds=p1,p2&useCase=office_study
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawIds = searchParams.get('productIds');
    const useCase = searchParams.get('useCase') || undefined;
    const rawDays = searchParams.get('salesWindowDays');
    const salesWindowDays = rawDays ? Number(rawDays) : undefined;

    if (!rawIds) {
      return NextResponse.json(
        { error: 'productIds là bắt buộc (ví dụ: ?productIds=id1,id2)' },
        { status: 400 }
      );
    }

    const productIds = rawIds.split(',').map((id) => id.trim()).filter(Boolean);
    const items = productIds.map((productId) => ({ productId }));

    const comparison = await compareProducts({
      items,
      useCase,
      salesWindowDays,
    });

    return NextResponse.json({ success: true, comparison });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi hệ thống khi so sánh sản phẩm';
    const status = message.includes('Yêu cầu') || message.includes('trùng') || message.includes('danh mục') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
