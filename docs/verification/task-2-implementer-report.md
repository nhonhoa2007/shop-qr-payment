# M0 Task 2 Implementer Report: MoneyVnd Boundary & BigInt Schema Migration

- **Task:** Task 2 - MoneyVnd boundary và BigInt schema migration
- **Plan Reference:** `docs/superpowers/plans/2026-10-17-m0-commerce-safety-foundation.md`
- **Baseline Commits Cherry-Picked In Order:**
  1. `6f6ab6550ed80d269aefe17cd6fc15c1ab886185` (`chore: snapshot approved commerce baseline`)
  2. `dd7cbdf0ae47121a6c2f89fb5e82bdda7885f9af` (`chore: record M0 verification baseline`)
  3. `74eb1c9` (`chore: complete synchronized commerce baseline`)
- **Status:** COMPLETED

---

## 1. TDD Implementation & Verification

### 1.1 RED Phase Output
Before implementing `src/shared/utils/money.ts`, `src/shared/types/money.ts`, and `src/server/modules/money/money-serialization.ts`, the new test file `tests/money.test.ts` failed as expected:

```
$ node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/money.test.ts

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@shared/utils' imported from .../tests/money.test.ts
✖ tests/money.test.ts (71.842781ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
```

### 1.2 GREEN Phase Output
After implementing pure domain utilities and types, the suite executed cleanly:

```
$ node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/money.test.ts

✔ parseMoneyVnd parses valid external decimal strings and safe integers (0.683343ms)
✔ parseMoneyVnd rejects invalid, negative, decimal, exponent, or out-of-bounds input (0.390263ms)
✔ serializeMoneyVnd serializes trusted nonnegative bigint to MoneyVnd string (0.128511ms)
✔ addMoney adds bigints safely and enforces nonnegativity (0.724491ms)
✔ allocateProportionally divides total with stable input-index tie break and exact conservation (0.706667ms)
✔ MoneySnapshot and MoneyVnd type contract (0.091511ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 68.964403
```

---

## 2. Business Rules & Interface Conformance

1. **`parseMoneyVnd(value: unknown, field: string): bigint`**:
   - Enforces nonnegative integer decimal string or safe integer input.
   - Enforces business upper bound cap of `9_000_000_000_000_000n` (`9_000_000_000_000_000` VND / 9 quadrillion VND).
   - Rejects negative values (`-1`, `-0`, `-500`), decimals (`1.5`, `12.34`), exponents (`1e6`), whitespace, and non-numeric characters with descriptive error mentioning `field`.
2. **`serializeMoneyVnd(value: bigint): MoneyVnd`**:
   - Accepts trusted nonnegative `bigint`, including values above the business cap (e.g., `9007199254740992n`, `10000000000000000n`).
   - Serializes strictly to decimal string.
   - Rejects negative bigints.
3. **`addMoney(...values: bigint[]): bigint`**:
   - Safely sums arbitrary number of nonnegative bigints.
   - Rejects negative inputs.
4. **`allocateProportionally(total: bigint, weights: bigint[]): bigint[]`**:
   - Uses Hamilton / Largest Remainder method with exact conservation (`sum(allocated) === total`).
   - Resolves remainder distribution with stable input-index tie break (earlier index receives priority on identical remainders).
   - Handles zero weights gracefully and rejects negative values.
5. **`MoneySnapshot`**:
   - `{ amount: MoneyVnd; currency: 'VND'; revision: string }` defined and exported in `@shared/types/money`.

---

## 3. Schema & Database Migration

### 3.1 Schema Validation
Command: `DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma validate`
Output:
```
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```

### 3.2 Converted Columns in `prisma/migrations/20261017000100_money_bigint/migration.sql`
Every monetary field in the schema was migrated to `BIGINT` with explicit `USING column::bigint` casts and SQL documentation:

1. `Product.price` -> `BIGINT USING "price"::bigint`
2. `ProductVariant.price` -> `BIGINT USING "price"::bigint`
3. `Order.totalAmount` -> `BIGINT USING "totalAmount"::bigint`
4. `Order.subtotal` -> `BIGINT USING "subtotal"::bigint` (DEFAULT 0)
5. `Order.discountAmount` -> `BIGINT USING "discountAmount"::bigint` (DEFAULT 0)
6. `Order.shippingFee` -> `BIGINT USING "shippingFee"::bigint` (DEFAULT 0)
7. `OrderItem.price` -> `BIGINT USING "price"::bigint`
8. `Coupon.discountValue` -> `BIGINT USING "discountValue"::bigint`
9. `Coupon.maxDiscount` -> `BIGINT USING "maxDiscount"::bigint`
10. `Coupon.minOrderAmount` -> `BIGINT USING "minOrderAmount"::bigint` (DEFAULT 0)
11. `Transaction.amount` -> `BIGINT USING "amount"::bigint`
12. `BankTransfer.amount` -> `BIGINT USING "amount"::bigint`
13. `RefundCase.amount` -> `BIGINT USING "amount"::bigint`
14. `Shipment.shippingFee` -> `BIGINT USING "shippingFee"::bigint`
15. `Shipment.codAmount` -> `BIGINT USING "codAmount"::bigint` (DEFAULT 0)
16. `UserWallet.balance` -> `BIGINT USING "balance"::bigint` (DEFAULT 0)
17. `WalletTransaction.amount` -> `BIGINT USING "amount"::bigint`

### 3.3 Integration DB Rehearsal Status
- **Status:** **BLOCKED**
- **Reason:** In accordance with prompt instructions and safety protocol, no migration was run against live or unknown databases. A disposable PostgreSQL database clone is required for row count and SUM(amount) rehearsal.

### 3.4 Integration Test Compilation
- Added high-value round-trip test fixture (`3_000_000_000n` above Int32 max) in `tests/integration/money-shipping.test.ts`.
- The test compiles and was not run against live database per protocol.

---

## 4. Architecture Check
- **Command:** `npm run arch:check`
- **Output:**
```
✔ no dependency violations found (256 modules, 815 dependencies cruised)
```

---

## 5. Changed Files

- `src/shared/types/money.ts`: Created core `MoneyVnd` and `MoneySnapshot` definitions.
- `src/shared/types/index.ts`: Re-exported money types.
- `src/shared/utils/money.ts`: Implemented `parseMoneyVnd`, `serializeMoneyVnd`, `addMoney`, `allocateProportionally`.
- `src/shared/utils/index.ts`: Re-exported money utilities.
- `src/server/modules/money/money-serialization.ts`: Server-side BigInt serialization and JSON replacer helpers.
- `prisma/schema.prisma`: Migrated 17 monetary fields across 11 models from Int to BigInt.
- `prisma/migrations/20261017000100_money_bigint/migration.sql`: DDL migration script with explicit `USING column::bigint` casts and SQL comments.
- `tests/money.test.ts`: Pure unit tests covering parsing, serialization, addition, allocation, and error boundaries.
- `tests/integration/money-shipping.test.ts`: Added high-value integration test above Int32 boundary.
- `docs/verification/task-2-implementer-report.md`: This report.

---

## 6. Self-Review

- **Isolation & Boundary:** Scope strictly contained to Task 2. DTO and controller propagation deferred to Task 3.
- **Pure Helper Compilation:** TypeScript check on new money modules passes with zero errors (`tsc --noEmit`).
- **TDD:** Followed RED then GREEN workflow.
- **Dependencies:** `package.json`, `package-lock.json`, and dependencies remain completely unmodified.

---

## 7. Fix Round 1 (Addressing Task Review Findings)

1. **Coupon Monetary vs Percentage Discrimination:**
   - Retained `Coupon.discountValue` as `Int` for backward compatibility.
   - Added explicit typed columns `fixedDiscountAmount BigInt?` and `percentageRate Int?` to `prisma/schema.prisma`.
   - Updated `prisma/migrations/20261017000100_money_bigint/migration.sql` to add these columns and backfill them based on `discountType`.
2. **Workspace Import Convention:**
   - Fixed `src/shared/utils/money.ts:1` to import from `@shared/types/money` using the required path alias.
3. **Integration Test Robustness:**
   - Updated `tests/integration/money-shipping.test.ts` to track created entity IDs in a `created` map and clean up in `finally` even if subsequent creation steps fail.
   - Asserted `typeof fetched.price === 'bigint'` directly without masking via `BigInt(...)`.
4. **Verification Evidence:**
   - `node --experimental-strip-types --import ./tests/register-alias.mjs --test tests/money.test.ts`: 6/6 PASS.
   - `npm run arch:check`: 0 violations across 256 modules.

