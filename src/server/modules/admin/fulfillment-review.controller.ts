import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@server/modules/auth/auth-options';
import { prisma } from '@server/database/prisma';
import { refundOrderToWallet } from '@server/modules/wallet/wallet.service';
import type { CarrierName } from '@/types';

export type ManualFulfillmentOutcome = 'CANCEL_AND_REFUND' | 'EXTERNAL_SHIPMENT';

export interface ResolveFulfillmentReviewInput {
  orderId: string;
  outcome: ManualFulfillmentOutcome;
  reason: string;
  carrier?: string;
  trackingReference?: string;
  customerConsentReference?: string;
}

export function validateManualFulfillmentInput(raw: unknown): {
  valid: boolean;
  data?: ResolveFulfillmentReviewInput;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Dữ liệu không hợp lệ' };
  }

  const body = raw as Record<string, unknown>;
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const outcome = body.outcome as ManualFulfillmentOutcome;

  if (!orderId) {
    return { valid: false, error: 'Thiếu mã đơn hàng (orderId)' };
  }

  if (!reason) {
    return { valid: false, error: 'Lý do xử lý không được để trống' };
  }

  if (outcome !== 'CANCEL_AND_REFUND' && outcome !== 'EXTERNAL_SHIPMENT') {
    return {
      valid: false,
      error: 'Kết quả xử lý phải là CANCEL_AND_REFUND hoặc EXTERNAL_SHIPMENT',
    };
  }

  if (outcome === 'EXTERNAL_SHIPMENT') {
    const carrier = typeof body.carrier === 'string' ? body.carrier.trim() : '';
    const trackingReference =
      typeof body.trackingReference === 'string' ? body.trackingReference.trim() : '';
    const customerConsentReference =
      typeof body.customerConsentReference === 'string'
        ? body.customerConsentReference.trim()
        : '';

    if (!carrier || !trackingReference || !customerConsentReference) {
      return {
        valid: false,
        error:
          'Vận chuyển ngoài yêu cầu đầy đủ đơn vị vận chuyển, mã vận đơn và tham chiếu xác nhận của khách hàng',
      };
    }

    return {
      valid: true,
      data: {
        orderId,
        outcome,
        reason,
        carrier,
        trackingReference,
        customerConsentReference,
      },
    };
  }

  return {
    valid: true,
    data: {
      orderId,
      outcome,
      reason,
    },
  };
}

export async function resolveManualFulfillment(
  input: ResolveFulfillmentReviewInput,
  reviewerId: string
) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      include: { shipment: true, items: true },
    });

    if (order.fulfillmentState !== 'REVIEW') {
      return {
        success: false,
        error: 'Đơn hàng không ở trạng thái chờ kiểm tra fulfillment (REVIEW)',
      };
    }

    if (input.outcome === 'CANCEL_AND_REFUND') {
      const refundResult = await refundOrderToWallet(
        tx,
        order.id,
        `Hủy và hoàn tiền do kiểm tra fulfillment: ${input.reason}`
      );
      if (!refundResult.success) {
        throw new Error(refundResult.error || 'Hoàn tiền thất bại');
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          fulfillmentState: 'NONE',
          manualFulfillmentOutcome: 'CANCEL_AND_REFUND',
          note: [
            order.note,
            `[Fulfillment Review CANCEL_AND_REFUND ${new Date().toISOString()} admin:${reviewerId}] ${input.reason}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });

      return {
        success: true,
        orderId: order.id,
        outcome: 'CANCEL_AND_REFUND',
        refundResult,
      };
    }

    // EXTERNAL_SHIPMENT
    const carrier = input.carrier || 'VIETTEL_POST';
    const trackingCode = input.trackingReference!;

    const shipment = await tx.shipment.create({
      data: {
        orderId: order.id,
        carrier: carrier as CarrierName,
        trackingCode,
        shippingFee: BigInt(order.shippingFee),
        codAmount: order.paymentStatus === 'PAID' ? 0n : BigInt(order.totalAmount),
        status: 'READY_TO_PICK',
        shippingLogs: [
          {
            status: 'READY_TO_PICK',
            description: `Vận chuyển ngoài đối tác: ${carrier} (${trackingCode}) - ${input.reason}`,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        fulfillmentState: 'CREATED',
        status: 'PROCESSING',
        manualFulfillmentOutcome: 'EXTERNAL_SHIPMENT',
        customerConsentRef: input.customerConsentReference,
        note: [
          order.note,
          `[Fulfillment Review EXTERNAL_SHIPMENT ${new Date().toISOString()} admin:${reviewerId}] Carrier: ${carrier}, Ref: ${trackingCode}, Consent: ${input.customerConsentReference}, Reason: ${input.reason}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });

    return {
      success: true,
      orderId: order.id,
      outcome: 'EXTERNAL_SHIPMENT',
      shipment,
    };
  });
}

interface LegacyReviewBody {
  orderId?: unknown;
  outcome?: unknown;
  trackingCode?: unknown;
  shippingFee?: unknown;
  note?: unknown;
  carrier?: unknown;
  trackingReference?: unknown;
  customerConsentReference?: unknown;
  reason?: unknown;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as LegacyReviewBody;

    // Check if new outcome format
    if (
      body.outcome === 'CANCEL_AND_REFUND' ||
      body.outcome === 'EXTERNAL_SHIPMENT'
    ) {
      const validation = validateManualFulfillmentInput({
        orderId: body.orderId,
        outcome: body.outcome,
        reason: body.reason || body.note,
        carrier: body.carrier,
        trackingReference: body.trackingReference || body.trackingCode,
        customerConsentReference: body.customerConsentReference,
      });

      if (!validation.valid || !validation.data) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const result = await resolveManualFulfillment(validation.data, session.user.id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: result });
    }

    // Legacy handler
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const outcome = body.outcome;
    const trackingCode = typeof body.trackingCode === 'string' ? body.trackingCode.trim() : '';

    if (!orderId || !note || (outcome !== 'NOT_CREATED' && outcome !== 'CREATED')) {
      return NextResponse.json({ error: 'Thiếu đơn, kết quả kiểm tra hoặc ghi chú' }, { status: 400 });
    }

    if (
      outcome === 'CREATED' &&
      (!/^[A-Za-z0-9-]{5,80}$/.test(trackingCode) ||
        !Number.isSafeInteger(body.shippingFee) ||
        Number(body.shippingFee) < 0)
    ) {
      return NextResponse.json({ error: 'Mã vận đơn hoặc phí GHN không hợp lệ' }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { shipment: true },
      });
      if (
        current.fulfillmentState !== 'REVIEW' ||
        current.status !== 'CONFIRMED' ||
        current.paymentStatus !== 'PAID'
      ) {
        throw new Error('Đơn không còn chờ kiểm tra GHN');
      }
      if (
        current.shipment &&
        (outcome === 'NOT_CREATED' || current.shipment.trackingCode !== trackingCode)
      ) {
        throw new Error('Đơn đã có vận đơn; dùng đúng mã vận đơn đã lưu để xác nhận');
      }
      const reviewLog = `[GHN ${new Date().toISOString()} admin:${session.user.id} ${outcome}] ${note}`;
      const claimed = await tx.order.updateMany({
        where: { id: orderId, fulfillmentState: 'REVIEW', status: 'CONFIRMED', paymentStatus: 'PAID' },
        data: {
          fulfillmentState: outcome === 'CREATED' ? 'CREATED' : 'NONE',
          status: outcome === 'CREATED' ? 'PROCESSING' : 'CONFIRMED',
          note: [current.note, reviewLog].filter(Boolean).join('\n'),
        },
      });
      if (claimed.count !== 1) throw new Error('Đơn đã được xử lý đồng thời');
      if (outcome === 'CREATED' && !current.shipment) {
        await tx.shipment.create({
          data: {
            orderId,
            carrier: 'GHN',
            trackingCode,
            shippingFee: BigInt(Number(body.shippingFee)),
            codAmount: 0n,
            status: 'READY_TO_PICK',
            shippingLogs: [
              {
                status: 'READY_TO_PICK',
                description: reviewLog,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể đối soát GHN' },
      { status: 400 }
    );
  }
}
