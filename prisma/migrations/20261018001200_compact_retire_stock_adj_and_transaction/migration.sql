-- AlterTable
ALTER TABLE "BankTransfer" ADD COLUMN "senderAccount" TEXT;
ALTER TABLE "BankTransfer" ALTER COLUMN "rawWebhookData" DROP NOT NULL;

-- Backfill StockAdjustment into InventoryMovement(ADJUST)
INSERT INTO "InventoryMovement" (
    "id", "operationKey", "productId", "variantId", "kind",
    "deltaOnHand", "deltaReserved", "deltaQuarantined",
    "beforeOnHand", "afterOnHand", "beforeReserved", "afterReserved",
    "beforeQuarantined", "afterQuarantined", "beforeAvailable", "afterAvailable",
    "beforeVersion", "afterVersion", "reason", "actorId",
    "referenceType", "referenceId", "createdAt"
)
SELECT
    'mig_adj_' || id,
    "operationKey",
    "productId",
    "variantId",
    'ADJUST'::"MovementKind",
    delta, 0, 0,
    "previousStock", "newStock", 0, 0,
    0, 0, "previousStock", "newStock",
    GREATEST(0, version - 1), version,
    reason, "actorId",
    'STOCK_ADJUSTMENT', id, "createdAt"
FROM "StockAdjustment"
ON CONFLICT ("operationKey") DO NOTHING;

-- Backfill Transaction into BankTransfer(APPLIED_ORDER)
INSERT INTO "BankTransfer" (
    "id", "fingerprint", "bankTransId", "amount", "description",
    "bankName", "senderAccount", "receivedAt", "orderId",
    "status", "rawWebhookData", "createdAt"
)
SELECT
    'mig_tx_' || id,
    COALESCE('legacy_tx:' || "bankTransId", 'legacy_tx_id:' || id),
    "bankTransId",
    amount,
    description,
    "bankName",
    "senderAccount",
    "receivedAt",
    "orderId",
    'APPLIED_ORDER'::"BankTransferStatus",
    "rawWebhookData",
    "createdAt"
FROM "Transaction"
ON CONFLICT ("fingerprint") DO NOTHING;

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_orderId_fkey";

-- DropTable
DROP TABLE IF EXISTS "StockAdjustment";

-- DropTable
DROP TABLE IF EXISTS "Transaction";
