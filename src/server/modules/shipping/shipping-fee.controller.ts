import { NextResponse } from 'next/server';
import { calculateGHNFee } from '@server/modules/shipping/ghn.service';

interface CalculateFeeBody {
  toDistrictId?: unknown;
  toWardCode?: unknown;
  weight?: unknown;
  subtotal?: unknown;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CalculateFeeBody;

    const toDistrictId = Number(body.toDistrictId);
    const toWardCode = typeof body.toWardCode === 'string' ? body.toWardCode.trim() : '';
    const weight = Number(body.weight) > 0 ? Number(body.weight) : 500;
    const subtotal = Number(body.subtotal) >= 0 ? Number(body.subtotal) : 0;

    if (!toDistrictId || Number.isNaN(toDistrictId) || !toWardCode) {
      return NextResponse.json(
        { error: 'Thiếu thông tin Quận/Huyện hoặc Phường/Xã nhận hàng' },
        { status: 400 }
      );
    }

    const feeResult = await calculateGHNFee({
      toDistrictId,
      toWardCode,
      weight,
      subtotal,
    });

    return NextResponse.json({
      success: true,
      data: feeResult,
    });
  } catch (error) {
    console.error('Calculate shipping fee error:', error);
    return NextResponse.json({ error: 'Lỗi tính phí vận chuyển' }, { status: 500 });
  }
}
