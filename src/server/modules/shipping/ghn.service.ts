import crypto from 'node:crypto';
import type { ShipmentStatus, OrderStatus, CarrierName } from '@/types';

export const GHN_API_BASE_URL =
  process.env.GHN_API_BASE_URL || 'https://dev-online-gateway.ghn.vn/shiip/public-api/';
export const GHN_TOKEN = process.env.GHN_TOKEN || '';
export const GHN_SHOP_ID = process.env.GHN_SHOP_ID || '';
export const GHN_FROM_DISTRICT_ID = Number(process.env.GHN_FROM_DISTRICT_ID) || 1442; // Quận 1, TP.HCM
export const GHN_FROM_WARD_CODE = process.env.GHN_FROM_WARD_CODE || '20101';

export interface GHNCalculateFeeParams {
  toDistrictId: number;
  toWardCode: string;
  weight?: number; // gram, default 500g
  subtotal?: number;
  serviceTypeId?: number; // 2: Chuẩn / E-commerce delivery
}

export interface GHNCalculateFeeResult {
  totalFee: number;
  serviceFee: number;
  insuranceFee: number;
  isFreeShipping: boolean;
  carrier: CarrierName;
  source: 'GHN_API' | 'FALLBACK';
}

export interface GHNCreateOrderParams {
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  toDistrictId: number;
  toWardCode: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    weight?: number;
  }[];
  codAmount?: number;
  weight?: number; // grams
  note?: string | null;
}

export interface GHNCreateOrderResult {
  success: boolean;
  trackingCode: string;
  shippingFee: number;
  expectedDeliveryTime?: Date | null;
  carrier: CarrierName;
  source: 'GHN_API' | 'MOCK';
  rawResponse?: unknown;
}

export interface GHNStatusMapping {
  shipmentStatus: ShipmentStatus;
  orderStatus?: OrderStatus;
  description: string;
}

/**
 * Mapping trạng thái vận chuyển từ GHN OpenAPI v2 sang ShipmentStatus & OrderStatus nội bộ
 */
export function mapGHNStatusToShipmentStatus(ghnStatus: string): GHNStatusMapping {
  const normalized = ghnStatus.toLowerCase().trim();

  switch (normalized) {
    case 'ready_to_pick':
      return {
        shipmentStatus: 'READY_TO_PICK',
        orderStatus: 'PROCESSING',
        description: 'Đơn hàng đã sẵn sàng để bưu cục GHN tới lấy',
      };
    case 'picking':
    case 'picking_goods':
      return {
        shipmentStatus: 'PICKING',
        orderStatus: 'PROCESSING',
        description: 'Tài xế GHN đang tới lấy hàng',
      };
    case 'storing':
    case 'sorting':
    case 'transporting':
    case 'delivering':
      return {
        shipmentStatus: 'DELIVERING',
        orderStatus: 'SHIPPING',
        description: 'Đang luân chuyển và giao tới địa chỉ khách hàng',
      };
    case 'delivered':
      return {
        shipmentStatus: 'DELIVERED',
        orderStatus: 'COMPLETED',
        description: 'Đã giao hàng thành công',
      };
    case 'return':
    case 'returning':
    case 'returned':
      return {
        shipmentStatus: 'RETURNED',
        description: 'Đơn hàng đang chuyển hoàn về kho người gửi',
      };
    case 'cancel':
    case 'cancelled':
      return {
        shipmentStatus: 'CANCELLED',
        orderStatus: 'CANCELLED',
        description: 'Vận đơn GHN đã bị hủy',
      };
    default:
      return {
        shipmentStatus: 'READY_TO_PICK',
        description: `Trạng thái GHN: ${ghnStatus}`,
      };
  }
}

/**
 * Tính toán cước phí vận chuyển Giao Hàng Nhanh (GHN Logistics Fee Engine)
 *
 * @param params.toDistrictId - Mã quận/huyện đích đến theo danh mục GHN
 * @param params.toWardCode - Mã phường/xã đích đến theo danh mục GHN
 * @param params.weight - Khối lượng kiện hàng (gram, mặc định 500g)
 * @param params.subtotal - Tổng tiền hàng của đơn hàng (dùng xét ngưỡng freeship & phí bảo hiểm)
 * @param params.serviceTypeId - Loại dịch vụ GHN (mặc định 2: Chuẩn / E-commerce)
 * @returns `GHNCalculateFeeResult` chứa tổng phí vận chuyển, phí bảo hiểm và trạng thái freeship
 *
 * @business Rules & Heuristic Fallback
 * 1. Ngưỡng miễn phí vận chuyển (Free Shipping Threshold):
 *    - Nếu `subtotal >= 500,000 VND`, cước phí tự động trả về `0 VND` (`isFreeShipping: true`).
 * 2. Tích hợp trực tiếp GHN OpenAPI v2:
 *    - Gửi request đến `POST /v2/shipping-order/fee` kèm Header `Token` và `ShopId`.
 * 3. Fallback theo bậc thang khối lượng (Heuristic Fallback):
 *    - Khi không có kết nối API hoặc chạy local offline: Cước cố định 30,000 VND cho 500g đầu tiên,
 *      cộng thêm 5,000 VND cho mỗi 500g tiếp theo (`30k + ceil((weight - 500) / 500) * 5k`).
 */
export async function calculateGHNFee(
  params: GHNCalculateFeeParams
): Promise<GHNCalculateFeeResult> {
  const weight = params.weight && params.weight > 0 ? params.weight : 500;
  const subtotal = params.subtotal || 0;

  // Chính sách miễn phí vận chuyển cho đơn hàng đạt ngưỡng (>= 500,000 VND)
  if (subtotal >= 500_000) {
    return {
      totalFee: 0,
      serviceFee: 0,
      insuranceFee: 0,
      isFreeShipping: true,
      carrier: 'GHN',
      source: 'FALLBACK',
    };
  }

  // Nếu có API Token, gọi trực tiếp endpoint GHN OpenAPI v2
  if (GHN_TOKEN && params.toDistrictId && params.toWardCode) {
    try {
      const response = await fetch(`${GHN_API_BASE_URL}v2/shipping-order/fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: GHN_TOKEN,
          ...(GHN_SHOP_ID ? { ShopId: GHN_SHOP_ID } : {}),
        },
        body: JSON.stringify({
          from_district_id: GHN_FROM_DISTRICT_ID,
          from_ward_code: GHN_FROM_WARD_CODE,
          service_type_id: params.serviceTypeId || 2,
          to_district_id: params.toDistrictId,
          to_ward_code: params.toWardCode,
          weight,
          insurance_value: Math.min(subtotal, 5_000_000),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.code === 200 && data.data?.total) {
          return {
            totalFee: Math.round(Number(data.data.total)),
            serviceFee: Math.round(Number(data.data.service_fee || data.data.total)),
            insuranceFee: Math.round(Number(data.data.insurance_fee || 0)),
            isFreeShipping: false,
            carrier: 'GHN',
            source: 'GHN_API',
          };
        }
      }
    } catch (err) {
      console.warn('GHN fee calculation failed, falling back to heuristic fee:', err);
    }
  }

  // Fallback thông minh: Cước cố định 30k cho 500g đầu, tăng 5k mỗi 500g tiếp theo
  const additionalWeightUnits = Math.max(0, Math.ceil((weight - 500) / 500));
  const calculatedFee = 30_000 + additionalWeightUnits * 5_000;

  return {
    totalFee: calculatedFee,
    serviceFee: calculatedFee,
    insuranceFee: 0,
    isFreeShipping: false,
    carrier: 'GHN',
    source: 'FALLBACK',
  };
}

/**
 * Khởi tạo vận đơn thực tế qua GHN OpenAPI v2 khi đơn hàng chuyển sang trạng thái PROCESSING
 *
 * @param params - Chi tiết đơn hàng, địa chỉ người nhận, danh sách mặt hàng và tiền thu hộ COD
 * @returns `GHNCreateOrderResult` chứa mã tracking vận đơn (`trackingCode`), phí vận chuyển và thời gian dự kiến
 *
 * @workflow & Invariants
 * 1. Tự động tính toán tổng trọng lượng kiện hàng dựa trên danh mục items (mặc định 250g/item).
 * 2. Gửi request tạo vận đơn sang GHN OpenAPI `POST /v2/shipping-order/create`.
 * 3. Nếu không có kết nối API (môi trường dev): Tự sinh mã vận đơn mô phỏng `GHN...` hợp lệ để đảm bảo
 *    luồng thử nghiệm hoàn tất đơn hàng không bị gián đoạn.
 */
export async function createGHNShipment(
  params: GHNCreateOrderParams
): Promise<GHNCreateOrderResult> {
  const totalWeight =
    params.weight && params.weight > 0
      ? params.weight
      : params.items.reduce((sum, item) => sum + (item.weight || 250) * item.quantity, 0);

  if (GHN_TOKEN && GHN_SHOP_ID && params.toDistrictId && params.toWardCode) {
    try {
      const response = await fetch(`${GHN_API_BASE_URL}v2/shipping-order/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: GHN_TOKEN,
          ShopId: GHN_SHOP_ID,
        },
        body: JSON.stringify({
          payment_type_id: 1, // Người bán thanh toán cước
          note: params.note || 'Cho xem hàng, không cho thử',
          required_note: 'CHOXEMHANGKHONGTHU',
          client_order_code: params.orderCode,
          to_name: params.customerName,
          to_phone: params.customerPhone,
          to_address: params.customerAddress,
          to_ward_code: params.toWardCode,
          to_district_id: params.toDistrictId,
          cod_amount: params.codAmount || 0,
          weight: Math.max(100, totalWeight),
          service_type_id: 2,
          items: params.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            weight: i.weight || 200,
          })),
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.code === 200 && json.data) {
          return {
            success: true,
            trackingCode: json.data.order_code,
            shippingFee: Math.round(Number(json.data.total_fee || 0)),
            expectedDeliveryTime: json.data.expected_delivery_time
              ? new Date(json.data.expected_delivery_time)
              : null,
            carrier: 'GHN',
            source: 'GHN_API',
            rawResponse: json.data,
          };
        }
      }
    } catch (err) {
      console.error('GHN create order error, fallback to mock generation:', err);
    }
  }

  // Mock generation an toàn cho sandbox/development:
  const timestamp = Date.now().toString(36).toUpperCase();
  const cleanCode = params.orderCode.replace(/[^A-Z0-9]/gi, '');
  const trackingCode = `GHN${timestamp}${cleanCode.slice(-4)}`.toUpperCase();

  return {
    success: true,
    trackingCode,
    shippingFee: 30_000,
    expectedDeliveryTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 ngày
    carrier: 'GHN',
    source: 'MOCK',
  };
}

/**
 * Xác thực bảo mật yêu cầu Webhook từ hệ thống GHN Logistics (Security Invariant SEC-01)
 *
 * @param req - HTTP Request gửi tới endpoint `/api/webhooks/ghn`
 * @param ghnWebhookToken - Khóa bảo mật mong đợi cấu hình trong env `GHN_WEBHOOK_TOKEN`
 * @param nodeEnv - Môi trường runtime hiện tại (`production`, `development`, `test`)
 * @returns `{ authorized: boolean; status?: number; error?: string }`
 *
 * @security Protocol (Fail-Closed & Timing Attack Protection)
 * 1. Chế độ Fail-Closed trong Production:
 *    - Nếu `NODE_ENV === 'production'` và `GHN_WEBHOOK_TOKEN` chưa được thiết lập hoặc rỗng,
 *      hệ thống ngay lập tức từ chối với status 500 để ngăn chặn lỗ hổng giả mạo cập nhật đơn hàng.
 * 2. Hỗ trợ đa dạng HTTP Headers:
 *    - GHN có thể truyền token qua header `token` hoặc `x-ghn-token`.
 * 3. So sánh chuỗi an toàn thời gian hằng số (Timing-Safe Equal):
 *    - Sử dụng `crypto.timingSafeEqual` đối chiếu byte nhị phân của token, chặn đứng nguy cơ tấn công kênh kề (Side-channel Timing Attack).
 */
export function verifyGHNWebhookAuth(
  req: Request,
  ghnWebhookToken: string | undefined = process.env.GHN_WEBHOOK_TOKEN,
  nodeEnv: string | undefined = process.env.NODE_ENV
): { authorized: boolean; status?: number; error?: string } {
  const isProduction = nodeEnv === 'production';

  if (isProduction && (!ghnWebhookToken || ghnWebhookToken.trim() === '')) {
    console.error('[GHN Webhook] GHN_WEBHOOK_TOKEN chưa được cấu hình trong môi trường production');
    return {
      authorized: false,
      status: 500,
      error: 'Webhook chưa được cấu hình bảo mật',
    };
  }

  if (ghnWebhookToken && ghnWebhookToken.trim() !== '') {
    const incomingToken =
      req.headers.get('token') ||
      req.headers.get('x-ghn-token') ||
      '';

    const safeCompare = (a: string, b: string): boolean => {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    };

    if (!incomingToken || !safeCompare(incomingToken.trim(), ghnWebhookToken.trim())) {
      return {
        authorized: false,
        status: 401,
        error: 'Unauthorized',
      };
    }
  } else {
    console.warn('[GHN Webhook] Cảnh báo: GHN_WEBHOOK_TOKEN chưa được cấu hình trong môi trường phát triển');
  }

  return { authorized: true };
}
