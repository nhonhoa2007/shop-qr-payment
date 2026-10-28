-- A durable uniqueness guard for wallet top-ups. Nullable values preserve
-- existing purchase/refund transaction behavior.
ALTER TABLE "WalletTransaction"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key"
ON "WalletTransaction"("idempotencyKey");
