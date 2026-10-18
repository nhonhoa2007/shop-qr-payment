# Electronics Catalog Data Sources, Provenance & Licensing

- **Document Version:** 1.0.0 (M7 Release Candidate)
- **Status:** APPROVED
- **Enforcement:** `scripts/import-electronics-catalog.ts` via DataSource status & checksums

---

## 1. Overview and Provenance Principles

This document defines the origin, intellectual property compliance, and licensing policy for all data incorporated into the Shop QR Payment electronics catalog and intelligence engine.

In accordance with Section 14 of `docs/superpowers/specs/2026-10-17-electronics-commerce-intelligence-design.md`:
1. **Zero Unverified Scraping:** Raw or copyrighted external datasets without explicit redistribution licenses are strictly forbidden from production retrieval and scoring.
2. **Deterministic Provenance:** Every technical specification, benchmark measurement, and compatibility rule links back to an active `DataSource` record with a cryptographic checksum.
3. **Revocation Immunity:** If a source is revoked (`status = 'REVOKED'`), all associated models and cached representations are immediately quarantined and excluded from scoring.

---

## 2. Approved Primary Data Sources

| Source ID | Source Name | Publisher | License | Scope |
|---|---|---|---|---|
| `src-apple-specs` | Apple Hardware Technical Specifications | Apple Inc. | Public Product Specifications (Fair Use Reference) | MacBooks, iPhones, AirPods, MagSafe |
| `src-dell-specs` | Dell XPS & Latitude Technical Specs | Dell Technologies | Public Product Specifications (Fair Use Reference) | XPS 13, XPS 15, Latitude Laptops |
| `src-lenovo-specs` | Lenovo ThinkPad & Legion PSREF Specs | Lenovo Group | Public PSREF Documentation (Reference) | ThinkPad X1 Carbon, Legion Pro 7i |
| `src-samsung-specs` | Samsung Galaxy Hardware Specifications | Samsung Electronics | Public Technical Specifications (Fair Use Reference) | Galaxy S24 Ultra, Galaxy Z Fold, Buds |
| `src-anker-specs` | Anker Power & Charging Specifications | Anker Innovations | Public Technical Documentation (Reference) | GaN Chargers, Power Banks, Cables |
| `src-sony-specs` | Sony Audio & Peripheral Specifications | Sony Group | Public Hardware Specifications (Reference) | WH-1000XM5, WF-1000XM5 Headphones |
| `src-asus-specs` | ASUS ROG & Zenbook Hardware Specifications | ASUS TeK Computer | Public Hardware Documentation (Reference) | Zenbook 14 OLED, ROG Zephyrus G14 |
| `src-logitech-specs` | Logitech Peripherals Technical Specs | Logitech International | Public Technical Specifications (Reference) | MX Master 3S, MX Mechanical, Webcams |

---

## 3. Disallowed and Quarantined Source Categories

1. **Amazon Reviews 2023 (Disallowed):**
   - Unlicensed raw review dumps are **prohibited** from production storage and scoring.
2. **UCI Sentiment Labelled Sentences (Eval Only):**
   - Restricted solely to offline AI assistant safety and sentiment evaluations; never mapped to product records.
3. **Open Icecat (Quarantined Without Explicit Commercial Key):**
   - Open Icecat feeds are quarantined unless verified with an active partner key.
4. **Disputed Community Submissions:**
   - Any community specification marked `status = 'REVOKED'` or `status = 'QUARANTINED'` is barred from activating product listings.

---

## 4. Synthetic Demo Data Disclosure

Synthetic demo fixtures generated for student presentations, test runs, and local verification:
- Must carry `isSynthetic: true` in the `DataSource` record or `origin: "SYNTHETIC_DEMO"` in metadata.
- Are strictly quarantined from production value-for-money scoring algorithms (`ProductScoreSnapshot`).
- Do not overwrite or contaminate genuine merchant orders, customer balances, or serialized stock.
