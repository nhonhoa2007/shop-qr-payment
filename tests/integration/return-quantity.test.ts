import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  requestReturn,
  transitionReturn,
  applyReturnDisposition,
} from '@server/modules/returns/return.service';
import type {
  RequestReturnInput,
  ReturnTransitionInput,
  ReturnDispositionInput,
} from '@shared/types/return';

describe('Return Request - Quantity Limits, Quarantine FSM & Disposition Integration', () => {
  function createReturnMockDb() {
    const orders = new Map<string, any>();
    const orderItems = new Map<string, any>();
    const serializedUnits = new Map<string, any>();
    const returnRequests = new Map<string, any>();
    const products = new Map<string, any>();
    const movements: any[] = [];
    const auditLogs: any[] = [];

    // Seed mock data
    const completedAt = new Date('2026-03-01T10:00:00.000Z');

    orders.set('ord_1', {
      id: 'ord_1',
      orderCode: 'DH200001',
      userId: 'usr_cust1',
      status: 'COMPLETED',
      completedAt,
    });

    products.set('prod_headphone', {
      id: 'prod_headphone',
      stock: 10,
      onHandStock: 10,
      reservedStock: 0,
      quarantinedStock: 0,
      stockVersion: 1,
    });

    products.set('prod_phone', {
      id: 'prod_phone',
      stock: 5,
      onHandStock: 5,
      reservedStock: 0,
      quarantinedStock: 0,
      stockVersion: 1,
    });

    orderItems.set('item_headphone', {
      id: 'item_headphone',
      orderId: 'ord_1',
      productId: 'prod_headphone',
      variantId: null,
      productName: 'Sony WH-1000XM5',
      quantity: 3,
      returnedQuantity: 0,
      price: BigInt(8_000_000),
      unitPrice: BigInt(8_000_000),
    });

    orderItems.set('item_phone', {
      id: 'item_phone',
      orderId: 'ord_1',
      productId: 'prod_phone',
      variantId: null,
      productName: 'Samsung Galaxy S24',
      quantity: 2,
      returnedQuantity: 0,
      price: BigInt(22_000_000),
      unitPrice: BigInt(22_000_000),
    });

    serializedUnits.set('unit_s24_1', {
      id: 'unit_s24_1',
      productId: 'prod_phone',
      serialNumber: 'S24_001',
      status: 'SOLD',
      orderId: 'ord_1',
      orderItemId: 'item_phone',
    });

    serializedUnits.set('unit_s24_2', {
      id: 'unit_s24_2',
      productId: 'prod_phone',
      serialNumber: 'S24_002',
      status: 'SOLD',
      orderId: 'ord_1',
      orderItemId: 'item_phone',
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
        update: async ({ where, data }: any) => {
          const item = orderItems.get(where.id);
          if (!item) throw new Error(`OrderItem ${where.id} not found`);
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
        findUnique: async ({ where }: any) => {
          if (where.id) return products.get(where.id) ? { ...products.get(where.id) } : null;
          return null;
        },
        update: async ({ where, data }: any) => {
          const prod = products.get(where.id);
          if (!prod) throw new Error(`Product ${where.id} not found`);
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
        findUnique: async ({ where }: any) => {
          if (where.id) return serializedUnits.get(where.id) ? { ...serializedUnits.get(where.id) } : null;
          return null;
        },
        update: async ({ where, data }: any) => {
          const unit = serializedUnits.get(where.id);
          if (!unit) throw new Error(`Unit ${where.id} not found`);
          const updated = { ...unit, ...data };
          serializedUnits.set(where.id, updated);
          return updated;
        },
      },
      returnRequest: {
        create: async ({ data }: any) => {
          const id = data.id ?? `ret_${returnRequests.size + 1}`;
          const ret = {
            id,
            version: 1,
            status: 'REQUESTED',
            disposition: null,
            dispositionNotes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          returnRequests.set(id, ret);
          return ret;
        },
        findUnique: async ({ where }: any) => {
          if (where.id) return returnRequests.get(where.id) ? { ...returnRequests.get(where.id) } : null;
          return null;
        },
        findFirst: async ({ where }: any) => {
          return (
            Array.from(returnRequests.values()).find((r) => {
              if (where.orderId && r.orderId !== where.orderId) return false;
              if (where.status?.in && !where.status.in.includes(r.status)) return false;
              return true;
            }) ?? null
          );
        },
        findMany: async ({ where }: any) => {
          return Array.from(returnRequests.values()).filter((r) => {
            if (where.orderId && r.orderId !== where.orderId) return false;
            if (where.status?.in && !where.status.in.includes(r.status)) return false;
            return true;
          });
        },
        update: async ({ where, data }: any) => {
          const ret = returnRequests.get(where.id);
          if (!ret) throw new Error(`ReturnRequest ${where.id} not found`);
          if (where.version !== undefined && ret.version !== where.version) {
            const err: any = new Error('Version mismatch');
            err.code = 'P2025';
            throw err;
          }
          const nextVersion = data.version?.increment ? ret.version + 1 : (data.version ?? ret.version);
          const updated = {
            ...ret,
            ...data,
            version: nextVersion,
            updatedAt: new Date(),
          };
          returnRequests.set(where.id, updated);
          return updated;
        },
      },
      inventoryMovement: {
        findUnique: async ({ where }: any) => {
          return movements.find((m) => m.operationKey === where.operationKey) ?? null;
        },
        create: async ({ data }: any) => {
          movements.push(data);
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
    };

    return { tx, orders, orderItems, products, serializedUnits, returnRequests, movements, auditLogs };
  }

  it('allows requesting return within purchased quantity (2 of 3)', async () => {
    const { tx } = createReturnMockDb();
    const input: RequestReturnInput = {
      orderId: 'ord_1',
      reason: 'Đổi ý không muốn dùng',
      items: [
        {
          orderItemId: 'item_headphone',
          productId: 'prod_headphone',
          quantity: 2,
          unitPriceSnapshot: '8000000',
          returnReason: 'Không thích màu',
        },
      ],
      evidenceRefs: [],
    };

    const ret = await requestReturn(tx, input, 'usr_cust1');
    assert.ok(ret.id);
    assert.equal(ret.status, 'REQUESTED');
    assert.equal(ret.items.length, 1);
    assert.equal(ret.items[0].quantity, 2);
  });

  it('rejects concurrent/subsequent return exceeding purchased quantity (2 + 2 > 3)', async () => {
    const { tx } = createReturnMockDb();

    // First request: 2 headphones
    const first = await requestReturn(
      tx,
      {
        orderId: 'ord_1',
        reason: 'Lần 1',
        items: [
          {
            orderItemId: 'item_headphone',
            productId: 'prod_headphone',
            quantity: 2,
            unitPriceSnapshot: '8000000',
            returnReason: 'Không vừa',
          },
        ],
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    // Approve the first return
    await transitionReturn(tx, {
      requestId: first.id,
      targetStatus: 'APPROVED',
      expectedVersion: 1,
      operationKey: 'op_appr_1',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    // Attempt second return of 2 headphones (would be 2 + 2 = 4 > 3)
    await assert.rejects(
      () =>
        requestReturn(
          tx,
          {
            orderId: 'ord_1',
            reason: 'Lần 2',
            items: [
              {
                orderItemId: 'item_headphone',
                productId: 'prod_headphone',
                quantity: 2,
                unitPriceSnapshot: '8000000',
                returnReason: 'Lỗi',
              },
            ],
            evidenceRefs: [],
          },
          'usr_cust1'
        ),
      /exceeds purchased quantity|remaining returnable/i
    );
  });

  it('enforces one active return per serialized unit', async () => {
    const { tx } = createReturnMockDb();

    // Return unit 1
    await requestReturn(
      tx,
      {
        orderId: 'ord_1',
        reason: 'Lỗi máy',
        items: [
          {
            orderItemId: 'item_phone',
            productId: 'prod_phone',
            quantity: 1,
            serializedUnitIds: ['unit_s24_1'],
            unitPriceSnapshot: '22000000',
            returnReason: 'Màn hình chớp nháy',
          },
        ],
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    // Attempt return of same unit while active
    await assert.rejects(
      () =>
        requestReturn(
          tx,
          {
            orderId: 'ord_1',
            reason: 'Trùng lặp',
            items: [
              {
                orderItemId: 'item_phone',
                productId: 'prod_phone',
                quantity: 1,
                serializedUnitIds: ['unit_s24_1'],
                unitPriceSnapshot: '22000000',
                returnReason: 'Thử lại',
              },
            ],
            evidenceRefs: [],
          },
          'usr_cust1'
        ),
      /already in an active return request/i
    );
  });

  it('increments quarantineStock only on ITEM_RECEIVED without increasing available stock', async () => {
    const { tx, products, movements } = createReturnMockDb();

    const ret = await requestReturn(
      tx,
      {
        orderId: 'ord_1',
        reason: 'Hàng lỗi',
        items: [
          {
            orderItemId: 'item_headphone',
            productId: 'prod_headphone',
            quantity: 2,
            unitPriceSnapshot: '8000000',
            returnReason: 'Hỏng một bên tai',
          },
        ],
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'APPROVED',
      expectedVersion: 1,
      operationKey: 'op_appr_q',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    const beforeProd = { ...products.get('prod_headphone') };

    // Transition to ITEM_RECEIVED
    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'ITEM_RECEIVED',
      expectedVersion: 2,
      operationKey: 'op_rcv_q',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      note: 'Nhận 2 tai nghe vào kho cách ly',
    });

    const afterProd = products.get('prod_headphone');

    // Quarantine increased by 2
    assert.equal(afterProd.quarantinedStock, beforeProd.quarantinedStock + 2);
    // On hand increased by 2 (physical units in warehouse)
    assert.equal(afterProd.onHandStock, beforeProd.onHandStock + 2);
    // AVAILABLE STOCK MUST NOT INCREASE! (still same as before: 10)
    assert.equal(afterProd.stock, beforeProd.stock);

    // Verify movement
    const qMovement = movements.find((m) => m.kind === 'QUARANTINE');
    assert.ok(qMovement);
    assert.equal(qMovement.deltaQuarantined, 2);
  });

  it('transfers quarantined stock to available stock only if disposition is RESTOCKABLE', async () => {
    const { tx, products } = createReturnMockDb();

    const ret = await requestReturn(
      tx,
      {
        orderId: 'ord_1',
        reason: 'Khách đổi ý',
        items: [
          {
            orderItemId: 'item_headphone',
            productId: 'prod_headphone',
            quantity: 1,
            unitPriceSnapshot: '8000000',
            returnReason: 'Nguyên seal chưa bóc',
          },
        ],
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'APPROVED',
      expectedVersion: 1,
      operationKey: 'op_appr_d',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'ITEM_RECEIVED',
      expectedVersion: 2,
      operationKey: 'op_rcv_d',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'INSPECTED',
      expectedVersion: 3,
      operationKey: 'op_insp_d',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    const prodBefore = { ...products.get('prod_headphone') };

    // Apply RESTOCKABLE disposition
    await applyReturnDisposition(tx, {
      requestId: ret.id,
      disposition: 'RESTOCKABLE',
      operationKey: 'op_disp_restock',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      notes: 'Hàng nguyên seal, đủ điều kiện bán lại',
    });

    const prodAfter = products.get('prod_headphone');

    // Quarantined decreased by 1
    assert.equal(prodAfter.quarantinedStock, prodBefore.quarantinedStock - 1);
    // Available stock increased by 1!
    assert.equal(prodAfter.stock, prodBefore.stock + 1);
  });

  it('keeps DEFECTIVE disposition strictly out of available inventory', async () => {
    const { tx, products } = createReturnMockDb();

    const ret = await requestReturn(
      tx,
      {
        orderId: 'ord_1',
        reason: 'Hỏng hóc',
        items: [
          {
            orderItemId: 'item_headphone',
            productId: 'prod_headphone',
            quantity: 1,
            unitPriceSnapshot: '8000000',
            returnReason: 'Chập mạch bốc khói',
          },
        ],
        evidenceRefs: [],
      },
      'usr_cust1'
    );

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'APPROVED',
      expectedVersion: 1,
      operationKey: 'op_appr_def',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'ITEM_RECEIVED',
      expectedVersion: 2,
      operationKey: 'op_rcv_def',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    await transitionReturn(tx, {
      requestId: ret.id,
      targetStatus: 'INSPECTED',
      expectedVersion: 3,
      operationKey: 'op_insp_def',
      actorId: 'staff_1',
      actorRole: 'STAFF',
    });

    const prodBefore = { ...products.get('prod_headphone') };

    // Apply DEFECTIVE disposition
    await applyReturnDisposition(tx, {
      requestId: ret.id,
      disposition: 'DEFECTIVE',
      operationKey: 'op_disp_def',
      actorId: 'staff_1',
      actorRole: 'STAFF',
      notes: 'Hàng lỗi phần cứng, chuyển kho phế phẩm',
    });

    const prodAfter = products.get('prod_headphone');

    // Available stock must NEVER increase!
    assert.equal(prodAfter.stock, prodBefore.stock);
  });
});
