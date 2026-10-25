import { NextResponse } from 'next/server';
import { reverseGeocodeCoordinates, resolveLocationByIp, type ReverseGeocodeResult } from '@server/modules/shipping/geocoding.service';
import { checkDistributedRateLimit, getClientIp } from '@server/infrastructure/rate-limit';
import { redis } from '@server/infrastructure/redis';

interface ReverseGeocodeBody {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  useIp?: unknown;
}

const COMPLETE_CACHE_TTL_SECONDS = 60 * 60;
const PARTIAL_CACHE_TTL_SECONDS = 5 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function coordinateCacheKey(latitude: number, longitude: number): string {
  // Sáu chữ số thập phân (~11 cm) tránh dùng lại số nhà của điểm lân cận.
  // Cache tồn tại tối đa một giờ và không lưu trực tiếp vào đơn hàng.
  return `cache:reverse-geocode:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = await checkDistributedRateLimit(`reverse-geocode:${clientIp}`, 30, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Bạn đang yêu cầu định vị quá nhanh. Vui lòng thử lại sau.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return NextResponse.json({ success: false, error: 'Content-Type phải là application/json.' }, { status: 415 });
    }

    const parsedBody: unknown = await req.json().catch(() => null);
    if (!isRecord(parsedBody)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    }
    const body = parsedBody as ReverseGeocodeBody;

    if (body.useIp === true) {
      if (body.latitude !== undefined || body.longitude !== undefined) {
        return NextResponse.json({ success: false, error: 'Chỉ chọn một phương thức định vị.' }, { status: 400 });
      }
      const result = await resolveLocationByIp(clientIp);
      return NextResponse.json({
        success: Boolean(result),
        data: result,
        method: 'IP_ESTIMATE',
        ...(result ? {} : { error: 'Không thể ước lượng khu vực từ mạng hiện tại.' }),
      }, { status: result ? 200 : 422 });
    }

    if (body.useIp !== undefined && body.useIp !== false) {
      return NextResponse.json({ success: false, error: 'Phương thức định vị không hợp lệ.' }, { status: 400 });
    }

    const latitude = parseCoordinate(body.latitude, -90, 90);
    const longitude = parseCoordinate(body.longitude, -180, 180);
    if (latitude === null || longitude === null) {
      return NextResponse.json({ success: false, error: 'Tọa độ không hợp lệ.' }, { status: 400 });
    }

    if (body.accuracy !== undefined &&
      (typeof body.accuracy !== 'number' || !Number.isFinite(body.accuracy) || body.accuracy < 0)) {
      return NextResponse.json({ success: false, error: 'Độ chính xác vị trí không hợp lệ.' }, { status: 400 });
    }

    const cacheKey = coordinateCacheKey(latitude, longitude);
    let result = await redis.get<ReverseGeocodeResult>(cacheKey);
    let cacheStatus: 'HIT' | 'MISS' = 'HIT';
    if (!result) {
      result = await reverseGeocodeCoordinates(latitude, longitude);
      cacheStatus = 'MISS';
      // Không negative-cache lỗi provider. Kết quả thiếu cấp xã chỉ cache ngắn để
      // lần thử sau có thể cải thiện khi provider dự phòng phục hồi.
      if (result.providerResponded) {
        const ttl = result.matchLevel === 'WARD'
          ? COMPLETE_CACHE_TTL_SECONDS
          : PARTIAL_CACHE_TTL_SECONDS;
        await redis.set(cacheKey, result, { ex: ttl });
      }
    }

    if (!result.providerResponded) {
      return NextResponse.json({
        success: false,
        data: result,
        method: 'DEVICE_LOCATION',
        error: 'Dịch vụ phân tích vị trí tạm thời không phản hồi. Vui lòng thử lại.',
        cache: cacheStatus,
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: result,
      method: 'DEVICE_LOCATION',
      accuracy: typeof body.accuracy === 'number' ? body.accuracy : null,
      cache: cacheStatus,
    });
  } catch (error) {
    console.error('API reverse geocode error:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi máy chủ khi xử lý tọa độ.' },
      { status: 500 }
    );
  }
}
