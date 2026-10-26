import { NextResponse } from 'next/server';

// The legacy endpoint accepted an arbitrary amount and transaction ID.
// All reconciliation now uses persisted bank transfers via /api/admin/bank-review.
export async function POST() {
  return NextResponse.json(
    { error: 'Dùng bảng đối soát giao dịch ngân hàng đã ghi nhận.' },
    { status: 410 }
  );
}
