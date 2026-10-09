# DB-HEADER-1 · M4 Report

### 0 · Header
```
Item:            DB-HEADER-1 (Milestone 4)
Directive:       .agents/workflows/coder-directive-db-header-1.md + .agents/plans/DB-HEADER-1.md § PLANNER REVIEW — M3
Start SHA:       b9667f02c5faf3187efb043fd62c4276d385c9d2
End SHA:         e7b739df900b4625b5971ea47b30c5f2b575791c
Branch:          develop
Date:            2026-10-09
```

### 1 · Outcome
DONE

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `e7b739df` | feat(db-header): M4 - C11 action states, validationScreen, CRM and Projects migration | 7 | +188/−103 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| C11 | Action state (`busy`, `disabled`, `disabledReasonKey`): pure rule merges page-owned `actionStates`; DatabaseHeader renders spinning icon when busy, disabled button, and tooltip from i18n reason key | ✅ | `src/lib/records/db-header.ts:41-56,158-170`, `src/components/admin/database/components/DatabaseHeader.tsx:208-218,428-444` |
| VALIDATE-1 | Replace `EXPENSES_INBOX_VIEW` with `validationScreen?: 'validated' \| 'to-validate' \| null` in pure rule and header context | ✅ | `src/lib/records/db-header.ts:89-92,189-191`, `tests/db-header.test.ts:256-296` |
| CRM Migration | Replace hardcoded English pipeline tabs with canonical screen tabs from store (`crmDb?.name`, `bobexDb?.name`); enable view tabs (remove `hideViewTabs`) | ✅ | `src/app/[locale]/admin/crm/page.tsx:24-63` |
| Projects Migration | Fold outer `TYPE_TABS` into canonical header's `screenTabs` slot (options from `prop-project-type` select in projects schema, plus "All") | ✅ | `src/app/[locale]/admin/projects-management/page.tsx:26-60` |
| Expenses Invoices | Pass action state for `peppol-sync` (busy when syncing, disabled when syncing or Peppol not configured with reason tooltip) | ✅ | `src/app/[locale]/admin/financials/expenses/invoices/page.tsx:203-210` |
| Tests & Throw Proofs | `tests/db-header.test.ts` updated for `validationScreen` and C11 `actionStates`; throw proof captures deliberate failures when conditions break | ✅ | §6 Verification & Throw Proof |

### 4 · Files vs blast radius
```
 src/app/[locale]/admin/crm/page.tsx                              | 47 +++++++-------
 src/app/[locale]/admin/financials/expenses/invoices/page.tsx      |  7 ++
 src/app/[locale]/admin/projects-management/page.tsx              | 65 ++++++++-----------
 src/components/admin/database/DatabaseClone.tsx                  | 12 +++-
 src/components/admin/database/components/DatabaseHeader.tsx     | 41 ++++++++----
 src/lib/records/db-header.ts                                     | 44 +++++++++----
 tests/db-header.test.ts                                          | 75 ++++++++++++++++++----
 7 files changed, 188 insertions(+), 103 deletions(-)
```

| File | In blast radius? |
|---|---|
| `src/lib/records/db-header.ts` | Yes |
| `tests/db-header.test.ts` | Yes |
| `src/components/admin/database/components/DatabaseHeader.tsx` | Yes |
| `src/components/admin/database/DatabaseClone.tsx` | Yes |
| `src/app/[locale]/admin/financials/expenses/invoices/page.tsx` | Yes |
| `src/app/[locale]/admin/crm/page.tsx` | Yes |
| `src/app/[locale]/admin/projects-management/page.tsx` | Yes |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/components/admin/database/components/DatabaseHeader.tsx:222` | Two-level header activation when page doesn't handle declared actions | 1. `actions.length > 0` alone. 2. `Boolean(onAction && actions.length > 0)`. | Option 2: Check `onAction && actions.length > 0` | On screens like "Te valideren" where actions are declared but no `onAction` handler is passed, buttons are not rendered; keeping the top bar would produce an empty top row without tabs. |
| `src/components/admin/database/DatabaseClone.tsx:370` | Passing selected row count to header | 1. Leave undefined (defaults to 0). 2. Pass `selectedRowIds.size`. | Option 2: `selectedRowCount={selectedRowIds.size}` | The header needs row selection count to activate bulk actions (e.g. bulk approve in "to-validate" screen). |
| `src/app/[locale]/admin/projects-management/page.tsx:29` | Fallback options for project types if store database is initializing | 1. Empty array. 2. Default schema options from `system-schemas.ts`. | Option 2: Provide default project types matching schema. | Prevents flickering or missing tabs during initial database hydration. |

### 6 · Verification — commands, not descriptions

### VERIFY: npm run test:compile
```
$ npm run test:compile; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY: tests/db-header.test.ts
```
$ node --import ./tests/register.mjs --test tests/db-header.test.ts; echo "exit: $?"
✔ computeDatabaseHeader: formats title and row counts correctly (0.6385ms)
✔ computeDatabaseHeader: CRM and Bobex always show view tabs (Q1) and carry screen tabs from data (C3) (0.193167ms)
✔ computeDatabaseHeader: Projects carries project type tabs from data (C3) (0.0685ms)
✔ computeDatabaseHeader: tickets declares exactly scan and bulk — no manual entry (Florin 2026-10-07) — with valid i18n keys (0.163708ms)
✔ computeDatabaseHeader: purchase invoices declares scan and peppol-sync — no manual entry — with valid i18n keys (0.098625ms)
✔ computeDatabaseHeader: other screens have no declared actions (C4 parity constraint) (0.103334ms)
✔ computeDatabaseHeader: accountant export visible ONLY for authorized sources and roles (C1) (0.096708ms)
✔ computeDatabaseHeader: import blocked for locked schema or lack of create access (R2) (0.067625ms)
✔ computeDatabaseHeader: bulk approve only enabled for to-validate screen with selected rows (VALIDATE-1) (0.081458ms)
✔ computeDatabaseHeader: delete shows draftOnlyDelete messageKey for invoices and expenses (R2, R4) (0.115ms)
✔ computeDatabaseHeader: wrap text is only shown on table views (R6) (0.062542ms)
✔ computeDatabaseHeader: schema pill returns null if databaseId is missing (R5) (0.050875ms)
✔ computeDatabaseHeader: schema pill returns proper i18n labelKey and gating (C2, R4, R5) (0.102459ms)
✔ THROW PROOF: accountant export cannot leak to unauthorized roles or sources (0.098791ms)
✔ THROW PROOF: every returned i18n key resolves to a valid string across all locales (nl, en, fr, ro) (R4) (0.14275ms)
✔ PROFORMA-2: the proformas screen declares "Nieuwe proforma" — the one way a proforma is made; other invoice screens do not (0.30825ms)
✔ a purchase document comes WITH its document: no CSV import on purchase invoices / tickets; other databases keep it (throw proof) (0.048375ms)
✔ LINE-SEARCH-1 / QUOTE-IN-1: supplier quotes — scan and the line search, no CSV import (0.058625ms)
✔ computeDatabaseHeader: actionStates overrides busy, disabled and disabledReasonKey (C11) (0.092125ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 150.013459
exit: 0
```

### THROW PROOF 1 — VALIDATE-1 showBulkApprove mutation
Breaking `showBulkApprove = false;` in `src/lib/records/db-header.ts`:
```
✖ computeDatabaseHeader: bulk approve only enabled for to-validate screen with selected rows (VALIDATE-1) (1.0145ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  false !== true
  
      at TestContext.<anonymous> (file:///Users/florin/Documents/GitHub/coral-remodeling-pro/tests/db-header.test.ts:265:12)
```

### THROW PROOF 2 — C11 actionStates mutation
Breaking `actions = baseActions;` without merging `ctx.actionStates`:
```
✖ computeDatabaseHeader: actionStates overrides busy, disabled and disabledReasonKey (C11) (0.499917ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + undefined
  - true
  
      at TestContext.<anonymous> (file:///Users/florin/Documents/GitHub/coral-remodeling-pro/tests/db-header.test.ts:526:12)
```
