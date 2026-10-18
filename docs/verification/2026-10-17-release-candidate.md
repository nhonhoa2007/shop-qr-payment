# Release Candidate Verification Protocol & Evidence Ledger (Milestone 7)

- **Release Target:** Milestone 7 (Hardening, Verification, Compact Schema & Release)
- **Branch:** `feature/m7-hardening-release`
- **Target Schema Budget:** Exactly 34 Prisma Models (Hard Cap 40, Target Ceiling 37)
- **Catalog Scope:** 40–60 Electronics Product Models (10–15 Laptops, 10–15 Phones, 20–30 Accessories)
- **Reconciliation Mode:** Read-Only Discrepancy Auditing (Zero Silent DB Mutations)
- **AI Evaluation Mode:** Offline Deterministic (Zero Network Transport / Zero USD Spend)

---

## 1. Release Quality Gates Checklist

| # | Verification Gate | Command | Required Evidence | Actual Status |
|---|---|---|---|---|
| **G1** | Prisma Schema Validation | `npx prisma validate` | Schema valid, syntax OK | PENDING_EVIDENCE |
| **G2** | Schema Model Registry Budget | `npm run schema:budget -- --expected=34 --lock-registry` | Exact 34 models, 0 added, 0 forbidden | PENDING_EVIDENCE |
| **G3** | Architecture Boundaries | `npm run arch:check` | 0 violations via dependency-cruiser | PENDING_EVIDENCE |
| **G4** | Static Code Analysis | `npm run lint` | 0 ESLint errors/warnings | PENDING_EVIDENCE |
| **G5** | Unit Test Suite | `npm test` | All unit tests pass cleanly | PENDING_EVIDENCE |
| **G6** | Integration Rehearsal | `npm run test:integration` | PostgreSQL integration passing | PENDING_EVIDENCE |
| **G7** | Catalog Manifest Import | `node scripts/import-electronics-catalog.ts --dry-run` | 40–60 product models, unique SKUs, valid sources | PENDING_EVIDENCE |
| **G8** | Inventory Reconciliation | `node scripts/reconcile-inventory.ts` | Zero parent-variant or movement discrepancies | PENDING_EVIDENCE |
| **G9** | Financial Reconciliation | `node scripts/reconcile-money.ts` | Zero wallet ledger or refund ceiling discrepancies | PENDING_EVIDENCE |
| **G10** | Offline AI Grounding Eval | `npm run eval:assistant` | 0 unsupported claims on held-out split | PENDING_EVIDENCE |
| **G11** | Next.js Production Build | `npm run build` | Route tree compiled without type/runtime errors | PENDING_EVIDENCE |

---

## 2. Evidence Execution Logs

### G1: Prisma Validate
```bash
# Command: npx prisma validate
# Evidence to be captured during final release run
```

### G2: Schema Model Budget Gate
```bash
# Command: npm run schema:budget -- --expected=34 --lock-registry
# Evidence to be captured during final release run
```

### G3: Architecture Boundaries
```bash
# Command: npm run arch:check
# Evidence to be captured during final release run
```

### G4: ESLint Linting
```bash
# Command: npm run lint
# Evidence to be captured during final release run
```

### G5: Unit Test Suite
```bash
# Command: npm test
# Evidence to be captured during final release run
```

### G6: Integration Test Suite
```bash
# Command: npm run test:integration
# Evidence to be captured during final release run
```

### G7: Catalog Manifest Validation
```bash
# Command: node --experimental-strip-types scripts/import-electronics-catalog.ts --dry-run
# Evidence to be captured during final release run
```

### G8: Inventory Reconciliation
```bash
# Command: node --experimental-strip-types scripts/reconcile-inventory.ts
# Evidence to be captured during final release run
```

### G9: Financial Reconciliation
```bash
# Command: node --experimental-strip-types scripts/reconcile-money.ts
# Evidence to be captured during final release run
```

### G10: Offline AI Assistant Grounding Evaluation
```bash
# Command: npm run eval:assistant
# Evidence to be captured during final release run
```

### G11: Next.js Production Build
```bash
# Command: npm run build
# Evidence to be captured during final release run
```

---

## 3. Release Sign-Off Signatures

- [ ] **Architecture Lead:** Model registry locked at 34 models; ADR ratified.
- [ ] **Data & Licensing Lead:** Catalog sources vetted; zero unlicensed scraping.
- [ ] **Operations & Financial Lead:** Reconciliation reports clean; zero silent repairs.
- [ ] **AI Safety Officer:** 100-case evaluation passed with 0 unsupported claims on held-out split.
- [ ] **Release Manager:** All CI and local gates clean; ready for release tagging.
