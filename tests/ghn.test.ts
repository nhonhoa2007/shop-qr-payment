import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapGHNStatusToShipmentStatus,
  calculateGHNFee,
  createGHNShipment,
  verifyGHNWebhookAuth,
} from '../src/lib/ghn.ts';

describe('GHN Logistics - Status Mapping', () => {
  it('should map ready_to_pick correctly', () => {
    const res = mapGHNStatusToShipmentStatus('ready_to_pick');
    assert.equal(res.shipmentStatus, 'READY_TO_PICK');
    assert.equal(res.orderStatus, 'PROCESSING');
  });

  it('should map picking and picking_goods correctly', () => {
    const res1 = mapGHNStatusToShipmentStatus('picking');
    assert.equal(res1.shipmentStatus, 'PICKING');
    assert.equal(res1.orderStatus, 'PROCESSING');

    const res2 = mapGHNStatusToShipmentStatus('picking_goods');
    assert.equal(res2.shipmentStatus, 'PICKING');
  });

  it('should map delivering and transporting to DELIVERING and SHIPPING', () => {
    const res1 = mapGHNStatusToShipmentStatus('delivering');
    assert.equal(res1.shipmentStatus, 'DELIVERING');
    assert.equal(res1.orderStatus, 'SHIPPING');

    const res2 = mapGHNStatusToShipmentStatus('transporting');
    assert.equal(res2.shipmentStatus, 'DELIVERING');
    assert.equal(res2.orderStatus, 'SHIPPING');
  });

  it('should map delivered to DELIVERED and COMPLETED', () => {
    const res = mapGHNStatusToShipmentStatus('delivered');
    assert.equal(res.shipmentStatus, 'DELIVERED');
    assert.equal(res.orderStatus, 'COMPLETED');
  });

  it('should map return and cancel correctly', () => {
    const resReturn = mapGHNStatusToShipmentStatus('return');
    assert.equal(resReturn.shipmentStatus, 'RETURNED');

    const resCancel = mapGHNStatusToShipmentStatus('cancel');
    assert.equal(resCancel.shipmentStatus, 'CANCELLED');
    assert.equal(resCancel.orderStatus, 'CANCELLED');
  });

  it('should fallback gracefully for unknown status', () => {
    const res = mapGHNStatusToShipmentStatus('some_unknown_status');
    assert.equal(res.shipmentStatus, 'READY_TO_PICK');
    assert.match(res.description, /some_unknown_status/);
  });
});

describe('GHN Logistics - Fee Calculation', () => {
  it('should grant free shipping when subtotal is at or above 500k', async () => {
    const res = await calculateGHNFee({
      toDistrictId: 1442,
      toWardCode: '20101',
      subtotal: 500_000,
      weight: 1200,
    });

    assert.equal(res.totalFee, 0);
    assert.equal(res.isFreeShipping, true);
    assert.equal(res.carrier, 'GHN');
  });

  it('should calculate base fee (30k) for packages <= 500g in fallback mode', async () => {
    const res = await calculateGHNFee({
      toDistrictId: 1442,
      toWardCode: '20101',
      subtotal: 200_000,
      weight: 400,
    });

    assert.equal(res.totalFee, 30_000);
    assert.equal(res.isFreeShipping, false);
    assert.equal(res.carrier, 'GHN');
  });

  it('should calculate step fee for packages > 500g in fallback mode', async () => {
    // 1200g: 500g base (30k) + 2 steps of 500g (10k) = 40,000
    const res = await calculateGHNFee({
      toDistrictId: 1442,
      toWardCode: '20101',
      subtotal: 200_000,
      weight: 1200,
    });

    assert.equal(res.totalFee, 40_000);
  });
});

describe('GHN Logistics - Shipment Creation', () => {
  it('should generate valid mock shipment with tracking code when in mock/fallback mode', async () => {
    const res = await createGHNShipment({
      orderId: 'order_123',
      orderCode: 'DH9999',
      customerName: 'Nguyễn Văn A',
      customerPhone: '0901234567',
      customerAddress: '123 Lê Lợi, P. Bến Nghé, Q.1',
      toDistrictId: 1442,
      toWardCode: '20101',
      items: [
        { name: 'Áo thun Cotton', quantity: 2, price: 150_000, weight: 250 },
      ],
      codAmount: 0,
    });

    assert.equal(res.success, true);
    assert.match(res.trackingCode, /^GHN/);
    assert.equal(res.carrier, 'GHN');
    assert.equal(res.shippingFee, 30_000);
    assert.ok(res.expectedDeliveryTime instanceof Date);
  });
});

describe('GHN Logistics - Webhook Authentication (SEC-01)', () => {
  const validSecret = 'ghn_secret_token_abcdef123';

  it('should fail-closed with 500 in production when GHN_WEBHOOK_TOKEN is not configured', () => {
    const req = new Request('http://localhost/api/webhooks/ghn', { method: 'POST' });
    const res = verifyGHNWebhookAuth(req, undefined, 'production');
    assert.equal(res.authorized, false);
    assert.equal(res.status, 500);
    assert.match(res.error!, /chưa được cấu hình bảo mật/);

    const resEmpty = verifyGHNWebhookAuth(req, '   ', 'production');
    assert.equal(resEmpty.authorized, false);
    assert.equal(resEmpty.status, 500);
  });

  it('should allow requests in development when GHN_WEBHOOK_TOKEN is not configured (with warning)', () => {
    const req = new Request('http://localhost/api/webhooks/ghn', { method: 'POST' });
    const res = verifyGHNWebhookAuth(req, undefined, 'development');
    assert.equal(res.authorized, true);
  });

  it('should reject requests with 401 when token is missing and token is configured', () => {
    const req = new Request('http://localhost/api/webhooks/ghn', { method: 'POST' });
    const res = verifyGHNWebhookAuth(req, validSecret, 'production');
    assert.equal(res.authorized, false);
    assert.equal(res.status, 401);
  });

  it('should reject requests with 401 when token is invalid or wrong length', () => {
    const reqWrong = new Request('http://localhost/api/webhooks/ghn', {
      method: 'POST',
      headers: { token: 'wrong_token' },
    });
    const resWrong = verifyGHNWebhookAuth(reqWrong, validSecret, 'production');
    assert.equal(resWrong.authorized, false);
    assert.equal(resWrong.status, 401);

    const reqDiffLen = new Request('http://localhost/api/webhooks/ghn', {
      method: 'POST',
      headers: { token: 'short' },
    });
    const resDiffLen = verifyGHNWebhookAuth(reqDiffLen, validSecret, 'production');
    assert.equal(resDiffLen.authorized, false);
    assert.equal(resDiffLen.status, 401);
  });

  it('should authorize requests with valid "token" header', () => {
    const req = new Request('http://localhost/api/webhooks/ghn', {
      method: 'POST',
      headers: { token: validSecret },
    });
    const res = verifyGHNWebhookAuth(req, validSecret, 'production');
    assert.equal(res.authorized, true);
  });

  it('should authorize requests with valid "x-ghn-token" header', () => {
    const req = new Request('http://localhost/api/webhooks/ghn', {
      method: 'POST',
      headers: { 'x-ghn-token': validSecret },
    });
    const res = verifyGHNWebhookAuth(req, validSecret, 'production');
    assert.equal(res.authorized, true);
  });
});
