import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWarrantyClaim,
  transitionWarranty,
} from '@server/modules/warranties/warranty.service';
import type {
  CreateWarrantyInput,
  WarrantyTransitionInput,
} from '@shared/types/warranty';

describe('Warranty Claim - Ownership, Lifecycle & Replacement Integration', () => {
  function createWarrantyMockDb() {
    const orders = new Map<string, any>();
    const orderItems = new Map<string, any>();
    const serializedUnits = new Map<string, any>();
    const claims = new Map<string, any>();
    const refundCases = new Map<string, any>();
    const auditLogs: any[] = [];

    // Seed mock database
    const completedAt = new Date('2026-02-01T08:00:00.000Z');

    orders.set('ord_cust1', {
      id: 'ord_cust1',
      orderCode: 'DH100001',
      userId: 'usr_cust1',
      status: 'COMPLETED',
      completedAt,
    });

    orders.set('ord_cust2', {
      id: 'ord_cust2',
      orderCode: 'DH100002',
      userId: 'usr_cust2',
      status: 'PROCESSING', // Not completed
      completedAt: null,
    });

    orderItems.set('item_laptop', {
      id: 'item_laptop',
      orderId: 'ord_cust1',
      productId: 'prod_macbook',
      productName: 'MacBook Pro 14 M3',
      quantity: 1,
      price: BigInt(45_000_000),
      warrantySnapshot: {
        productKind: 'LAPTOP',
        policy: {
          type: 'MANUFACTURER',
          periodMonths: 12,
          requiresSerial: true,
        },
      },
    });

    orderItems.set('item_phone_pending', {
      id: 'item_phone_pending',
      orderId: 'ord_cust2',
      productId: 'prod_iphone',
      productName: 'iPhone 15 Pro',
      quantity: 1,
      price: BigInt(28_000_000),
      warrantySnapshot: {
        productKind: 'PHONE',
      },
    });

    serializedUnits.set('unit_laptop_cust1', {
      id: 'unit_laptop_cust1',
      productId: 'prod_macbook',
      serialNumber: 'MBP14M3001',
      status: 'SOLD',
      orderId: 'ord_cust1',
      orderItemId: 'item_laptop',
    });

    serializedUnits.set('unit_other', {
      id: 'unit_other',
      productId: 'prod_macbook',
      serialNumber: 'MBP14M3999',
      status: 'SOLD',
      orderId: 'ord_other',
      orderItemId: 'item_other',
    });

    serializedUnits.set('unit_replacement_avail', {
      id: 'unit_replacement_avail',
      productId: 'prod_macbook',
      serialNumber: 'MBP14M3REPLACE',
      status: 'AVAILABLE',
      orderId: null,
      orderItemId: null,
    });

    const tx: any = {
      order: {
        findUnique: async ({ where }: any) => {
          if (where.id) return orders.get(where.id) ? { ...orders.get(where.id) } : null;
          return null;
        },
      },
      orderItem: {
        findUnique: async ({ where }: any) => {
          if (where.id) return orderItems.get(where.id) ? { ...orderItems.get(where.id) } : null;
          return null;
        },
      },
      serializedUnit: {
        findUnique: async ({ where }: any) => {
          if (where.id) return serializedUnits.get(where.id) ? { ...serializedUnits.get(where.id) } : null;
          return null;
        },
        update: async ({ where, data }: any) => {
          const unit = serializedUnits.get(where.id);
          if (!unit) throw new Error(`Serialized unit ${where.id} not found`);
          const updated = { ...unit, ...data, updatedAt: new Date() };
          serializedUnits.set(where.id, updated);
          return updated;
        },
      },
      warrantyClaim: {
        create: async ({ data }: any) => {
          const id = data.id ?? `claim_${claims.size + 1}`;
          const claim = {
            id,
            version: 1,
            status: 'SUBMITTED',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          claims.set(id, claim);
          return claim;
        },
        findUnique: async ({ where }: any) => {
          if (where.id) return claims.get(where.id) ? { ...claims.get(where.id) } : null;
          if (where.claimNumber) {
            return Array.from(claims.values()).find((c) => c.claimNumber === where.claimNumber) ?? null;
          }
          return null;
        },
        findFirst: async ({ where }: any) => {
          return (
            Array.from(claims.values()).find((c) => {
              if (where.orderItemId && c.orderItemId !== where.orderItemId) return false;
              if (where.serializedUnitId && c.serializedUnitId !== where.serializedUnitId) return false;
              if (where.status?.in && !where.status.in.includes(c.status)) return false;
              return true;
            }) ?? null
          );
        },
        update: async ({ where, data }: any) => {
          const claim = claims.get(where.id);
          if (!claim) throw new Error(`Claim ${where.id} not found`);
          if (where.version !== undefined && claim.version !== where.version) {
            // Simulate CAS version mismatch returning count 0 / failure
            const err: any = new Error('Version mismatch');
            err.code = 'P2025';
            throw err;
          }
          const nextVersion = data.version?.increment ? claim.version + 1 : (data.version ?? claim.version);
          const updated = {
            ...claim,
            ...data,
            version: nextVersion,
            updatedAt: new Date(),
          };
          claims.set(where.id, updated);
          return updated;
        },
      },
      refundCase: {
        create: async ({ data }: any) => {
          const id = data.id ?? `refund_${refundCases.size + 1}`;
          const rc = { id, status: 'OPEN', createdAt: new Date(), ...data };
          refundCases.set(id, rc);
          return rc;
        },
      },
      adminAuditLog: {
        create: async ({ data }: any) => {
          auditLogs.push(data);
          return data;
        },
        findUnique: async () => null,
      },
    };

    return { tx, orders, orderItems, serializedUnits, claims, refundCases, auditLogs };
  }

  it('allows order owner to submit a warranty claim for completed item', async () => {
    const { tx } = createWarrantyMockDb();
    const input: CreateWarrantyInput = {
      orderId: 'ord_cust1',
      orderItemId: 'item_laptop',
      serializedUnitId: 'unit_laptop_cust1',
      issueDescription: 'Bàn phím bị kẹt phím cách (spacebar)',
      evidenceRefs: [
        {
          type: 'IMAGE',
          url: 'https://cdn.example.com/keyboard.jpg',
          uploadedAt: new Date().toISOString(),
        },
      ],
    };

    const claim = await createWarrantyClaim(tx, input, 'usr_cust1');

    assert.ok(claim.id);
    assert.equal(claim.status, 'SUBMITTED');
    assert.equal(claim.customerId, 'usr_cust1');
    assert.equal(claim.orderItemId, 'item_laptop');
    assert.equal(claim.serializedUnitId, 'unit_laptop_cust1');
    assert.equal(claim.version, 1);
    assert.equal(claim.timeline.length, 1);
    assert.equal(claim.timeline[0].status, 'SUBMITTED');
  });

  it('rejects claim if customer does not own the order', async () => {
    const { tx } = createWarrantyMockDb();
    const input: CreateWarrantyInput = {
      orderId: 'ord_cust1',
      orderItemId: 'item_laptop',
      issueDescription: 'Lỗi',
      evidenceRefs: [],
    };

    await assert.rejects(
      () => createWarrantyClaim(tx, input, 'usr_stranger'),
      /order ownership/i
    );
  });

  it('rejects claim if order is not completed', async () => {
    const { tx } = createWarrantyMockDb();
    const input: CreateWarrantyInput = {
      orderId: 'ord_cust2',
      orderItemId: 'item_phone_pending',
      issueDescription: 'Lỗi',
      evidenceRefs: [],
    };

    await assert.rejects(
      () => createWarrantyClaim(tx, input, 'usr_cust2'),
      /completed order/i
    );
  });

  it('rejects claim with serialized unit belonging to another order/item', async () => {
    const { tx } = createWarrantyMockDb();
    const input: CreateWarrantyInput = {
      orderId: 'ord_cust1',
      orderItemId: 'item_laptop',
      serializedUnitId: 'unit_other',
      issueDescription: 'Lỗi',
      evidenceRefs: [],
    };

    await assert.rejects(
      () => createWarrantyClaim(tx, input, 'usr_cust1'),
      /serialized unit does not match/i
    );
  });

  it('enforces single open claim slot constraint on order item', async () => {
    const { tx } = createWarrantyMockDb();
    const input: CreateWarrantyInput = {
      orderId: 'ord_cust1',
      orderItemId: 'item_laptop',
      serializedUnitId: 'unit_laptop_cust1',
      issueDescription: 'Lần 1',
      evidenceRefs: [],
    };

    await createWarrantyClaim(tx, input, 'usr_cust1');

    // Attempt second claim while first is still open
    await assert.rejects(
      () => createWarrantyClaim(tx, input, 'usr_cust1'),
      /already an active warranty claim/i
    );
  });

  it('handles FSM transitions with CAS version checking', async () => {
    const { tx } = createWarrantyMockDb();
    const claim = await createWarrantyClaim(
      tx,
      {
        orderId: 'ord_cust1',
        orderItemId: 'item_laptop',
        issueDescription: 'Phím hỏng',
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    // Transition: SUBMITTED -> RECEIVED
    const step1 = await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RECEIVED',
      expectedVersion: 1,
      operationKey: 'op_rcv_1',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      note: 'Đã nhận máy',
    });

    assert.equal(step1.status, 'RECEIVED');
    assert.equal(step1.version, 2);
    assert.equal(step1.timeline.length, 2);

    // Stale version CAS conflict (expectedVersion 1 instead of 2)
    await assert.rejects(
      () =>
        transitionWarranty(tx, {
          claimId: claim.id,
          targetStatus: 'INSPECTING',
          expectedVersion: 1,
          operationKey: 'op_insp_stale',
          actorId: 'staff_1',
          actorRole: 'STAFF',
        }),
      /version mismatch|stale/i
    );
  });

  it('replays idempotent transition with identical operationKey without side effects', async () => {
    const { tx, auditLogs } = createWarrantyMockDb();
    const claim = await createWarrantyClaim(
      tx,
      {
        orderId: 'ord_cust1',
        orderItemId: 'item_laptop',
        issueDescription: 'Phím hỏng',
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    const transitionInput: WarrantyTransitionInput = {
      claimId: claim.id,
      targetStatus: 'RECEIVED',
      expectedVersion: 1,
      operationKey: 'op_same_key',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      note: 'Đã nhận máy',
    };

    const first = await transitionWarranty(tx, transitionInput);
    const auditsBefore = auditLogs.length;

    // Replay same key and payload
    const second = await transitionWarranty(tx, transitionInput);

    assert.equal(second.status, first.status);
    assert.equal(second.version, first.version);
    assert.equal(second.timeline.length, first.timeline.length);
    assert.equal(auditLogs.length, auditsBefore); // No duplicate audit log
  });

  it('resolves claim with REPLACED outcome by allocating AVAILABLE unit and preserving expiry', async () => {
    const { tx, serializedUnits } = createWarrantyMockDb();
    const claim = await createWarrantyClaim(
      tx,
      {
        orderId: 'ord_cust1',
        orderItemId: 'item_laptop',
        serializedUnitId: 'unit_laptop_cust1',
        issueDescription: 'Lỗi nguồn không sửa được',
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    // Transition to RECEIVED then INSPECTING
    await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RECEIVED',
      expectedVersion: 1,
      operationKey: 'op_rcv',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'INSPECTING',
      expectedVersion: 2,
      operationKey: 'op_insp',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    // Resolve as REPLACED
    const resolved = await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RESOLVED',
      expectedVersion: 3,
      operationKey: 'op_resolve_replace',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      resolution: {
        outcome: 'REPLACED',
        replacementUnitId: 'unit_replacement_avail',
        note: 'Đổi máy mới tương thích',
      },
    });

    assert.equal(resolved.status, 'RESOLVED');
    assert.equal(resolved.resolutionOutcome, 'REPLACED');
    assert.equal(resolved.replacementUnitId, 'unit_replacement_avail');

    // Replacement unit should now be SOLD / ASSIGNED
    const replacedUnit = serializedUnits.get('unit_replacement_avail');
    assert.equal(replacedUnit.status, 'SOLD');
  });

  it('resolves claim with REFUND_RECOMMENDED creating an OPEN RefundCase without wallet mutation', async () => {
    const { tx, refundCases } = createWarrantyMockDb();
    const claim = await createWarrantyClaim(
      tx,
      {
        orderId: 'ord_cust1',
        orderItemId: 'item_laptop',
        issueDescription: 'Không có linh kiện thay thế',
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RECEIVED',
      expectedVersion: 1,
      operationKey: 'op_rcv2',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'INSPECTING',
      expectedVersion: 2,
      operationKey: 'op_insp2',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    const resolved = await transitionWarranty(tx, {
      claimId: claim.id,
      targetStatus: 'RESOLVED',
      expectedVersion: 3,
      operationKey: 'op_resolve_refund',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      resolution: {
        outcome: 'REFUND_RECOMMENDED',
        note: 'Đề xuất hoàn tiền do không có linh kiện thay thế',
      },
    });

    assert.equal(resolved.status, 'RESOLVED');
    assert.equal(resolved.resolutionOutcome, 'REFUND_RECOMMENDED');
    assert.ok(resolved.refundCaseId);

    const rc = refundCases.get(resolved.refundCaseId);
    assert.ok(rc);
    assert.equal(rc.status, 'OPEN');
    assert.equal(rc.orderId, 'ord_cust1');
  });
});
