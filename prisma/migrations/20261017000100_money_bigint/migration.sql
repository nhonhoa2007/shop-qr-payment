-- Migration: 20261017000100_money_bigint
-- Description: Convert all monetary fields across the commerce schema to PostgreSQL BIGINT
-- using explicit USING column::bigint casts to prevent integer overflow for high-value transactions.

-- 1. Product catalog monetary fields
-- Product.price: Unit price of base products
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE BIGINT USING "price"::bigint;

-- ProductVariant.price: Unit price of product variants
ALTER TABLE "ProductVariant" ALTER COLUMN "price" SET DATA TYPE BIGINT USING "price"::bigint;

-- 2. Order monetary fields
-- Order.totalAmount: Total payable amount for an order
ALTER TABLE "Order" ALTER COLUMN "totalAmount" SET DATA TYPE BIGINT USING "totalAmount"::bigint;

-- Order.subtotal: Subtotal before discounts and shipping
ALTER TABLE "Order" ALTER COLUMN "subtotal" SET DATA TYPE BIGINT USING "subtotal"::bigint;
ALTER TABLE "Order" ALTER COLUMN "subtotal" SET DEFAULT 0;

-- Order.discountAmount: Total promotional discount applied
ALTER TABLE "Order" ALTER COLUMN "discountAmount" SET DATA TYPE BIGINT USING "discountAmount"::bigint;
ALTER TABLE "Order" ALTER COLUMN "discountAmount" SET DEFAULT 0;

-- Order.shippingFee: Carrier shipping charge
ALTER TABLE "Order" ALTER COLUMN "shippingFee" SET DATA TYPE BIGINT USING "shippingFee"::bigint;
ALTER TABLE "Order" ALTER COLUMN "shippingFee" SET DEFAULT 0;

-- OrderItem.price: Historical snapshot unit price per line item
ALTER TABLE "OrderItem" ALTER COLUMN "price" SET DATA TYPE BIGINT USING "price"::bigint;

-- 3. Coupon promotion monetary fields
-- Retain legacy discountValue as INTEGER for backward compatibility until Task 3
-- Add explicit typed fields for fixed discount amount and percentage rate:
ALTER TABLE "Coupon" ADD COLUMN "fixedDiscountAmount" BIGINT;
ALTER TABLE "Coupon" ADD COLUMN "percentageRate" INTEGER;

-- Backfill from discountValue based on discountType
UPDATE "Coupon"
SET "fixedDiscountAmount" = "discountValue"::bigint
WHERE "discountType" = 'FIXED';

UPDATE "Coupon"
SET "percentageRate" = "discountValue"
WHERE "discountType" = 'PERCENTAGE';

-- Coupon.maxDiscount: Maximum discount cap for percentage discounts
ALTER TABLE "Coupon" ALTER COLUMN "maxDiscount" SET DATA TYPE BIGINT USING "maxDiscount"::bigint;

-- Coupon.minOrderAmount: Minimum order subtotal required to use coupon
ALTER TABLE "Coupon" ALTER COLUMN "minOrderAmount" SET DATA TYPE BIGINT USING "minOrderAmount"::bigint;
ALTER TABLE "Coupon" ALTER COLUMN "minOrderAmount" SET DEFAULT 0;

-- 4. Payment and banking reconciliation monetary fields
-- Transaction.amount: Received payment transaction amount
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING "amount"::bigint;

-- BankTransfer.amount: Inbound bank transfer ledger amount
ALTER TABLE "BankTransfer" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING "amount"::bigint;

-- RefundCase.amount: Operator refund case amount
ALTER TABLE "RefundCase" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING "amount"::bigint;

-- 5. Shipping carrier monetary fields
-- Shipment.shippingFee: Actual carrier shipping fee
ALTER TABLE "Shipment" ALTER COLUMN "shippingFee" SET DATA TYPE BIGINT USING "shippingFee"::bigint;

-- Shipment.codAmount: Cash-on-delivery collection amount
ALTER TABLE "Shipment" ALTER COLUMN "codAmount" SET DATA TYPE BIGINT USING "codAmount"::bigint;
ALTER TABLE "Shipment" ALTER COLUMN "codAmount" SET DEFAULT 0;

-- 6. User wallet and internal ledger monetary fields
-- UserWallet.balance: Customer internal wallet balance
ALTER TABLE "UserWallet" ALTER COLUMN "balance" SET DATA TYPE BIGINT USING "balance"::bigint;
ALTER TABLE "UserWallet" ALTER COLUMN "balance" SET DEFAULT 0;

-- WalletTransaction.amount: Ledger entry amount (credits and debits)
ALTER TABLE "WalletTransaction" ALTER COLUMN "amount" SET DATA TYPE BIGINT USING "amount"::bigint;
