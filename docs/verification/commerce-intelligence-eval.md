# Commerce Intelligence & AI Assistant Evaluation Report

- **Evaluation Date:** 2026-10-22T09:37:28.857Z
- **Execution Mode:** OFFLINE (Deterministic Mock / Zero Network Spend)
- **Status:** PASS (All Invariants Satisfied)

---

## 1. Traceability & Versioning

| Component | Version Tag |
|---|---|
| **Model / Evaluator Engine** | `deterministic-offline-grounding-v1` |
| **Prompt Template Version** | `commerce-intelligence-prompt-v2.1` |
| **Data Source Registry** | `m7-source-registry-v1` |
| **Value-for-Money Scoring** | `m2-value-for-money-v1` |

---

## 2. Benchmark Metrics Summary

| Metric | Target | Result | Status |
|---|---|---|---|
| **Total Test Cases** | 100 (50 Train / 25 Dev / 25 Held-Out) | 100 | PASS |
| **Source Accuracy** | 100% | 100.0% | PASS |
| **Numeric Exactness (No hallucinated numbers)** | 100% (0 unsupported) | 100.0% | PASS |
| **Citation Precision** | 100% | 100.0% | PASS |
| **Grounded Claim Rate** | 100% | 100.0% | PASS |
| **Abstention Correctness** | 100% | 100.0% | PASS |
| **Average Latency** | < 100ms | 0.02 ms | PASS |
| **Cost per Completed Answer** | $0.00 | $0.0000 | PASS |

---

## 3. Safety & Spend Invariants

1. **Held-Out Split Invariant:** Exactly 0 unsupported numeric claims on held-out test split.
2. **Offline Execution Rule:** Evaluator runs completely offline without sending data to external APIs.
3. **Spend Gate:** Online evaluation remains strictly gated behind explicit positive USD budget authorization.
4. **Synthetic Data Disclosure:** All synthetic benchmark references are explicitly disclosed to users.
