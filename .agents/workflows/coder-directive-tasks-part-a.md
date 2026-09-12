# CORAL — CODER DIRECTIVE — TASKS PART A · MY TASKS ON THE PHONE — Planner 2026-09-12

Paste-ready. Binding. Spec: `coral-task-manager.md` · protocol: `pd.md` · model rules: `coder-profile.md`.

**Goal:** Florin can capture and check his own tasks on his phone, in the mobile PWA he already has installed.

**SCOPE FENCE — Florin, 2026-09-12: *"we don't touch desktop, it's the easier to work around for now."***
**No changes to `/admin/tasks` or any file under `src/components/admin/tasks/` except where this directive names one explicitly.** The desktop module's logic is reused as-is. Part B (project lens) and Part C (desktop redesign) are **out of scope**.

---

## 📎 PASTED FACTS

```ts
// src/components/admin/database/store.ts — the mutators to use (do not build a new write path)
createPage: (databaseId: string, initialProperties?: Record<string, PropertyValue>,
             customId?: string, initialBlocks?: Block[]) => Page;               // :196
updatePageProperty: (databaseId: string, pageId: string,
                     propertyId: string, value: PropertyValue) => void;         // :202
deletePage: (databaseId: string, pageId: string) => void;                       // :204

// src/context/TenantContext.tsx — resolve the database id; NEVER pass the bare 'db-tasks'
const { resolveDbId } = useTenant();
resolveDbId('db-tasks')
```

**Mobile shell — copy this page's shape, it is the house pattern:**
`src/app/[locale]/m/expenses/page.tsx` — `"use client"`, `useTenant()`, `useDatabaseStore`, `useTranslations`, heavy children via `next/dynamic` with `{ ssr: false }`.

**Nav lives in `src/components/mobile/MobileShell.tsx:43-47`** — five entries (`/m`, `/m/invoices`, `/m/expenses`, `/m/clients`, `/m/quotes`), labels from `t('nav_*')`, active state by `pathname.startsWith(href)` (`:121-123`).

**🔴 STATUS VALUES — PLANNER CORRECTION, 2026-09-12.** An earlier draft of this directive said to write `'t-todo'` / read `'t-done'`. **That was wrong.** Two disjoint sets exist:

| Source | Values |
|---|---|
| `DatabaseClone.tsx` schema declaration | `t-todo` · `t-prog` · `t-done` — **3 states** |
| The whole task module (40 usages) | `opt-todo` · `opt-doing` · `opt-review` · `opt-done` · `opt-dropped` — **5 states** |

**The module's `opt-*` set is canonical** — it is what the stored data actually contains, and changing a declaration is free whereas changing stored values needs a migration. So:
- Part A **reads and writes `opt-todo` / `opt-done`**, never `t-*`.
- **F1's schema declaration must also correct the `prop-task-status` options to the five `opt-*` values.** Today the grid's select options do not match a single stored value.
- ⚠️ **GATE — read-only count first.** Before touching the declaration, count `db-tasks` pages whose `prop-task-status` starts with `t-` versus `opt-`. **If any `t-*` values exist, report and STOP** — two conventions in live data is `PROJ-2` work (parked), not Part A work.
- *(This is `PROJ-2 TASK-STATUS-CONSISTENCY` — recorded as "resolved, canonical = `t-*`" in `ground-zero-triage.md`, but the code went the other way and the data followed the code. The triage note is stale; this directive supersedes it **for `db-tasks` only**.)*
- **`PROJ-2` itself is PARKED (Florin, 2026-09-12)** — the wider audit of every status consumer, project task statuses and any legacy values waits for the larger project work. **Only the `db-tasks` carve-out above is in scope here.** See `coral-task-dependencies.md`.

**`db-tasks` property ids as used by the existing module** (`components/admin/tasks/`):
`title` · `prop-task-status` (select: `opt-todo` / `opt-doing` / `opt-review` / `opt-done` / `opt-dropped`) · `prop-task-project` (relation) · `prop-task-type` · `prop-task-due` · `prop-task-defer` · `prop-task-flagged` · `prop-task-my-day` · `prop-task-priority` · `prop-task-notes` · `prop-task-completed-at` · `prop-task-tags` · `prop-task-recurrence` · `prop-task-depends-on` · `prop-task-estimated` · `prop-task-assignee` · `prop-task-reviewed-at` · `prop-task-section` · `prop-task-attachments`

---

## 🔴 TWO FINDINGS THAT CHANGE THE WORK

### F1 — 15 of those 18 properties are **written but never declared**
`DatabaseClone.tsx` declares only **`title`, `prop-task-project`, `prop-task-status`, `prop-task-type`** for `db-tasks`. The other **fifteen** — including `prop-task-due`, `prop-task-flagged`, `prop-task-my-day`, `prop-task-priority` — are written into the properties JSON by the task module and **declared nowhere**.

They persist (the column is freeform JSON), but nothing protects them: they are invisible to the schema, to filters, sorts and exports, and to any default-seeding or schema-enforcement effect that walks the declared property list. **A due date that no part of the system admits exists is not a trustworthy due date.**

**Required, and it is small:** declare the properties Part A actually uses — `prop-task-due`, `prop-task-defer`, `prop-task-flagged`, `prop-task-my-day`, `prop-task-priority`, `prop-task-notes`, `prop-task-completed-at` — in the `db-tasks` schema beside the existing four, with correct types (`date`, `date`, `checkbox`, `checkbox`, `select`, `text`, `date`). **Additive only. No migration** — this is the `views`/`properties` JSON on `GlobalDatabase`, not a Postgres schema change. Leave the other eight undeclared for now and note them here; declaring what Part A does not use is scope creep.

### F2 — the service worker does not cache anything, by design
`public/sw.js` is **27 lines** and ends with:
```js
// Pass all fetch requests through to the network — no caching.
self.addEventListener('fetch', (event) => { event.respondWith(fetch(event.request)); });
```
So **the app cannot cold-start offline.** Offline capability today comes entirely from the store's IndexedDB persistence plus `syncQueue`.

**Therefore, scope offline honestly in this batch:**
- **IN SCOPE — warm offline:** app already open, signal drops, Florin captures. The capture is held by the store's queue and syncs on reconnect. This works with what exists.
- **OUT OF SCOPE — cold offline:** opening the installed app with no network. That needs a real caching service worker and is its own item (`TASK-M3b`), not a line in this one.
- **Do not** claim offline support the app does not have. The UI states the true state: pending vs synced.

---

## THE WORK — eight commits

### 1 · `TASK-M1` · the page 🟥
- [ ] New `src/app/[locale]/m/tasks/page.tsx`, modelled on `m/expenses/page.tsx`.
- [ ] Reads via `useDatabaseStore` with **`resolveDbId('db-tasks')`** — never the bare id.
- [ ] **Scope to Florin's own tasks:** those with **no** `prop-task-project` relation. (Project-linked tasks are Part B and are not shown here.)
- [ ] Exclude completed/dropped from the default list: `prop-task-status` **not in** `['opt-done', 'opt-dropped']`.
- [ ] **Do not import the desktop `TaskModuleShell`, `TaskListView`, `TaskBoardView` or `TaskSidebar`.** They are desktop surfaces. Pure logic (`RecurrenceEngine.ts`) may be imported.

### 2 · `TASK-M4` + `TASK-M5` · today, and one-thumb complete 🟥
- [ ] **Landing view is TODAY**, not everything: `prop-task-due` ≤ today · OR `prop-task-my-day === true` · OR `prop-task-flagged === true`. Overdue sorts first.
- [ ] A second tab/segment shows **All open**. Today is what opens.
- [ ] **Complete from the list in one tap** — tick sets `prop-task-status = 'opt-done'` and `prop-task-completed-at = now`. Row stays visible, struck through, for a few seconds with **Undo**; then it leaves the list. **No confirmation dialog.**
- [ ] Touch targets ≥ 44px. Nothing requiring a second hand or a long press to reach a primary action.

### 3 · `TASK-M2` + `TASK-M3` · capture 🟥 — **the item this whole batch exists for**
- [ ] **A persistent capture control on the tasks page** — always visible, thumb-reachable (bottom-right, above the nav bar).
- [ ] Tapping it focuses a text field immediately. **Title alone is a complete task.** Enter/Done saves and **stays ready for the next one** — consecutive captures without reopening anything.
- [ ] No modal stack, no required fields, no project picker, no date picker in the capture path. Everything else is set later.
- [ ] Writes with `createPage(resolveDbId('db-tasks'), { title, 'prop-task-status': 'opt-todo', 'prop-task-my-day': true })`.
- [ ] **Warm-offline:** a capture made after signal loss is queued by the store and appears in the list immediately, marked **pending**. On reconnect it syncs and the mark clears. **Never** a silent failure, never a lost capture.
- [ ] **Acceptance is a stopwatch, not an opinion:** from the installed app closed → task captured in **≤ 2 taps and ≤ 5 seconds**. If it misses this, the item is not done.

### 3b · `TASK-M9` · ITS OWN INSTALLABLE APP 🟥 *(Florin amendment, 2026-09-12: "so the tasks, as the WorkHub, gets a route that I can install as webapp?")*

**Yes — and it is what makes the capture budget achievable.** Inside CoralOS Mobile, opening the app lands on `/m` and Tasks is a tab, so capture costs two taps before typing. A dedicated app opens **directly into capture**.

The pattern already exists — `src/app/[locale]/layout.tsx:180-186` picks a manifest per context:
```jsx
{isWorkHub ? <link rel="manifest" href="/manifest-workhub.json" />
 : isMobileRoute ? <link rel="manifest" href="/manifest-mobile.json" />
 : <link rel="manifest" href="/manifest.json" />}
```

- [ ] **New `public/manifest-tasks.json`**, modelled on `manifest-mobile.json`:
  ```json
  {
    "name": "Coral Tasks",
    "short_name": "Tasks",
    "start_url": "/m/tasks?capture=1",
    "scope": "/m",
    "display": "standalone",
    "background_color": "#0a0a0a",
    "theme_color": "#c2440f",
    "orientation": "portrait-primary",
    "shortcuts": [
      { "name": "New task", "url": "/m/tasks?capture=1" },
      { "name": "Today",    "url": "/m/tasks" }
    ]
  }
  ```
  Reuse the existing icon set verbatim (`/icon-192.png?v=2`, `/icon-512.png?v=2`, `/icon-maskable-512.png?v=2`, `favicon.ico?v=2`).
- [ ] **`start_url: "/m/tasks?capture=1"` is the point.** The app opens with the capture field **already focused** — tap icon, type, done. **One tap.** `/m/tasks` must read `?capture=1` and focus the input on mount without any further interaction.
- [ ] **`scope` stays `/m`**, not `/m/tasks`. A narrower scope would kick links to a project or invoice out into a browser tab. Same scope, different `start_url`.
- [ ] **Add a fourth branch to the manifest selector** in `layout.tsx`: when the path starts with `/m/tasks`, link `manifest-tasks.json`. This is what makes "Add to Home Screen" install *Tasks* rather than CoralOS Mobile when Florin is on that page.
- [ ] **Also add a `shortcuts` entry to `manifest-mobile.json`** — "New task" → `/m/tasks?capture=1`. Long-pressing the CoralOS Mobile icon then offers capture directly, so the single-app route is fast too. WorkHub's manifest already uses `shortcuts`; copy its shape.

### ✅ iOS ISOLATION — CONFIRMED BY FLORIN, 2026-09-12. This is now a design input, not a risk.

Each Home Screen web app on iOS is a **separate origin instance with its own storage container**. `localStorage`, `sessionStorage`, cookies and **IndexedDB** are not shared with Safari or with another icon of the same app. A newly added icon starts **empty** — no inherited session, no cached data.

Three consequences, all of which the implementation must take as given:

**1 · The Tasks app has its own login.** One-time on install, and again whenever its session expires — independently of CoralOS Mobile. Expected behaviour, not a bug. **Do not** attempt to share a session between the two; it is not possible and any workaround would be a security smell.

**2 · The Tasks app has its own IndexedDB and its own `syncQueue`.** A capture made in Tasks reaches CoralOS Mobile only **after it syncs to the server**, and vice versa. The server is the join point. This is correct — **state it in the UI's pending/synced indicator rather than trying to hide it.**

**3 · 🟥 THE IMPORTANT ONE — the Tasks app must NOT hydrate the whole workspace.**
A second container means a second full copy of everything the store persists. Production holds **9,776 `GlobalPage` rows (~52 MB)** — the `MEM-3` problem — and a naive Tasks app would duplicate it on the phone, in the app whose entire purpose is to open instantly.

**The mechanism already exists and shipped** (`MEM-3a/b/c`, commits `d482db7`/`d83e2df`):
```ts
// src/app/actions/global-databases.ts
getGlobalDatabaseSchemas(): Promise<Database[]>          // :139 — schemas, no pages
getGlobalPageIndex(): Promise<PageIndexEntry[]>          // :289 — labels only
getDatabasePages(databaseId: string): Promise<Page[]>    // :178 — one database

// src/components/admin/database/store.ts
loadDatabasePages: (databaseId: string) => Promise<Page[]>   // :151
loadedDatabaseIds: string[]                                   // :149
```

- [ ] **`/m/tasks` loads schemas + index + `loadDatabasePages(resolveDbId('db-tasks'))` — and nothing else.** No `getGlobalDatabases()`, no full hydration, on any path the Tasks app can reach.
- [ ] Verify by measurement: report the **payload size and time to interactive on a cold launch** of the installed Tasks app. If it is pulling the full workspace, it is wrong.

**iOS's isolation therefore turns from a cost into an advantage:** the Tasks app becomes the **lightest client in the system** — one small database, its own container — and it sidesteps `MEM-3` entirely instead of inheriting it.

**This is still not a new write path.** `TASK-X2` holds: same store, same mutators, merely *scoped hydration*. Do not build a private tasks client.

**First launch is online-only** and will ask for login — expected, and `sw.js` caches nothing (finding F2), so a fresh container has no shell to fall back on. Cold offline remains `TASK-M3b`, out of this batch.

### 4 · `TASK-M6` · the nav 🟧
- [ ] Add **Tasks** to `MobileShell.tsx:43-47` pointing at `/m/tasks`, with a `t('nav_tasks')` label in **en/nl/fr** (LOCALISATION DIRECTIVE — no hardcoded Dutch).
- [ ] Six entries may crowd the bar; if so, drop or relocate the least-used rather than shrinking touch targets. **Say which you changed and why.**
- [ ] Also: `MobileBottomNav.tsx:21` points "Tasks" at `/admin/tasks` — repoint to `/m/tasks`.

### 5 · `TASK-M7` · the installed-PWA jump 🟧
- [ ] Florin: *"installed webapp loads and on click all screen graphics jump up by ±20px."*
- [ ] **Trace before fixing.** Leading candidates: `100vh` vs `100dvh` with the mobile address bar; a `safe-area-inset` applied only after hydration; or a layout shift when the virtual keyboard opens. **Report the measured cause in the commit message**, then fix it.
- [ ] Verify in the **installed** PWA, not a browser tab — the two behave differently, and installed is where Florin sees it.

### `F1` · declare the properties 🟥 — *first commit, it is the smallest*
- [ ] As described in F1 above. Additive to the `db-tasks` property list. No migration.

---

### 6 · `TASK-M8` · RECURRENCE ENGINE — correct it 🟥 *(Florin amendment, 2026-09-12)*

**Scope carve-out:** `src/components/admin/tasks/RecurrenceEngine.ts` is **pure logic, no React, no desktop UI** — it is explicitly exempt from the desktop fence. Touch this file and its new test file only.

**Planner audit of the current 66 lines — six defects, ordered by damage:**

- [ ] **R-1 🟥 Monthly overflows at month-end — the worst one.**
  ```ts
  case 'monthly': d.setMonth(d.getMonth() + rule.interval); break;   // :46
  ```
  31 January + 1 month → JS rolls over to **3 March**. Then 3 April, 3 May… **every month-end recurrence silently drifts and never comes back.** VAT returns, payroll and rent are exactly the month-end tasks this breaks.
  **Fix:** clamp to the last valid day of the target month — 31 Jan → 28/29 Feb → 31 Mar. Compute the target month first, then `Math.min(originalDayOfMonth, daysInTargetMonth)`. **Preserve the original day-of-month across steps** (29 → Feb 28 → Mar 29, not Mar 28), so store the anchor day rather than re-deriving it from the clamped result.
- [ ] **R-2 🟥 Yearly has the same bug on 29 February.** `setFullYear(+1)` on 29 Feb → 1 March. Clamp to 28 Feb in non-leap years.
- [ ] **R-3 🟥 `interval` is unguarded — `"every 0 days"` parses to `interval: 0`**, and `getNextDueDate` then returns **the same date**. Any caller looping "advance until future" hangs forever. **Reject `interval < 1` in `parseRecurrenceRule` (return `null`) and assert it in `getNextDueDate`.**
- [ ] **R-4 🟧 Weekly-on-a-named-day ignores `interval`.** `:53-55` jumps to the next matching weekday regardless, so "every 2 weeks on Tuesday" is impossible — and the parser cannot express it either (`:32` `every N weeks` never sets `dayOfWeek`). Support `every N weeks on <day>`, and honour the interval.
- [ ] **R-5 🟧 A missed task never catches up.** A daily task untouched for ten days returns due+1 — still in the past — so the caller must loop (see R-3). **Add `getNextDueAfter(rule, from, notBefore)`** that advances in one call to the first occurrence strictly after `notBefore`, with a hard iteration cap that throws rather than spins.
- [ ] **R-6 🟧 An unparseable rule vanishes silently.** `parseRecurrenceRule` returns `null` for anything it does not recognise, and `raw` free text is the stored format — so a typo, or Dutch/French input ("elke maand"), silently means *no recurrence*. **Per the ERROR-SURFACING DIRECTIVE: an unparseable recurrence must be reported, not dropped.** Return a discriminated result (`{ ok: true, rule } | { ok: false, reason, raw }`) and have the caller show it. Do **not** add nl/fr parsing in this batch — surfacing the failure is the fix; translation is a later item.

**One decision, and I have made it — say so if you disagree:**
Recurrence today advances from whatever `from` the caller passes, with no way to express *which* date it should repeat from. **Implement both, defaulting to repeat-from-due-date:**
- *from due date* — the next occurrence is anchored to the schedule. A VAT return due the 20th stays due the 20th even if filed on the 27th. **This is the correct default for a business.**
- *from completion date* — anchored to when it was actually done ("service the van every 3 months"). Per-task opt-in.

**Tests — `tests/recurrence.test.ts`, and this is why the file is worth fixing:** it is pure, deterministic and dependency-free, which is exactly what the harness exists for. Required cases: 31 Jan monthly ×3 steps · 29 Feb yearly into a non-leap year · `interval: 0` rejected · every 2 weeks on Tuesday · `getNextDueAfter` catching up ten missed days · unparseable input returns a **reported** failure, not `null` · a DST boundary in Europe/Brussels does not shift the day.

**Commit:** `TASK-M8: fix month-end, leap-year and interval defects in the recurrence engine`

## VERIFY
```bash
npm run test:compile
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```
Baseline **77 tests / 5 files**; `tests/i18n.test.ts` is **already red** (`I18N-MISSING-KEYS`) — pre-existing, do not edit or skip it. **`jest` is not installed.**

**Manual, on a phone, in the installed app:**
1. **Timed, from the installed Tasks icon:** tap icon → type → done. **1 tap to a focused field, ≤5 seconds total.** From CoralOS Mobile instead: ≤2 taps.
2. Capture three in a row without reopening the capture control.
3. Airplane mode → capture two → they appear marked **pending** → reconnect → they sync and the mark clears. Reload: still there.
4. Opening `/m/tasks` shows **today**, not everything.
5. Complete one with a single tap; Undo works; it then leaves the list.
6. A project-linked task does **not** appear in My Tasks.
7. The installed PWA does not jump on first interaction.
7b. **(TASK-M9)** Visiting `/m/tasks` in mobile Safari offers "Add to Home Screen" as **Tasks**, not CoralOS Mobile; the installed icon opens straight into a focused capture field; a link from a task to a project stays **inside** the app (scope `/m`), and does not open a browser tab.
7c. **(TASK-M9)** Cold launch of the installed Tasks app: report **payload size and time to interactive**. It must load `db-tasks` only — if the full workspace is being pulled, the item is not done.
7d. **(TASK-M9)** A capture made in the Tasks app appears in CoralOS Mobile **after sync**, not before. Confirm the pending/synced indicator tells the truth in both apps.
8. `/admin/tasks` and `/workhub` are **unchanged** — open both and confirm.
9. **(TASK-M8)** A monthly task due 31 January advances to 28/29 February, then to **31** March — not the 3rd. Check three steps, not one.

## PROHIBITIONS
- **No desktop changes.** Nothing under `components/admin/tasks/` except pure-logic imports — with the single exception of `RecurrenceEngine.ts`, which `TASK-M8` rewrites. Nothing in `/admin/tasks`.
- **No date library added.** `date-fns`/`luxon`/`dayjs` are not in `package.json`; the fixes above are arithmetic and need none. Do not introduce a dependency for this.
- **No second task model, no new Prisma model, no new database.** `db-tasks` is the one representation.
- **No private write path** — use the store mutators above. When `R2-2` lands, tasks inherit field intents for free.
- **No bare `'db-tasks'`** anywhere — always `resolveDbId('db-tasks')`.
- **No Postgres migration** in this batch.
- **No offline claim beyond warm offline** (F2).
- **No hardcoded Dutch** — en/nl/fr at the time of writing.
- **Do not invent APIs.** Anything not pasted above, read from the file first.
