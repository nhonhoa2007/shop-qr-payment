import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { AdminService } from './admin.service';
import type { AdminAnalyticsResponse, AnalyticsRange } from '@shared/types';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    let range: AnalyticsRange = '7days';
    if (request?.url) {
      try {
        const { searchParams } = new URL(request.url);
        const rangeParam = searchParams.get('range');
        if (rangeParam === 'today' || rangeParam === 'month' || rangeParam === '7days') {
          range = rangeParam;
        }
      } catch {
        // Fallback default
      }
    }

    const analytics = await AdminService.getAdminAnalytics(range);
    return NextResponse.json(analytics);
  } catch (error: unknown) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Lỗi tải dữ liệu thống kê' }, { status: 500 });
  }
}

export type { AdminAnalyticsResponse };
