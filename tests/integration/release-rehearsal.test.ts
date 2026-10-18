import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  reconcileInventory,
  reconcileMoney,
} from '../../src/server/modules/admin/reconciliation-report.service.ts';

const db = new PrismaClient();

test('Release Rehearsal Integration: Database consistency and read-only reconciliation', async (t) => {
  try {
    await db.$connect();
  } catch {
    t.skip('Skipping database-dependent test: PostgreSQL is not running locally');
    return;
  }

  // 1. Snapshot counts before
  const userCountBefore = await db.user.count();
  const orderCountBefore = await db.order.count();
  const movementCountBefore = await db.inventoryMovement.count();
  const walletCountBefore = await db.userWallet.count();

  // 2. Run read-only inventory reconciliation
  const inventoryReport = await reconcileInventory(db, { repair: false });
  assert.ok(inventoryReport.totalProductsChecked >= 0);
  assert.equal(inventoryReport.repairAttempted, false);

  // 3. Run read-only money reconciliation
  const moneyReport = await reconcileMoney(db);
  assert.ok(moneyReport.totalWalletsChecked >= 0);
  assert.ok(moneyReport.totalOrdersChecked >= 0);

  // 4. Injected failure/rollback rehearsal: simulate transaction rollback
  let rollbackHappened = false;
  try {
    await db.$transaction(async (tx) => {
      // Simulate attempting an invalid operation that rolls back
      await tx.user.create({
        data: {
          email: 'temporary-rehearsal-rollback@shop.local',
          password: 'hashed-password',
          name: 'Rollback User',
          role: 'CUSTOMER',
        },
      });
      // Injected deliberate failure
      throw new Error('INJECTED_ROLLBACK_FOR_REHEARSAL');
    });
  } catch (err: any) {
    if (err.message === 'INJECTED_ROLLBACK_FOR_REHEARSAL') {
      rollbackHappened = true;
    }
  }

  assert.equal(rollbackHappened, true, 'Transaction must cleanly roll back on error');

  // Verify counts after rollback are completely unchanged
  const userCountAfter = await db.user.count();
  const orderCountAfter = await db.order.count();
  const movementCountAfter = await db.inventoryMovement.count();
  const walletCountAfter = await db.userWallet.count();

  assert.equal(userCountAfter, userCountBefore, 'User count must be preserved after rollback');
  assert.equal(orderCountAfter, orderCountBefore, 'Order count must be preserved after rollback');
  assert.equal(movementCountAfter, movementCountBefore, 'Movement count must be preserved after rollback');
  assert.equal(walletCountAfter, walletCountBefore, 'Wallet count must be preserved after rollback');
});
