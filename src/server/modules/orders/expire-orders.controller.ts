import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expireUnpaidOrders } from '@/lib/inventory';
import { verifyCronAuth } from '@/lib/cron-auth';

export async function GET(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expiredCount = await expireUnpaidOrders(prisma);

    return NextResponse.json({
      success: true,
      expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error expiring orders via cron:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
