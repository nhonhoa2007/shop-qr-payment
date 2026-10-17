import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateManualFulfillmentInput } from '@server/modules/admin/fulfillment-review.controller';
import { isStaffPermission } from '@shared/constants/permissions';

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
});
