import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManualFulfillmentInput,
  resolveManualFulfillment,
  type ResolveFulfillmentReviewInput,
} from '@server/modules/admin/fulfillment-review.controller';
import { isStaffPermission } from '@shared/constants/permissions';
import type { prisma } from '@server/database/prisma';

describe('Staff Permission Allowlist Expansion (Task 8)', () => {
  it('should include new domain permissions in STAFF_PERMISSIONS', () => {
    assert.ok(isStaffPermission('inventory'));
    assert.ok(isStaffPermission('warranties'));
    assert.ok(isStaffPermission('knowledge'));
    assert.ok(isStaffPermission('scoring'));
    assert.ok(isStaffPermission('assistant'));
    assert.equal(isStaffPermission('invalid_perm'), false);
  });
});

describe('High-Value Manual Fulfillment Review Logic (Task 8)', () => {
  it('should reject resolution input if required fields are missing', () => {
    const missingReason = validateManualFulfillmentInput({
      orderId: 'ord_1',
      outcome: 'CANCEL_AND_REFUND',
      reason: '',
    });
    assert.equal(missingReason.valid, false);
    assert.match((missingReason as { error: string }).error, /lý do/i);

    const missingExternalData = validateManualFulfillmentInput({
      orderId: 'ord_1',
      outcome: 'EXTERNAL_SHIPMENT',
      reason: 'Khách đồng ý vận chuyển riêng',
      carrier: '', // missing
      trackingReference: '',
      customerConsentReference: '',
    });
    assert.equal(missingExternalData.valid, false);
    assert.match((missingExternalData as { error: string }).error, /đơn vị vận chuyển|mã vận đơn|xác nhận/i);
  });

  it('should validate valid CANCEL_AND_REFUND and EXTERNAL_SHIPMENT payloads', () => {
    const cancelInput = validateManualFulfillmentInput({
      orderId: 'ord_1',
      outcome: 'CANCEL_AND_REFUND',
      reason: 'Vượt hạn mức bảo hiểm hàng giá trị cao',
    });
    assert.equal(cancelInput.valid, true);

    const externalInput = validateManualFulfillmentInput({
      orderId: 'ord_1',
      outcome: 'EXTERNAL_SHIPMENT',
      reason: 'Vận chuyển riêng xe tải công ty',
      carrier: 'VIETTEL_POST',
      trackingReference: 'VT123456789',
      customerConsentReference: 'CALL-LOG-20261017-001',
    });
    assert.equal(externalInput.valid, true);
  });

  it('should reject resolution if order CAS claim fails (order not in REVIEW or concurrent race)', async () => {
    const mockDb = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          order: {
            updateMany: async () => ({ count: 0 }), // CAS claim failed
          },
        };
        return cb(mockTx);
      },
    } as unknown as typeof prisma;

    const input: ResolveFulfillmentReviewInput = {
      orderId: 'ord_not_in_review',
      outcome: 'CANCEL_AND_REFUND',
      reason: 'Test cancellation',
    };

    const res = await resolveManualFulfillment(input, 'admin_1', mockDb);
    assert.equal(res.success, false);
    assert.match(res.error || '', /không ở trạng thái chờ kiểm tra fulfillment \(REVIEW\) hoặc đang được xử lý/i);
  });

  it('should successfully resolve with EXTERNAL_SHIPMENT and update order to CREATED', async () => {
    let createdShipmentData: unknown = null;
    let updatedOrderData: unknown = null;

    const mockOrder = {
      id: 'ord_ext_1',
      orderCode: 'DH999999',
      userId: 'user_123',
      totalAmount: 15_000_000n,
      shippingFee: 50_000n,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      fulfillmentState: 'REVIEW',
      note: 'Giao giờ hành chính',
      shipment: null,
      items: [],
    };

    const mockDb = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          order: {
            updateMany: async () => ({ count: 1 }), // CAS claim success
            findUniqueOrThrow: async () => mockOrder,
            update: async (args: { where: { id: string }; data: unknown }) => {
              updatedOrderData = args.data;
              return { ...mockOrder, ...(args.data as object) };
            },
          },
          shipment: {
            create: async (args: { data: unknown }) => {
              createdShipmentData = args.data;
              return { id: 'ship_1', ...(args.data as object) };
            },
          },
        };
        return cb(mockTx);
      },
    } as unknown as typeof prisma;

    const input: ResolveFulfillmentReviewInput = {
      orderId: 'ord_ext_1',
      outcome: 'EXTERNAL_SHIPMENT',
      reason: 'Khách hàng yêu cầu Viettel Post hỏa tốc',
      carrier: 'VIETTEL_POST',
      trackingReference: 'VP987654321',
      customerConsentReference: 'RECORD-001',
    };

    const res = await resolveManualFulfillment(input, 'admin_1', mockDb);
    assert.equal(res.success, true);
    assert.equal(res.outcome, 'EXTERNAL_SHIPMENT');
    assert.ok(res.shipment);

    // Assert created shipment data
    const ship = createdShipmentData as Record<string, unknown>;
    assert.equal(ship.carrier, 'VIETTEL_POST');
    assert.equal(ship.trackingCode, 'VP987654321');
    assert.equal(ship.orderId, 'ord_ext_1');
    assert.equal(ship.codAmount, 0n);

    // Assert updated order data
    const orderData = updatedOrderData as Record<string, unknown>;
    assert.equal(orderData.fulfillmentState, 'CREATED');
    assert.equal(orderData.status, 'PROCESSING');
    assert.equal(orderData.manualFulfillmentOutcome, 'EXTERNAL_SHIPMENT');
    assert.equal(orderData.customerConsentRef, 'RECORD-001');
    assert.match(String(orderData.note), /Fulfillment Review EXTERNAL_SHIPMENT/);
  });

  it('should reject EXTERNAL_SHIPMENT if shipment already exists on order', async () => {
    const mockOrderWithShipment = {
      id: 'ord_ext_dup',
      orderCode: 'DH888888',
      totalAmount: 10_000_000n,
      shippingFee: 30_000n,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      fulfillmentState: 'REVIEW',
      shipment: { id: 'ship_existing', trackingCode: 'GHN123' },
      items: [],
    };

    const mockDb = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          order: {
            updateMany: async () => ({ count: 1 }),
            findUniqueOrThrow: async () => mockOrderWithShipment,
          },
        };
        return cb(mockTx);
      },
    } as unknown as typeof prisma;

    const input: ResolveFulfillmentReviewInput = {
      orderId: 'ord_ext_dup',
      outcome: 'EXTERNAL_SHIPMENT',
      reason: 'Re-shipment attempt',
      carrier: 'VIETTEL_POST',
      trackingReference: 'VP111222333',
      customerConsentReference: 'CONSENT-999',
    };

    const res = await resolveManualFulfillment(input, 'admin_1', mockDb);
    assert.equal(res.success, false);
    assert.match(res.error || '', /đã có thông tin vận đơn/i);
  });

  it('should successfully resolve with CANCEL_AND_REFUND and call refundOrderToWallet', async () => {
    let updatedOrderData: unknown = null;

    const mockOrder = {
      id: 'ord_cancel_1',
      orderCode: 'DH777777',
      userId: null, // Guest
      totalAmount: 8_000_000n,
      shippingFee: 30_000n,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      fulfillmentState: 'REVIEW',
      note: 'Đơn chờ duyệt',
      shipment: null,
      items: [],
    };

    const mockDb = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          order: {
            updateMany: async () => ({ count: 1 }),
            findUniqueOrThrow: async () => mockOrder,
            findUnique: async () => mockOrder,
            update: async (args: { where: { id: string }; data: unknown }) => {
              updatedOrderData = args.data;
              return { ...mockOrder, ...(args.data as object) };
            },
          },
          refundCase: {
            upsert: async () => ({ id: 'ref_case_1' }),
          },
        };
        return cb(mockTx);
      },
    } as unknown as typeof prisma;

    const input: ResolveFulfillmentReviewInput = {
      orderId: 'ord_cancel_1',
      outcome: 'CANCEL_AND_REFUND',
      reason: 'Hàng giá trị cao không có đối tác vận chuyển an toàn',
    };

    const res = await resolveManualFulfillment(input, 'admin_super', mockDb);
    assert.equal(res.success, true);
    assert.equal(res.outcome, 'CANCEL_AND_REFUND');
    assert.ok(res.refundResult);
    assert.equal(res.refundResult.success, true);

    const orderData = updatedOrderData as Record<string, unknown>;
    assert.equal(orderData.fulfillmentState, 'NONE');
    assert.equal(orderData.manualFulfillmentOutcome, 'CANCEL_AND_REFUND');
    assert.match(String(orderData.note), /Fulfillment Review CANCEL_AND_REFUND/);
  });
});

