import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWarrantyClaim,
  transitionWarranty,
} from '@server/modules/warranties/warranty.service';
import {
  requestReturn,
  transitionReturn,
  applyReturnDisposition,
} from '@server/modules/returns/return.service';
import { executeRefundCase } from '@server/modules/wallet/refund-case.service';
import type {
  CreateWarrantyInput,
  WarrantyTransitionInput,
} from '@shared/types/warranty';
import type {
  RequestReturnInput,
  ReturnTransitionInput,
  ReturnDispositionInput,
} from '@shared/types/return';
import type { ExecuteRefundInput } from '@server/modules/returns/refund-allocation';

describe('After-Sales & Warranty End-to-End Lifecycle', () => {
  function createFullAfterSalesMockDb() {
    const orders = new Map<string, any>();
    const orderItems = new Map<string, any>();
    const products = new Map<string, any>();
    const serializedUnits = new Map<string, any>();
    const warrantyClaims = new Map<string, any>();
    const returnRequests = new Map<string, any>();
    const refundCases = new Map<string, any>();
    const userWallets = new Map<string, any>();
    const walletTransactions: any[] = [];
    const inventoryMovements: any[] = [];
    const auditLogs: any[] = [];
    const notifications: any[] = [];

    // Seed customer, order, items, inventory
    const completedAt = new Date('2026-03-01T10:00:00.000Z');

    orders.set('ord_e2e_1', {
      id: 'ord_e2e_1',
      orderCode: 'DH999001',
      userId: 'usr_buyer',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      subtotal: BigInt(52_000_000), // Laptop 50M + Headphone 2M
      discountAmount: BigInt(2_000_000),
      shippingFee: BigInt(0),
      totalAmount: BigInt(50_000_000),
      completedAt,
    });

    products.set('prod_laptop_pro', {
      id: 'prod_laptop_pro',
      name: 'MacBook Pro 16 M3 Max',
      stock: 5,
      onHandStock: 5,
      reservedStock: 0,
      quarantinedStock: 0,
      stockVersion: 1,
    });

    products.set('prod_headphone_anc', {
      id: 'prod_headphone_anc',
      name: 'Sony WH-1000XM5',
      stock: 10,
      onHandStock: 10,
      reservedStock: 0,
      quarantinedStock: 0,
      stockVersion: 1,
    });

    orderItems.set('item_laptop_pro', {
      id: 'item_laptop_pro',
      orderId: 'ord_e2e_1',
      productId: 'prod_laptop_pro',
      productName: 'MacBook Pro 16 M3 Max',
      quantity: 1,
      price: BigInt(50_000_000),
      returnedQuantity: 0,
      warrantySnapshot: {
        productKind: 'LAPTOP',
        policy: {
          type: 'MANUFACTURER',
          periodMonths: 12,
          requiresSerial: true,
        },
      },
    });

    orderItems.set('item_headphone_anc', {
      id: 'item_headphone_anc',
      orderId: 'ord_e2e_1',
      productId: 'prod_headphone_anc',
      productName: 'Sony WH-1000XM5',
      quantity: 1,
      price: BigInt(2_000_000),
      returnedQuantity: 0,
      warrantySnapshot: {
        productKind: 'ACCESSORY',
        policy: {
          type: 'SHOP',
          periodMonths: 6,
        },
      },
    });

    serializedUnits.set('unit_sold_mac', {
      id: 'unit_sold_mac',
      productId: 'prod_laptop_pro',
      serialNumber: 'MBP16M3MAX001',
      status: 'SOLD',
      orderId: 'ord_e2e_1',
      orderItemId: 'item_laptop_pro',
    });

    serializedUnits.set('unit_replacement_mac', {
      id: 'unit_replacement_mac',
      productId: 'prod_laptop_pro',
      serialNumber: 'MBP16M3MAXREPLACE',
      status: 'AVAILABLE',
      orderId: null,
      orderItemId: null,
    });

    userWallets.set('wal_buyer', {
      id: 'wal_buyer',
      userId: 'usr_buyer',
      balance: BigInt(0),
    });

    const tx: any = {
      order: {
        findUnique: async ({ where }: any) => orders.get(where.id) ?? null,
        update: async ({ where, data }: any) => {
          const ord = orders.get(where.id);
          const updated = { ...ord, ...data };
          orders.set(where.id, updated);
          return updated;
        },
      },
      orderItem: {
        findUnique: async ({ where }: any) => orderItems.get(where.id) ?? null,
        findMany: async ({ where }: any) =>
          Array.from(orderItems.values()).filter((i) => i.orderId === where.orderId),
        update: async ({ where, data }: any) => {
          const item = orderItems.get(where.id);
          const updated = {
            ...item,
            ...data,
            returnedQuantity: data.returnedQuantity?.increment
              ? item.returnedQuantity + data.returnedQuantity.increment
              : (data.returnedQuantity ?? item.returnedQuantity),
          };
          orderItems.set(where.id, updated);
          return updated;
        },
      },
      product: {
        findUnique: async ({ where }: any) => products.get(where.id) ?? null,
        update: async ({ where, data }: any) => {
          const prod = products.get(where.id);
          const resolveVal = (curr: number, val: any) =>
            val?.increment !== undefined ? curr + val.increment : (val ?? curr);
          const updated = {
            ...prod,
            ...data,
            onHandStock: resolveVal(prod.onHandStock, data.onHandStock),
            reservedStock: resolveVal(prod.reservedStock, data.reservedStock),
            quarantinedStock: resolveVal(prod.quarantinedStock, data.quarantinedStock),
            stock: resolveVal(prod.stock, data.stock),
            stockVersion: resolveVal(prod.stockVersion, data.stockVersion),
          };
          products.set(where.id, updated);
          return updated;
        },
        updateMany: async ({ where, data }: any) => {
          const prod = products.get(where.id);
          if (!prod) return { count: 0 };
          if (where.stockVersion !== undefined && prod.stockVersion !== where.stockVersion) {
            return { count: 0 };
          }
          const resolveVal = (curr: number, val: any) =>
            val?.increment !== undefined ? curr + val.increment : (val ?? curr);
          const updated = {
            ...prod,
            ...data,
            onHandStock: resolveVal(prod.onHandStock, data.onHandStock),
            reservedStock: resolveVal(prod.reservedStock, data.reservedStock),
            quarantinedStock: resolveVal(prod.quarantinedStock, data.quarantinedStock),
            stock: resolveVal(prod.stock, data.stock),
            stockVersion: resolveVal(prod.stockVersion, data.stockVersion),
          };
          products.set(where.id, updated);
          return { count: 1 };
        },
      },
      serializedUnit: {
        findUnique: async ({ where }: any) => serializedUnits.get(where.id) ?? null,
        update: async ({ where, data }: any) => {
          const unit = serializedUnits.get(where.id);
          const updated = { ...unit, ...data };
          serializedUnits.set(where.id, updated);
          return updated;
        },
      },
      warrantyClaim: {
        create: async ({ data }: any) => {
          const id = data.id ?? `claim_${warrantyClaims.size + 1}`;
          const c = { id, version: 1, status: 'SUBMITTED', ...data };
          warrantyClaims.set(id, c);
          return c;
        },
        findUnique: async ({ where }: any) => warrantyClaims.get(where.id) ?? null,
        findFirst: async ({ where }: any) => {
          return (
            Array.from(warrantyClaims.values()).find((c) => {
              if (where.orderItemId && c.orderItemId !== where.orderItemId) return false;
              if (where.status?.in && !where.status.in.includes(c.status)) return false;
              return true;
            }) ?? null
          );
        },
        update: async ({ where, data }: any) => {
          const c = warrantyClaims.get(where.id);
          if (!c) throw new Error('Claim not found');
          if (where.version !== undefined && c.version !== where.version) {
            const err: any = new Error('Version mismatch');
            err.code = 'P2025';
            throw err;
          }
          const updated = {
            ...c,
            ...data,
            version: data.version?.increment ? c.version + 1 : (data.version ?? c.version),
          };
          warrantyClaims.set(where.id, updated);
          return updated;
        },
      },
      returnRequest: {
        create: async ({ data }: any) => {
          const id = data.id ?? `ret_${returnRequests.size + 1}`;
          const r = { id, version: 1, status: 'REQUESTED', disposition: null, ...data };
          returnRequests.set(id, r);
          return r;
        },
        findUnique: async ({ where }: any) => returnRequests.get(where.id) ?? null,
        findMany: async ({ where }: any) =>
          Array.from(returnRequests.values()).filter((r) => {
            if (where.orderId && r.orderId !== where.orderId) return false;
            if (where.status?.in && !where.status.in.includes(r.status)) return false;
            return true;
          }),
        update: async ({ where, data }: any) => {
          const r = returnRequests.get(where.id);
          if (!r) throw new Error('Return not found');
          if (where.version !== undefined && r.version !== where.version) {
            const err: any = new Error('Version mismatch');
            err.code = 'P2025';
            throw err;
          }
          const updated = {
            ...r,
            ...data,
            version: data.version?.increment ? r.version + 1 : (data.version ?? r.version),
          };
          returnRequests.set(where.id, updated);
          return updated;
        },
      },
      refundCase: {
        create: async ({ data }: any) => {
          const id = data.id ?? `ref_${refundCases.size + 1}`;
          const rc = { id, ...data };
          refundCases.set(data.sourceKey ?? id, rc);
          return rc;
        },
        findUnique: async ({ where }: any) => {
          if (where.sourceKey) return refundCases.get(where.sourceKey) ?? null;
          if (where.id) return refundCases.get(where.id) ?? null;
          return null;
        },
        findMany: async ({ where }: any) =>
          Array.from(refundCases.values()).filter((rc) => {
            if (where.orderId && rc.orderId !== where.orderId) return false;
            if (where.status && rc.status !== where.status) return false;
            return true;
          }),
      },
      userWallet: {
        findUnique: async ({ where }: any) =>
          Array.from(userWallets.values()).find((w) => w.userId === where.userId) ?? null,
        update: async ({ where, data }: any) => {
          const w = userWallets.get(where.id);
          const nextBal = data.balance?.increment ? w.balance + data.balance.increment : data.balance;
          const updated = { ...w, balance: nextBal };
          userWallets.set(where.id, updated);
          return updated;
        },
      },
      walletTransaction: {
        create: async ({ data }: any) => {
          walletTransactions.push(data);
          return data;
        },
      },
      inventoryMovement: {
        findUnique: async ({ where }: any) =>
          inventoryMovements.find((m) => m.operationKey === where.operationKey) ?? null,
        create: async ({ data }: any) => {
          inventoryMovements.push(data);
          return data;
        },
      },
      adminAuditLog: {
        create: async ({ data }: any) => {
          auditLogs.push(data);
          return data;
        },
        findUnique: async () => null,
      },
      notification: {
        create: async ({ data }: any) => {
          notifications.push(data);
          return data;
        },
      },
    };

    return {
      tx,
      orders,
      orderItems,
      products,
      serializedUnits,
      warrantyClaims,
      returnRequests,
      refundCases,
      userWallets,
      walletTransactions,
      inventoryMovements,
      auditLogs,
      notifications,
    };
  }

  it('runs complete lifecycle: warranty replacement + partial return & restock + partial refund', async () => {
    const {
      tx,
      products,
      serializedUnits,
      userWallets,
      walletTransactions,
      inventoryMovements,
    } = createFullAfterSalesMockDb();

    // ==========================================
    // 1. Warranty Claim: Laptop replacement
    // ==========================================
    const claimInput: CreateWarrantyInput = {
      orderId: 'ord_e2e_1',
      orderItemId: 'item_laptop_pro',
      serializedUnitId: 'unit_sold_mac',
      issueDescription: 'Màn hình bị đốm sáng và sọc ngang',
      evidenceRefs: [
        {
          type: 'IMAGE',
          url: 'https://cdn.example.com/macbook_defect.jpg',
          uploadedAt: new Date().toISOString(),
        },
      ],
    };

    const claim = await createWarrantyClaim(tx, claimInput, 'usr_buyer');
    assert.equal(claim.status, 'SUBMITTED');

    // Progress through FSM: SUBMITTED -> RECEIVED -> INSPECTING -> RESOLVED (REPLACED)
    await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RECEIVED',
      expectedVersion: 1,
      operationKey: 'e2e:warr:rcv',
      actorId: 'staff_tech_1',
      actorRole: 'STAFF',
    });

    await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'INSPECTING',
      expectedVersion: 2,
      operationKey: 'e2e:warr:insp',
      actorId: 'staff_tech_1',
      actorRole: 'STAFF',
    });

    const claimResolved = await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RESOLVED',
      expectedVersion: 3,
      operationKey: 'e2e:warr:resolve',
      actorId: 'staff_tech_1',
      actorRole: 'STAFF',
      resolution: {
        outcome: 'REPLACED',
        replacementUnitId: 'unit_replacement_mac',
        note: 'Đổi máy mới nguyên seal',
      },
    });

    assert.equal(claimResolved.status, 'RESOLVED');
    assert.equal(claimResolved.resolutionOutcome, 'REPLACED');
    // Replacement unit marked SOLD
    assert.equal(serializedUnits.get('unit_replacement_mac').status, 'SOLD');

    // ==========================================
    // 2. Partial Return: Headphone return & quarantine
    // ==========================================
    const returnInput: RequestReturnInput = {
      orderId: 'ord_e2e_1',
      reason: 'Tai nghe không phù hợp với nhu cầu',
      items: [
        {
          orderItemId: 'item_headphone_anc',
          productId: 'prod_headphone_anc',
          quantity: 1,
          unitPriceSnapshot: '2000000',
          returnReason: 'Đổi ý',
        },
      ],
      evidenceRefs: [],
    };

    const ret = await requestReturn(tx, returnInput, 'usr_buyer');
    assert.equal(ret.status, 'REQUESTED');

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'APPROVED',
      expectedVersion: 1,
      operationKey: 'e2e:ret:appr',
      actorId: 'staff_cs_1',
      actorRole: 'STAFF',
    });

    // Receive into warehouse: enters QUARANTINE
    const headPhoneBefore = { ...products.get('prod_headphone_anc') };
    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'ITEM_RECEIVED',
      expectedVersion: 2,
      operationKey: 'e2e:ret:rcv',
      actorId: 'staff_wh_1',
      actorRole: 'STAFF',
    });

    const headPhoneQuarantine = products.get('prod_headphone_anc');
    // Quarantined increased, available unchanged
    assert.equal(headPhoneQuarantine.quarantinedStock, headPhoneBefore.quarantinedStock + 1);
    assert.equal(headPhoneQuarantine.stock, headPhoneBefore.stock);

    // Inspect
    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'INSPECTED',
      expectedVersion: 3,
      operationKey: 'e2e:ret:insp',
      actorId: 'staff_wh_1',
      actorRole: 'STAFF',
    });

    // Disposition: RESTOCKABLE -> transfers from quarantine to available stock
    await applyReturnDisposition(tx, {
      requestId: ret.id,
      disposition: 'RESTOCKABLE',
      operationKey: 'e2e:ret:disp_restock',
      actorId: 'staff_wh_1',
      actorRole: 'STAFF',
      notes: 'Hàng nguyên vẹn, đưa vào kho bán lại',
    });

    const headPhoneRestocked = products.get('prod_headphone_anc');
    assert.equal(headPhoneRestocked.quarantinedStock, headPhoneBefore.quarantinedStock); // back to 0
    assert.equal(headPhoneRestocked.stock, headPhoneBefore.stock + 1); // available stock +1!

    // ==========================================
    // 3. Partial Refund Execution: Exact proportional calculation
    // ==========================================
    // Total subtotal = 52M, discount = 2M.
    // Headphone gross = 2M (2/52 of 2M discount = 76,923 discount)
    // Headphone net refund = 2,000,000 - 76,923 = 1,923,077 VND
    const refundInput: ExecuteRefundInput = {
      sourceKey: `e2e:refund:return:${ret.id}`,
      orderId: 'ord_e2e_1',
      returnRequestId: ret.id,
      items: [{ orderItemId: 'item_headphone_anc', quantity: 1 }],
      reason: 'Hoàn tiền trả hàng tai nghe Sony',
      actorId: 'admin_1',
      actorRole: 'ADMIN',
    };

    const refundCase = await executeRefundCase(tx, refundInput);
    assert.equal(refundCase.status, 'COMPLETED');
    assert.equal(refundCase.amount, BigInt(1_923_077));

    // Customer wallet credited
    const wallet = userWallets.get('wal_buyer');
    assert.equal(wallet.balance, BigInt(1_923_077));

    // Wallet transaction recorded
    const txEntry = walletTransactions.find((w) => w.orderId === 'ord_e2e_1');
    assert.ok(txEntry);
    assert.equal(txEntry.amount, BigInt(1_923_077));
    assert.equal(txEntry.type, 'REFUND');

    // ==========================================
    // 4. Replay Safety
    // ==========================================
    // Replay same refund call: returns existing without extra wallet credits
    const replayRefund = await executeRefundCase(tx, refundInput);
    assert.equal(replayRefund.id, refundCase.id);
    assert.equal(wallet.balance, BigInt(1_923_077));
  });
});
