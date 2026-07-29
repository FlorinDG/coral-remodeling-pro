# CORAL — PROACTIVE REGRESSION SWEEP (Planner, 2026-07-29)

**Purpose:** hunt the bug *classes* already proven endemic here, rather than meeting them one at a time in production. Each pattern below has already cost real time this week. Findings are ranked by user impact, with exact locations.

**Method:** static sweep of `src/` for seven patterns. Verified by reading the code at each hit — no speculative entries.

---

## 🟥 1. FIFTH OCCURRENCE OF THE IDENTITY BUG — project shift lists show raw ids
**`app/actions/timesheets.ts:141`**
```js
const empMap = new Map(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));   // keyed by Employee.id
…
employeeName: empMap.get(s.userId) || s.userId                                        // :145 — looked up by User.id
```
`ScheduledShift.userId` holds a **User.id** (post-backfill), the map is keyed by **Employee.id** ⇒ every lookup misses ⇒ falls through to `|| s.userId` and renders a **raw cuid** where a name should be.
**Reached by:** `getProjectScheduledShifts` → `PageModal.tsx:35` → **project detail shift list**.
**FIX:** key by `e.userId` (as `leave/page.tsx:31`, `timesheet-export:101` and `[entity]/route.ts:312` already correctly do), or better — use the shared `resolveWorkerUserId` helper. **This is the 5th instance; the helper exists precisely to stop a 6th.**

## 🟥 2. THREE MORE INVISIBLE BRAND CLASSES — same file as the invisible button
**`components/admin/database/GlobalDatabaseSyncer.tsx:255`** — `border-brand-500`, `bg-brand-900`, `bg-brand-50`.
There is **no `tailwind.config`** and **no `brand` palette**; these emit nothing. This is the "No conflicting fields found" info box — rendering with no background and no border (the same defect that made `Resolve & Save` invisible at `:270`).
**FIX:** use `var(--brand-color, #d35400)` / existing tokens. **Then grep the whole repo for `*-brand-[0-9]` and kill every one** — the class silently degrades instead of erroring, so it will keep recurring.

## 🟧 3. `.catch(() => [])` STILL LIVE IN TWO HOT PATHS — same shape as the shifts bug
- **`components/time-tracker/hooks/useWorkerSchedules.ts:35`** — `hrList('employees').catch(() => [])`. **Identical to the bug that hid every shift from every workforce user.** A workforce user can't list the roster ⇒ empty array ⇒ whatever this feeds silently empties. **Check what consumes it before assuming it's harmless.**
- **`components/time-tracker/hooks/useTasks.ts:173`** — `hrList('erp-tasks').catch(() => [])` ⇒ ERP tasks vanish with no error.
- *(Acceptable:* `TenantContext.tsx:75` — logo, explicitly non-critical, commented as such.*)*
**FIX:** surface the failure; never let a permissions/network error become "there is no data".

## 🟧 4. SILENT DELETES — 22 `.catch(console.error)`, and the deletes are the dangerous ones
**`components/admin/database/store.ts:584, 605, 1415, 1437`** — `deleteGlobalDatabase` / `deleteGlobalPage` failures are swallowed. The UI removes the row locally; if the server call failed, **the record still exists** — the user believes something is deleted when it isn't. On invoices/quotes that's a compliance problem, not a UI nit.
Also notable: **`store.ts:11`** (`saveGlobalDatabase` — the "column visibility doesn't stick" bug) and **`ClientInvoiceEngine.tsx:621`** (`updateInvoiceContact` — a contact change on an invoice failing silently).
**FIX:** deletes and saves on money records must surface failure and reconcile local state. Audit all 22; the read-only/decorative ones can stay.

## 🟨 5. snake_case LEGACY — 115 remaining in `components/time-tracker/`
Down from 153, so the sweep started but didn't finish. Plus **`ProjectCockpit.tsx:170`**: `shift.date || shift.shift_date` — defensive code papering over the inconsistency rather than fixing it. Prisma returns camelCase; every snake_case read is `undefined`.

## 🟨 6. LEAVE STATUS CASING — two spellings for one value
`ScheduleCalendar.tsx:254`, `ScheduleMatrixView.tsx:533,548`: `status === 'leave' || status === 'Leave'`. Defensive OR-checks hiding an inconsistency at the write side. Normalise on write; drop the fallbacks.

---

## ✅ CLEAN / RETRACTED (checked, no action)
- **Unscoped Prisma reads — RETRACTED.** Initial grep flagged `app/actions/timesheets.ts`; reading it shows proper `auth()` + `tenantId` scoping (`:7-13`, `:112-117`). False positive from a crude 3-line proximity match. **No unscoped reads found.**
- **No parallel `costRate` field** — only `Employee.hourlyCost` exists. The earlier warning against adding a duplicate was heeded.
- **RBAC filters are server-side intersections** (`timesheet-reports:53`, `timesheet-export:60`, `global-databases:76`) — legitimate, not client-side data hiding. The one that *was* hiding data (`employeeMap` in `useScheduledShifts`) is fixed.
- **Typecheck gate is live** — `build` runs `test:compile`, `ignoreBuildErrors: false`, codebase compiles clean.

---

## SUGGESTED ORDER
1. **#1** (raw ids visible in project detail — user-facing, one line)
2. **#2** (invisible UI, one line + repo-wide grep)
3. **#3** (two silent-empty paths, same class as a bug that cost a day)
4. **#4** (silent deletes — highest consequence, largest audit)
5. **#5 / #6** (cleanup, bundle with any work already touching those files)

**Note on #4 and #3:** these are the same root cause as the two worst bugs of the past 48h — *a failure that produces a plausible-looking wrong answer instead of an error*. They're cheap to fix and they're the ones that cost days when they surface, because nothing points at them.
