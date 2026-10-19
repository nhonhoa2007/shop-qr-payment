import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorAccess } from '@server/modules/admin/guards';
import { quotePartialRefund } from '@server/modules/wallet/refund-case.service';

describe('After-Sales Authorization Matrix', () => {
  describe('Operator Access for Warranties & Returns', () => {
    it('grants full access to ADMIN users (Bypass check)', () => {
      const adminUser = { role: 'ADMIN', permissions: [] };
      assert.equal(resolveOperatorAccess(adminUser, 'warranties'), true);
    });

    it('grants access to STAFF users with explicit warranties permission', () => {
      const staffWithWarranties = {
        role: 'STAFF',
        permissions: ['orders', 'warranties'],
      };
      assert.equal(resolveOperatorAccess(staffWithWarranties, 'warranties'), true);
    });

    it('denies access to STAFF users lacking warranties permission', () => {
      const staffOther = {
        role: 'STAFF',
        permissions: ['orders', 'chat'],
      };
      assert.equal(resolveOperatorAccess(staffOther, 'warranties'), false);
    });

    it('denies operator access to CUSTOMER users', () => {
      const customer = { role: 'CUSTOMER', permissions: [] };
      assert.equal(resolveOperatorAccess(customer, 'warranties'), false);
    });

    it('denies access to unauthenticated / null users', () => {
      assert.equal(resolveOperatorAccess(null, 'warranties'), false);
      assert.equal(resolveOperatorAccess(undefined, 'warranties'), false);
    });
  });

  describe('Financial Override Authorization Gate', () => {
    function createMockTx() {
      return {
        order: {
          findUnique: async () => ({
            id: 'ord_1',
            subtotal: BigInt(1_000_000),
            discountAmount: BigInt(0),
            shippingFee: BigInt(30_000),
            totalAmount: BigInt(1_030_000),
          }),
        },
        orderItem: {
          findMany: async () => [
            {
              id: 'item_1',
              orderId: 'ord_1',
              price: BigInt(1_000_000),
              quantity: 1,
            },
          ],
        },
      };
    }

    it('allows ADMIN to approve shipping fee refund with store fault reason', async () => {
      const tx = createMockTx();
      const quote = await quotePartialRefund(tx as any, {
        orderId: 'ord_1',
        items: [{ orderItemId: 'item_1', quantity: 1 }],
        includeShipping: true,
        actorRole: 'ADMIN',
        storeFaultReason: 'Giao nhầm sản phẩm',
      });

      assert.equal(quote.shippingRefund, BigInt(30_000));
      assert.equal(quote.totalRefundAmount, BigInt(1_030_000));
    });

    it('strictly denies STAFF (even with warranties permission) from approving shipping fee refund', async () => {
      const tx = createMockTx();
      await assert.rejects(
        () =>
          quotePartialRefund(tx as any, {
            orderId: 'ord_1',
            items: [{ orderItemId: 'item_1', quantity: 1 }],
            includeShipping: true,
            actorRole: 'STAFF', // Staff cannot override shipping
            storeFaultReason: 'Giao nhầm sản phẩm',
          }),
        /only ADMIN can approve shipping fee refund/i
      );
    });
  });
});
