export async function migrateTransactionsToBankTransfers(
  tx: any
): Promise<{ migratedCount: number; skippedCount: number; totalAmountMigrated: bigint }> {
  let migratedCount = 0;
  let skippedCount = 0;
  let totalAmountMigrated = 0n;

  if (!('transaction' in tx) || typeof (tx as any).transaction?.findMany !== 'function') {
    return { migratedCount: 0, skippedCount: 0, totalAmountMigrated: 0n };
  }

  const legacyTransactions = await tx.transaction.findMany();

  for (const t of legacyTransactions) {
    const fingerprint = t.bankTransId
      ? `legacy_tx:${t.bankTransId}`
      : `legacy_tx_id:${t.id}`;

    const existing = await tx.bankTransfer.findUnique({
      where: { fingerprint },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const amount = BigInt(t.amount);
    await tx.bankTransfer.create({
      data: {
        fingerprint,
        bankTransId: t.bankTransId ?? null,
        amount,
        description: t.description,
        bankName: t.bankName ?? null,
        orderId: t.orderId ?? null,
        status: 'APPLIED_ORDER',
        receivedAt: t.receivedAt ?? t.createdAt,
        createdAt: t.createdAt,
      },
    });

    migratedCount++;
    totalAmountMigrated += amount;
  }

  return { migratedCount, skippedCount, totalAmountMigrated };
}

export async function getReconciledPaymentAnalytics(
  tx: any
): Promise<{ totalPaidTransfers: number; totalRevenueBigInt: bigint }> {
  const transfers = await tx.bankTransfer.findMany({
    where: {
      status: 'APPLIED_ORDER',
    },
  });

  const totalRevenueBigInt = transfers.reduce(
    (sum: bigint, item: any) => sum + BigInt(item.amount),
    0n
  );

  return {
    totalPaidTransfers: transfers.length,
    totalRevenueBigInt,
  };
}
