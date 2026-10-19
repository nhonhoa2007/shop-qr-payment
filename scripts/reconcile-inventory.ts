import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '@server/database/prisma';
import { reconcileInventory } from '@server/modules/admin/reconciliation-report.service';

export async function runInventoryReconciliationCli() {
  console.log('====================================================');
  console.log('      Inventory & Serial Reconciliation Check');
  console.log('                 (Read-Only Mode)          ');
  console.log('====================================================');

  try {
    const report = await reconcileInventory(prisma, { repair: false });
    console.log(`Products Checked : ${report.totalProductsChecked}`);
    console.log(`Variants Checked : ${report.totalVariantsChecked}`);
    console.log(`Movements Checked: ${report.totalMovementsChecked}`);
    console.log(`Serials Checked  : ${report.totalSerialsChecked}`);
    console.log(`Discrepancies    : ${report.discrepancies.length}`);
    console.log('----------------------------------------------------');

    if (report.discrepancies.length > 0) {
      console.error('\n[STATUS: DISCREPANCIES DETECTED]');
      for (const d of report.discrepancies) {
        console.error(`  - [${d.severity}] ${d.type}: ${d.message}`);
      }
      console.log('====================================================\n');
      process.exit(1);
    }

    console.log('\n[STATUS: PASS] Inventory ledger and stock projections are fully aligned.');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('Fatal error during inventory reconciliation:', err);
    process.exit(1);
  }
}

if (process.argv[1]) {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    if (path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
      runInventoryReconciliationCli();
    }
  } catch {
    // imported
  }
}
