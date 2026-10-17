import { NextResponse } from 'next/server';
import { quoteShipping, QuoteError } from '@server/modules/shipping/shipping-quote.service';

interface CalculateFeeBody {
  items?: unknown;
  toDistrictId?: unknown;
  toWardCode?: unknown;
  weight?: unknown;
  subtotal?: unknown;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CalculateFeeBody;

    const quote = await quoteShipping(body);

    return NextResponse.json({
      success: true,
      data: { ...quote.fee, subtotal: quote.subtotal },
    });
  } catch (error) {
    console.error('Calculate shipping fee error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi tính phí vận chuyển' }, { status: error instanceof QuoteError ? error.status : 500 });
  }
}
