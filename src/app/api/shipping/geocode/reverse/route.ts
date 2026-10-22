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
    if (body.useIp === true || body.latitude == null || body.longitude == null) {
      const ipResult = await resolveLocationByIp(clientIp);
      if (ipResult) {
        return NextResponse.json({
          success: true,
          data: ipResult,
          method: 'IP_GEOLOCATION',
        });
      }
      return NextResponse.json(
        { success: false, error: 'Không xác định được vị trí theo IP' },
        { status: 422 }
      );
    }

    const lat = Number(body.latitude);
    const lon = Number(body.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const result = await reverseGeocodeCoordinates(lat, lon);
      return NextResponse.json({
        success: true,
        data: result,
        method: 'GPS',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Tọa độ không hợp lệ' },
      { status: 400 }
    );
  } catch (error) {
    console.error('API reverse geocode error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ khi xử lý tọa độ' },
      { status: 500 }
    );
  }
}
