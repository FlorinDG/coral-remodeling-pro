# CORAL — TIMESHEETS PAGE UPGRADE (one page, all jobs) — Planner spec 2026-07-27

**Florin:** *"I do want all crystallised in one working page. All the reporting functions and all the filtering and approval flow can be added in the timesheets page without uselessly creating others."*

**Route:** `admin/hr/timesheets` — the single surface for reviewing, filtering, reporting on, approving and exporting worked hours.

---

## 🔑 THE KEY INSIGHT — this is mostly WIRING, not building
`timesheets/page.tsx:43` fetches **`hrList('clock-entries')`** — a raw, unfiltered, un-aggregated list. Meanwhile **`/api/hr/timesheet-reports` already exists and does everything this page needs**, and nothing calls it from here.

**Already built — DO NOT REBUILD:**
| Endpoint | Provides |
|---|---|
| `api/hr/timesheet-reports` | filters `from`, `to`, `workerIds[]`, `projectIds[]`, `approvalStatus`, `billable`, `source` → `entries[]` + `rollups{byWorker, byProject, byWorkerProject, byDay}` + `summary{totalHours, billableHours, internalHours, approvedHours, pendingHours, openEntries}` |
| `api/hr/timesheet-export` | working **XLSX** via SheetJS (`?format=xlsx`); CSV/PDF not yet implemented |
| `api/hr/timesheet-rates` | cost-rate restamp scopes (TS-8) |
| `hrUpdate('clock-entries', …)` | approve / deny (already used at `page.tsx:62`) |

**Step 1 is repointing the data source.** That single change delivers filtering, rollups and the summary at once.

**Why one page (not three):** the approvals queue, the report and the history are **the same table in different filter/grouping states** — *queue* = `approvalStatus=pending` sorted oldest-first; *report* = grouped with totals; *history* = `approvalStatus=approved|denied` with approver columns. One table, one data source, three jobs.

---

## CURRENT STATE (verified)
- `timesheets/page.tsx` — 212 lines. Fetches **all** entries, no filters, no date window, no pagination, no rollups. Approve/deny works. `ManualEntryModal` wired. Columns: Datum · Medewerker · Duur · Omschrijving · Status · Media · Acties.
- Siblings to remove **at the end**: `timesheets/reports/`, `timesheets/approvals/`. Keep `timesheets/[id]/` (the werkbon detail).
- `config/tabs.ts:5-6` — `REPORTS` and `APPROVALS` entries to delete from `hrTabs`.

---

## TARGET LAYOUT — REVISED FOR DENSITY (Florin, 2026-07-27: *"move the 4 statistics cards into the space between title and buttons · move all filters into the wide card · gain some space for the table"*)
**Problem with the first render:** four stacked full-width bands (header → filter card → chips+grouping row → StatCards row) consume the top half of the screen before a single entry appears. The table — the actual content — is pushed below the fold.

**Two bands only, then the table:**

1. **HEADER BAND — title (left) · stats (centre) · actions (right), all on one row.**
   - Left: `Timesheets / Work Orders` + subtitle.
   - **Centre: the 4 stats, inline** — `Total hours` · `Billable / Internal` · `Approved / To review` · `Unattributed`. ⚠️ **They must be re-styled as compact inline stats, not the current bordered cards** — four full cards will not fit beside a title. Use a small uppercase label above a bold value, separated by thin dividers, no borders/boxes. Keep the existing colour semantics (green approved, orange to-review, red unattributed).
   - Right: `Export` · `Add manually`.
   - On narrow viewports the stats wrap to their own row — never squeeze the title.
2. **ONE FILTER CARD — everything that narrows the view lives here.** Currently the chips and grouping toggle sit on a separate row; fold them in:
   - Row A: **Period** (presets + **custom range via `CustomDatePicker`**, TSP-B3) · **Worker** · **Project** · **Billable** · **Source**.
   - Row B (same card): **status chips** `All · To review` *(count badge)* `· Approved` on the left, **grouping toggle** `Flat · By worker · By project` right-aligned.
   - Rationale: one card = "what am I looking at", everything below it = the answer.
3. **TABLE — gets all remaining vertical space.** Should begin within the first screenful. Sticky header on scroll; the page scrolls, not an inner container.

**Content unchanged from the original spec** — this is purely spatial. Stats, chips, grouping, filters and the table columns all keep the behaviour specced below; only their placement changes. **No overtime metric** (decided).
6. **Table:** Datum · Medewerker · Duur · Project (or **`Niet toegewezen`**) · Factureerbaar · Omschrijving · Status · Bron · Media · Acties. In approved/denied views also **Goedgekeurd door** + **Goedgekeurd op**.
7. **Row actions:** approve / deny inline on pending rows; row click → `timesheets/[id]` werkbon detail.
8. **Bulk:** multi-select → bulk approve/deny, with an explicit confirmation stating the effect (*"Approve 14 entries, 62.5 h"*). Never a silent bulk write.

---

## 🟥 BLOCKERS FOUND ON FIRST RENDER (2026-07-27)
- [ ] **TSP-B1 · NO ADMIN BYPASS IN `timesheet-reports` — owner sees only their OWN hours** 🟥🟥 (this is why the table looks empty / shows only a few rows). `timesheet-reports/route.ts:36,60` applies `where.userId = { in: getAccessibleUserIds(...) }` **unconditionally**, and `getAccessibleUserIds` returns **only the caller's own id** unless they lead an `HrTeam`. So a TENANT_OWNER is scoped like a workforce user. The older `api/hr/[entity]/route.ts:111-116` has the correct bypass — **mirror it**: `isAdminRole` ⇒ all tenant users; team lead ⇒ their team; workforce ⇒ self only. **Also audit `timesheet-export`** for the same omission — an export silently containing only your own hours is worse than an empty one, because it looks complete.
- [ ] **TSP-B2 · i18n KEYS NEVER ADDED** 🟥 — the page calls `useTranslations('Hr.timesheets')` (`page.tsx:40`) but the `Hr.timesheets.*` keys don't exist in `messages/{en,nl,fr}.json`, so next-intl renders the key paths (`Hr.timesheets.title`, `HR.TIMESHEETS.TOTALHOURS`). Same class as `TASKS-I18N-NAMES`. Add the full block in all three languages using the **confirmed NL labels** below. **Also:** "Period", "All Workers", "All Projects", "Flat", "By Worker" are currently **hardcoded English** — half-translated is worse than either; route everything through i18n.
- [ ] **TSP-B3 · DATE-RANGE PICKER (Florin request)** 🟧 — the Period control must include a **custom date-range picker**, not just presets. **Reuse the existing `src/components/ui/CustomDatePicker.tsx`** — do not introduce another calendar component or a third date-picking pattern. Selecting a range sets `from`/`to` in the URL params that already drive the API.
- [ ] **TSP-B4 · SMARTER DEFAULT + HONEST EMPTY STATE** 🟨 — default to **this month** (or last 30 days), not this week: on a Monday the week-to-date view is near-empty and reads as breakage. And distinguish the **three** empty cases: *request failed* · *no entries at all* · **_no entries in this period, but N exist outside it_** — the last one with a one-click widen. (Third variant not previously specced; it's what made today's first render ambiguous.)

## BUILD STEPS (in order, each independently shippable)

- [ ] **TSP-1 · REPOINT THE DATA SOURCE** 🟥 — replace `hrList('clock-entries')` with `GET /api/hr/timesheet-reports`, passing the filter state as query params. Keep the existing approve/deny path (`hrUpdate`). **Default period = this week** — never fetch all history by default (today it does). Render `summary` into StatCards and `entries` into the existing table before touching layout, so this step is verifiable on its own.
- [ ] **TSP-2 · FILTER BAR** 🟧 — presets + custom range + worker/project/billable/source. Filter state lives in **URL query params** so a filtered view is shareable, survives refresh, and back/forward works. Debounce refetch.
- [ ] **TSP-3 · STATCARDS + QUICK CHIPS** 🟧 — cards from `summary`; chips set `approvalStatus`. The **pending count badge** also appears on the `TIMESHEETS` entry in `hrTabs` — this is the forcing function that stops approvals being silently forgotten (`pd.md`).
- [ ] **TSP-4 · GROUPING + SUBTOTALS** 🟧 — toggle flat / by worker / by project using `rollups.byWorker` / `rollups.byProject`; expandable groups; grand total row. This is the "reports page" capability, delivered as a view state.
- [ ] **TSP-5 · APPROVAL FLOW COMPLETE** 🟥 — inline approve/deny + multi-select bulk with confirmation; **reason-for-approval flags** visible per row (`late` · `manual` · `off-geofence` · `missing clock-out`) — a queue without *why* is just a list; **approver + timestamp** columns in the approved/denied views; approvals **reversible** with a trail. Approved and pending hours stay **separated in every total** so unapproved time can't be exported as payroll.
- [ ] **TSP-6 · EXPORT WIRED (no dummy buttons)** 🟧 — Export dropdown calls `/api/hr/timesheet-export` **with the current filter + grouping**. XLSX already works — wire it. Add **CSV** (papaparse, installed) and **PDF werkbon/prestatiestaat** (`@react-pdf/renderer`, the established pattern — see `InvoicePDFTemplate`). The exported file **states the active filter set in its header** so a printed sheet is self-describing. A button that does nothing is the "didn't make it into the UI properly" complaint repeating — either wire it or don't render it.
- [ ] **TSP-7 · DELETE THE OLD PAGES — LAST** 🟨 — only once TSP-1…6 demonstrably cover their function: remove `timesheets/reports/`, `timesheets/approvals/`, and their two `hrTabs` entries (`config/tabs.ts:5-6`). **Keep the three APIs** — they are page-agnostic and are what this page runs on. Never delete before the replacement works.

---

## STATES & EDGE CASES (the ones that made pages look broken before)
- **Open entries** (`clockOutTime IS NULL`) — show explicitly as *"Loopt nog"*, never counted as 0 hours and never silently dropped.
- **Unattributed hours** (no `projectId`, no shift) — their own visible bucket + StatCard; never folded into billable totals. Offer bulk-assign to a project (TS-3).
- **Orphan rows** — 6 known entries whose `userId` matches neither a User nor an Employee. They must **appear** (e.g. worker "Onbekend") rather than vanish, or totals will silently disagree with the database.
- **Empty vs error** — distinguish *"no entries match these filters"* from *"the request failed"*. The old page showed a friendly empty state while the API was 500-ing, which is exactly how a crash masqueraded as "no data".
- **Loading** — skeletons, not a blank table.

## TENANT + RBAC
- Tenant from session only. `timesheet-reports` already applies `getAccessibleUserIds`; keep it — owner/admin see all, team lead sees their team, workforce sees only their own. Enforced **server-side**; never by hiding UI.
- **Cost rates are owner/admin-only** — a foreman must not see colleagues' rates in any column or export.
- Exports inherit the caller's RBAC scope: a lead's "export all" silently means *their team*.

## ACCEPTANCE
1. Page opens on **this week**, not all history; entries, StatCards and totals agree with the database.
2. Change worker/project/period → table, rollups, StatCards and the export **all** reflect it; the URL updates and survives refresh.
3. `Te beoordelen` chip shows the true pending count; approving decrements it; the badge appears in the HR tab bar.
4. Approve one, deny another → both appear in the approved/denied view with approver + timestamp; approved counts toward exportable hours, denied does not.
5. Group by project → subtotals + `Niet toegewezen` bucket; grand total matches the flat view exactly.
6. Export XLSX/CSV/PDF → contents match the on-screen filtered set; the header states the filters.
7. Delete the two old routes → no dead links, no 404s from the tab bar, nothing lost.

## ✅ NL LABELS — CONFIRMED BY FLORIN (2026-07-27). Use exactly these; do not invent variants.
| Meaning | NL label |
|---|---|
| Awaiting approval | **`Te beoordelen`** |
| Approved | **`Goedgekeurd`** |
| Denied | **`Geweigerd`** |
| Still clocked in (no clock-out) | **`Loopt nog`** |
| No project attributed | **`Niet toegewezen`** |
| Billable / internal | **`Factureerbaar`** / **`Intern`** |
| Source values | **`Geklokt`** · **`Handmatig`** · **`Aangepast`** |

**`Te beoordelen`, NOT `In Behandeling`** — the latter implies someone is already working on it, which is exactly the wrong signal for a queue nobody has touched yet.
All strings go in `messages/{nl,fr,en}.json` — **never hardcoded in the component**. FR/EN equivalents follow the same principle: state what the entry *is*, not what someone is doing about it.

> **Icon:** a **neutral pending indicator** (clock / hourglass), **not** a ⚠ warning triangle. Awaiting approval is the *normal* state of a fresh entry; a warning glyph says something is broken — the same mistake as the pulsing red clock button.
