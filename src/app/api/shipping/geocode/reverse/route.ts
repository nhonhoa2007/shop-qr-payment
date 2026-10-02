import { NextResponse } from 'next/server';
import { reverseGeocodeCoordinates, resolveLocationByIp } from '@server/modules/shipping/geocoding.service';
import { getClientIp } from '@server/infrastructure/rate-limit';

interface ReverseGeocodeBody {
  latitude?: unknown;
  longitude?: unknown;
  useIp?: unknown;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ReverseGeocodeBody;
    const clientIp = getClientIp(req);

    // Nếu yêu cầu định vị qua IP hoặc không truyền tọa độ
    if (body.useIp || body.latitude == null || body.longitude == null) {
      const ipResult = await resolveLocationByIp(clientIp);
      if (ipResult) {
        return NextResponse.json({
          success: true,
          data: ipResult,
          method: 'IP_GEOLOCATION',
        });
      }
    }

    const lat = Number(body.latitude);
    const lon = Number(body.longitude);

    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      const result = await reverseGeocodeCoordinates(lat, lon);

      // Nếu GPS tọa độ không khớp tỉnh thành nào, thử fallback qua IP
      if (!result.isMatched) {
        const ipFallback = await resolveLocationByIp(clientIp);
        if (ipFallback && ipFallback.isMatched) {
          return NextResponse.json({
            success: true,
            data: ipFallback,
            method: 'IP_FALLBACK',
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: result,
        method: 'GPS',
      });
    }

    // Cuối cùng thử IP
    const fallback = await resolveLocationByIp(clientIp);
    return NextResponse.json({
      success: !!fallback,
      data: fallback,
      method: 'IP_FINAL_FALLBACK',
    });
  } catch (error) {
    console.error('API reverse geocode error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ khi xử lý tọa độ' },
      { status: 500 }
    );
  }
}
