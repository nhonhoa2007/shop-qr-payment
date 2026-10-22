import { prisma } from '../src/server/database/prisma.ts';
import { backfillOpeningLegacyMovements } from '../src/server/modules/inventory/inventory-ledger.service.ts';

async function main() {
  const projectionIsEmpty = {
    stock: { gt: 0 },
    onHandStock: 0,
    reservedStock: 0,
    quarantinedStock: 0,
  };
  const [variants, products] = await Promise.all([
    prisma.productVariant.count({ where: projectionIsEmpty }),
    prisma.product.count({ where: projectionIsEmpty }),
  ]);

  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({
      potentialVariantOpenings: variants,
      potentialProductOpenings: products,
      message: 'Chỉ kiểm tra. Chạy npm run db:backfill-inventory -- --apply để ghi dữ liệu.',
    }));
    return;
  }

  const result = await prisma.$transaction(
    (tx) => backfillOpeningLegacyMovements(tx),
    { timeout: 120_000 }
  );
  console.log(JSON.stringify({ ...result, potentialVariantOpenings: variants, potentialProductOpenings: products }));
}

main()
  .catch((error) => {
    console.error('Inventory backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
