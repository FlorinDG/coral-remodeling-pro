# BOUNDARY-1 PLAN — The Layers Enforced by the Build

```
Item:            BOUNDARY-1
Queue:           .agents/workflows/CODER-QUEUE.md § 11
Branch:          coder/work
Date:            2026-10-10
Status:          PLAN ONLY (awaiting Planner review before build)
Touch target:    ONLY eslint.config.mjs and tests/
```

---

## 0 · Objective & Hard Fence

Enforce architectural layer boundaries through automated gates (ESLint and node:test suites) with ratchet mechanisms:
- Existing violations are **frozen in a ratchet** (may only shrink, never grow).
- No architectural refactoring or code fixes of existing offenders are done inside this item.
- **Hard fence:** Touch ONLY `eslint.config.mjs` and `tests/`.

---

## 1 · Census & Audit Across All 4 Checks

### Check 1 · Import Direction (`src/lib/kernel/**` and `src/lib/records/**`)
**Rule:**
- `src/lib/kernel/**` imports only `src/lib/kernel/**`.
- `src/lib/records/**` imports only `kernel` + `records` (+ external type-only imports where required).
- Neither imports `components/`, `app/`, or `lib/data/`.

**Census Findings:**
1. `src/lib/kernel/**`:
   - Total files: 12
   - External/cross-layer imports: **0** (100% compliant; all imports are strictly relative inside `src/lib/kernel/`).
2. `src/lib/records/**`:
   - Total files: 34
   - Imports from `components/`: **0**
   - Imports from `app/`: **0**
   - Imports from `lib/data/`: **0**
   - Existing non-kernel / non-record imports:
     - `src/lib/records/db-header.ts:22`: `import { canRunAccountantExport } from '@/lib/roles';`
     - `src/lib/records/document-archive.ts:1`: `import { storage, type StorageProvider } from '@/lib/storage';`
     - `src/lib/records/export-lock.ts:1`: `import type { Prisma } from '@prisma/client';` (external type-only)

**Enforcement Design:**
- In `eslint.config.mjs`:
  - `src/lib/kernel/**`: Restrict all imports outside `src/lib/kernel/**` (specifically patterns `@/components/**`, `@/app/**`, `@/lib/data/**`, `@/lib/records/**`, `@/lib/services/**`, etc.).
  - `src/lib/records/**`: Restrict imports matching `@/components/**`, `@/app/**`, `@/lib/data/**`. Restrict imports outside `src/lib/kernel/**` and `src/lib/records/**`, grandfathering the 2 known utility files (`@/lib/roles`, `@/lib/storage`) and `@prisma/client`.
- Throw proof: Introduce a dummy import `import { X } from '@/components/dummy'` in `src/lib/kernel/shift-time.ts`, run `npm run test:lint`, verify ESLint error, restore.

---

### Check 2 · Server Code Never Imports `components/`
**Rule:**
Server code never imports from `components/`:
- `src/app/**/route.ts` (API routes)
- `src/app/actions/**` (Server actions)
- `src/lib/data/**` (Data layer / accessors)
- Pure helpers must live in `lib/`, not `components/`.

**Census Findings:**
1. `src/app/**/route.ts` (73 files):
   - Imports from `components/`: **0** (clean).
2. `src/app/actions/**` (17 files):
   - **2 files** import types from `components/admin/database/types`:
     - `src/app/actions/global-databases.ts`: `import { Database, Page, Property, DatabaseView, Block, PageIndexEntry } from '@/components/admin/database/types';`
     - `src/app/actions/pages.ts`: `import { Page, PropertyValue } from '@/components/admin/database/types';`
3. `src/lib/data/**` (32 files):
   - **2 files** import types from `components/admin/database/types`:
     - `src/lib/data/timesheet-invoicing.ts`: `import type { Block, Page } from '@/components/admin/database/types';`
     - `src/lib/data/quote-revision.ts`: `import type { Page } from '@/components/admin/database/types';`
4. Server Component `page.tsx` (36 files without `"use client"`):
   - 16 pages render client components or page shells (`Hero`, `ClientInvoiceEngine`, etc.).
   - Pure server routes (`route.ts`), server actions (`app/actions/**`), and server data accessors (`lib/data/**`) should never import UI or helpers from `components/`.

**Ratchet Table (Ceiling = 4):**
| Offending File | Imported Module | Nature |
|---|---|---|
| `src/app/actions/global-databases.ts` | `@/components/admin/database/types` | Type imports |
| `src/app/actions/pages.ts` | `@/components/admin/database/types` | Type imports |
| `src/lib/data/timesheet-invoicing.ts` | `@/components/admin/database/types` | Type imports |
| `src/lib/data/quote-revision.ts` | `@/components/admin/database/types` | Type imports |

**Enforcement Design:**
- New test `tests/boundary-server-components.test.ts`:
  - Scans `src/app/**/route.ts`, `src/app/actions/**`, and `src/lib/data/**`.
  - Asserts no file outside the 4 grandfathered files imports from `components/`.
  - Asserts grandfathered list never exceeds CEILING = 4.
  - Stale entry check: if one of the 4 files removes its `components/` import, test prompts lowering the ceiling.
- Throw proof: Add `import '@/components/admin/database/types'` to `src/app/actions/crm.ts`, run test, verify assertion failure, restore.

---

### Check 3 · Route Files Export Only HTTP Handlers
**Rule:**
Route files export only HTTP handler functions or Next.js route segment configs:
`src/app/**/route.ts(x)` exports $\subseteq$ `{GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, runtime, dynamic, revalidate, maxDuration, fetchCache, preferredRegion}`.

**Census Findings:**
- Total route files audited: **73**
- Distinct exported identifiers across all 73 routes:
  `['DELETE', 'GET', 'PATCH', 'POST', 'PUT', 'dynamic', 'maxDuration', 'runtime']`
- Disallowed exports: **0**
- Offending files: **0**

**Enforcement Design:**
- New test `tests/boundary-route-exports.test.ts`:
  - Discovers all `src/app/**/route.ts` and `src/app/**/route.tsx`.
  - Uses regex/AST parsing to extract all exported symbol names (`export async function X`, `export const X`, `export { X }`).
  - Asserts all exported symbols belong to the canonical Next.js allowed set:
    `const ALLOWED = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'runtime', 'dynamic', 'revalidate', 'maxDuration', 'fetchCache', 'preferredRegion']);`
  - Zero tolerance: any unlisted export immediately fails the build.
- Throw proof: Add `export const testHelper = () => {};` in `src/app/api/bookings/route.ts`, run test, verify test fails reporting `testHelper`, restore.

---

### Check 4 · Role Comparisons Only in `lib/`
**Rule:**
Occurrences of `role === '` / `role !== '` / `logicalKey === '` in `src/components/**` and `src/app/**` are frozen per file in a ratchet. Any new occurrence or any file exceeding its count fails with `"name the rule in lib/"`.

**Census Findings:**
Total matches across `src/components/**` and `src/app/**`: **59** matches in **23** files.

**Ratchet Census Table:**
| # | File Path | Frozen Count | Description / Context |
|---|---|---|---|
| 1 | `src/app/[locale]/accept-invite/page.tsx` | 1 | Worker role check on invite accept |
| 2 | `src/app/[locale]/admin/settings/databases/[id]/page.tsx` | 1 | System database role check |
| 3 | `src/app/[locale]/admin/settings/team/page.tsx` | 12 | User team role checks (SUPERADMIN, ADMIN, WORKER) |
| 4 | `src/app/[locale]/superadmin/TenantsGrid.tsx` | 1 | User role check in tenant management |
| 5 | `src/app/actions/database-definition.ts` | 1 | Database role check |
| 6 | `src/app/actions/global-databases.ts` | 6 | System database role mappings |
| 7 | `src/app/actions/pages.ts` | 4 | System database role operations |
| 8 | `src/app/api/hr/[entity]/route.ts` | 1 | Entity role routing |
| 9 | `src/app/api/portals/tasks/route.ts` | 1 | Task portal role check |
| 10 | `src/app/api/scan/route.ts` | 3 | Scan expense/quote role checks |
| 11 | `src/app/api/tenant/users/route.ts` | 2 | User role assignment |
| 12 | `src/components/admin/ModuleTabs.tsx` | 1 | Tab role condition |
| 13 | `src/components/admin/database/DatabaseClone.tsx` | 3 | System database role checks |
| 14 | `src/components/admin/database/components/DatabaseFooter.tsx` | 1 | System database role check |
| 15 | `src/components/admin/database/components/PageFinancialAnalysis.tsx` | 1 | Database role check |
| 16 | `src/components/admin/database/components/PageModal.tsx` | 3 | System database role checks |
| 17 | `src/components/admin/database/components/ProjectDetailView.tsx` | 2 | Database role checks |
| 18 | `src/components/admin/database/components/RecordDetailPage.tsx` | 8 | System database role view adjustments |
| 19 | `src/components/admin/expenses/PurchaseInvoiceEngine.tsx` | 2 | Expense vs quote role checks |
| 20 | `src/components/admin/expenses/PurchaseLineSearch.tsx` | 1 | Line search role check |
| 21 | `src/components/admin/invoices/SaveToLibraryModal.tsx` | 1 | Database role check |
| 22 | `src/components/admin/quotations/SaveToLibraryModal.tsx` | 1 | Database role check |
| 23 | `src/components/time-tracker/hooks/useUserRoles.ts` | 2 | User role evaluations |
| **TOTAL** | **23 files** | **59 matches** | **Total frozen ceiling** |

**Enforcement Design:**
- New test `tests/boundary-role-comparisons.test.ts`:
  - Scans all `.ts` and `.tsx` files in `src/components/**` and `src/app/**`.
  - Matches regex: `/\b(?:role|logicalKey)\s*(?:===|!==)\s*['"`]/g`.
  - Compares counts against the `ROLE_RATCHET` dictionary.
  - Fails if:
    1. An unlisted file contains any match: `"name the rule in lib/ — new file with direct role comparison: <file>"`.
    2. A listed file has more matches than its frozen ceiling: `"name the rule in lib/ — <file> increased role comparisons from <ceiling> to <count>"`.
    3. Stale entries are flagged when counts decrease to prompt lowering the ratchet ceiling.
- Throw proof: Add `const isManager = role === 'manager';` to `src/components/admin/expenses/TicketCaptureModal.tsx`, run test, verify test fails with `"name the rule in lib/"`, restore.

---

## 2 · Implementation Sequence (4 Commits)

Following CODER-QUEUE.md § 11 ("Four checks, each failing the build, each with a throw proof, each its own commit"):

1. **Commit 1 (`check-1`)**:
   - Update `eslint.config.mjs` with import direction boundaries for `src/lib/kernel/**` and `src/lib/records/**`.
   - Throw proof: Dummy import in `src/lib/kernel/shift-time.ts`.
2. **Commit 2 (`check-2`)**:
   - Create `tests/boundary-server-components.test.ts` (ratchet for `src/app/**/route.ts`, `src/app/actions/**`, `src/lib/data/**` importing `components/`).
   - Throw proof: Dummy import in `src/app/actions/crm.ts`.
3. **Commit 3 (`check-3`)**:
   - Create `tests/boundary-route-exports.test.ts` (HTTP handler exports guard for `src/app/**/route.ts(x)`).
   - Throw proof: Dummy export in `src/app/api/bookings/route.ts`.
4. **Commit 4 (`check-4`)**:
   - Create `tests/boundary-role-comparisons.test.ts` (ratchet table for `role === '` / `role !== '` / `logicalKey === '` in `components/` and `app/`).
   - Throw proof: Dummy role check in `src/components/admin/expenses/TicketCaptureModal.tsx`.
5. **Report & Stop**:
   - Write `.agents/reports/BOUNDARY-1.md`.
   - Stop and await Planner review.

---

## 3 · Verification Plan
- `npm run test:compile`: Exit 0, 0 TS errors.
- `npm run test:lint`: Exit 0, 0 ESLint errors.
- `node --test tests/boundary-*.test.ts`: All boundary test suites pass.
- Full suite green: `npm run validate`.
