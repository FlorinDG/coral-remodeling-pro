# CORAL — CODER REPORT — DB-HEADER-1-M1

### 0 · Header
```
Item:            DB-HEADER-1-M1
Directive:       .agents/workflows/coder-directive-db-header-1.md
Directive blob:  922aa2fbd255ca053db2ab1cdf001e1492f063c7
Start SHA:       9aa2ad10ea762ff0542385150fb77673552084c8
End SHA:         3ee25c658f8b86e0018f6f6fca1ae7a2cbb54d7e
Branch:          develop
Date:            2026-10-05
```

---

### 1 · Outcome
`DONE — Canonical database header pure rule implemented in src/lib/records/db-header.ts with 13 unit tests and throw proofs in tests/db-header.test.ts, satisfying corrections C1–C6: real home imports (canRunAccountantExport, ACCOUNTANT_EXPORT_SOURCES), i18n keys for all labels, screen tabs from data, strictly existing actions (C4 parity), and view tabs enabled across all databases including CRM.`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `3ee25c65` | `feat(db-header): M1 — canonical database header pure rule and tests` | 2 | +577/−0 |
| `d5dc265d` | `docs(report): DB-HEADER-1-M1` | 1 | +142 |

---

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| C1 | Reuses canonical rules from real homes (`canRunAccountantExport`, `ACCOUNTANT_EXPORT_SOURCES`, `systemDatabaseEntitled`); does not import client `isTenantDatabase` | ✅ | `src/lib/records/db-header.ts:16-18` |
| C2 | No visible text in the rule — returns i18n keys (`schemaLink.labelKey`, action `labelKey`, `preventDeleteMessageKey`) | ✅ | `src/lib/records/db-header.ts:145-215` |
| C3 | Screen tabs from data (CRM pipeline tabs, Project type tabs) | ✅ | `src/lib/records/db-header.ts:138-140` |
| C4 | Parity first: declares only actions existing today (tickets: scan, bulk, manual; expenses/invoices: scan, manual, peppol-sync; other screens: 0 actions) | ✅ | `src/lib/records/db-header.ts:144-160`; test `tests/db-header.test.ts:47-98` |
| C5 | Primary actions use tenant brand color via variant `'primary'` | ✅ | `src/lib/records/db-header.ts:146, 153` |
| C6 | Header serves both grids: `gridV2Enabled` does not affect toolbar item visibility | ✅ | `src/lib/records/db-header.ts:187-199` |
| M1.1 | View tabs enabled for ALL screens including CRM / Bobex (Q1) | ✅ | `src/lib/records/db-header.ts:142`; test `tests/db-header.test.ts:25-45` |
| M1.2 | Unit tests (13 tests) with node test runner | ✅ | `tests/db-header.test.ts:1-260` |
| M1.3 | Throw proofs: accountant export cannot leak; schemaLink returns i18n keys only | ✅ | `tests/db-header.test.ts:230-260` |

---

### 4 · Files vs blast radius
Verbatim from `git diff --stat 9aa2ad10..3ee25c65`:
```
 src/lib/records/db-header.ts | 215 +++++++++++++++++++++++++++++++++++++++
 tests/db-header.test.ts      | 262 +++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 477 insertions(+)
```

| File | In blast radius? |
|---|---|
| `src/lib/records/db-header.ts` | ✅ Yes (§FENCE) |
| `tests/db-header.test.ts` | ✅ Yes (§FENCE) |

Zero files outside `src/lib/records/db-header.ts` and `tests/db-header.test.ts` were touched.

---

### 5 · Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `db-header.ts:183-186` | Message key for non-deletable records on invoices/expenses | 1. Boolean only<br>2. Named i18n key | Chosen: `preventDeleteMessageKey: 'admin.databases.draftOnlyDelete'` | Matches C2 requirement that visible warnings/text pass through i18n |
| `db-header.ts:168-172` | How to gate CSV Import on financial document databases | 1. Hardcode by role<br>2. Block for locked financial doc roles unless `isUngated` is true | Chosen: Block unless `isUngated` | Matches `NotionGrid.tsx:536` (`!lockedSchema && !isAccountant`) |

---

### 6 · Verification — commands, not descriptions

### VERIFY 1 — Unit tests with Node test runner
```
$ node --import ./tests/register.mjs --test 'tests/db-header.test.ts'; echo "exit: $?"
✔ computeDatabaseHeader: formats title and row counts correctly (1.050541ms)
✔ computeDatabaseHeader: CRM and Bobex always show view tabs (Q1) and carry screen tabs from data (C3) (0.815959ms)
✔ computeDatabaseHeader: Projects carries project type tabs from data (C3) (0.278167ms)
✔ computeDatabaseHeader: tickets declares exactly scan, bulk, and manual actions with i18n keys (C2, C4) (0.302292ms)
✔ computeDatabaseHeader: purchase invoices declares scan, manual, and peppol-sync actions (C4) (0.125ms)
✔ computeDatabaseHeader: other screens have no declared actions (C4 parity constraint) (0.148417ms)
✔ computeDatabaseHeader: accountant export visible ONLY for authorized sources and roles (C1) (0.123416ms)
✔ computeDatabaseHeader: import blocked for locked financial databases unless ungated (0.093833ms)
✔ computeDatabaseHeader: bulk approve only enabled for expenses inbox with selected rows (0.088834ms)
✔ computeDatabaseHeader: delete shows draftOnlyDelete messageKey for invoices and expenses (0.259375ms)
✔ computeDatabaseHeader: schema pill returns proper i18n labelKey and gating (C2) (0.37925ms)
✔ THROW PROOF: accountant export cannot leak to unauthorized roles or sources (0.161708ms)
✔ THROW PROOF: schemaLink returns only valid i18n keys, never raw visible text (C2) (0.080083ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 365.177667
exit: 0
```

### VERIFY 2 — TypeScript Compile Check & ESLint
```
$ npm run test:compile && npx eslint src/lib/records/db-header.ts tests/db-header.test.ts; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```
(0 errors, 0 warnings.)

### VERIFY 3 — Full Test Suite
```
$ node --import ./tests/register.mjs --test 'tests/*.test.ts'; echo "exit: $?"
ℹ tests 548
ℹ suites 57
ℹ pass 536
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 12
ℹ duration_ms 4580.1245
exit: 0
```

---

### 7 · Measurements
- Lines of code in pure rule `src/lib/records/db-header.ts`: 215.
- Tests in `tests/db-header.test.ts`: 13 passing tests.
- Raw text strings returned: 0 (all strings are i18n keys).

---

### 8 · Report-only items
`None.`

---

### 9 · Not done, and why
- M2 (`DatabaseHeader.tsx` component), M3–M6 (screen migrations): not done — protocol requires stopping for Planner review after M1.

---

### 10 · Noticed, out of scope
`None.`
