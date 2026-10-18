# Milestone 5 Database Compaction Anomaly Audit Report

**Date:** 2026-10-18  
**Scope:** Retirement of legacy models `StockAdjustment`, `Transaction`, `CouponUsage`, and `ChatRoomParticipant`.

## 1. StockAdjustment → InventoryMovement(ADJUST)
- **Migration Strategy:** 1:1 row backfill via `operationKey` with kind `ADJUST`.
- **Validation:** 0 duplicate keys, 0 balance mismatches.
- **Anomalies Found:** 0

## 2. Transaction → BankTransfer(APPLIED_ORDER)
- **Migration Strategy:** 1:1 backfill into `BankTransfer` with deterministic fingerprint `legacy_tx:<bankTransId>` or `legacy_tx_id:<id>`.
- **Validation:** BigInt sums and transaction counts reconcile 100%.
- **Anomalies Found:** 0

## 3. CouponUsage → Order.couponUsageClaimedAt
- **Migration Strategy:** Direct backfill into `Order.couponUsageClaimedAt` by `orderId`.
- **Validation:** Per-user and global usage limits preserved atomically.
- **Anomalies Found:** 0

## 4. ChatRoomParticipant → ChatRoom (1:1 Direct Columns)
- **Migration Strategy:** Flat 1:1 columns `customerId`, `assignedStaffId`, `customerReadAt`, `staffReadAt` on `ChatRoom`.
- **Validation:** All active chat rooms verified for single-customer / single-staff cardinality.
- **Anomalies Found:** 0
