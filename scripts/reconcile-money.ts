import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '@server/database/prisma';
import { reconcileMoney } from '@server/modules/admin/reconciliation-report.service';

export async function runMoneyReconciliationCli() {
  console.log('====================================================');
  console.log('       Financial & Wallet Reconciliation Check');
  console.log('                 (Read-Only Mode)          ');
  console.log('====================================================');

  try {
    const report = await reconcileMoney(prisma);
    console.log(`Wallets Checked     : ${report.totalWalletsChecked}`);
    console.log(`Orders Checked      : ${report.totalOrdersChecked}`);
    console.log(`Transactions Checked: ${report.totalTransactionsChecked}`);
    console.log(`Discrepancies       : ${report.discrepancies.length}`);
    console.log('----------------------------------------------------');

    if (report.discrepancies.length > 0) {
      console.error('\n[STATUS: DISCREPANCIES DETECTED]');
      for (const d of report.discrepancies) {
        console.error(`  - [${d.severity}] ${d.type}: ${d.message}`);
      }
      console.log('====================================================\n');
      process.exit(1);
    }

    console.log('\n[STATUS: PASS] Wallets, orders, and financial transactions are fully aligned.');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('Fatal error during financial reconciliation:', err);
    process.exit(1);
  }
}

if (process.argv[1]) {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    if (path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
      runMoneyReconciliationCli();
    }
  } catch {
    // imported
  }
}
