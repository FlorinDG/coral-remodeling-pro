# CORAL — TASK MANAGER — make the one we have trustworthy, starting on the phone — Planner 2026-09-12

**Florin:** *"My strongest pain is the lack of a trustworthy task manager… can we just build or embed a proper task manager, that I can ideally also use on mobile?"*
**Scope (Florin):** *"Mine, project, team and the works — but in three parts. Submodule for my tasks, one for project tasks, and one for full blown module. The workforce members get their tasks in the WorkHub app, they don't have personal tasks."*
**What breaks trust (Florin):** *"Unusable on mobile, UI really far from optimised."*

---

## THE CORRECTION THAT SHAPES THIS SPEC

The Planner assumed the trust problem was the **write path** — lost edits, sync conflicts — and was about to sequence this behind `R2`. **Florin says otherwise: the data is not what fails him, the interface is.**

That changes everything about the plan: **this does not wait for R1 or R2.** It is presentation and reach, not persistence.

**And it is not a build-from-scratch.** The task module already exists and is ambitious — **3,190 lines** across `components/admin/tasks/`: `PerspectiveBuilder`, `RecurrenceEngine`, `ReviewMode`, `DependencyGraph`, `TaskQuickAdd`, `TaskBoardView`, `TaskListView`, `TaskSidebar`, `TaskDetailPanel`. The *thinking* is done. What is missing is a surface Florin can actually use.

### The gap, measured
| | State |
|---|---|
| `/m` mobile PWA (installed, own manifest + service worker) | 11 pages: invoices, quotes, purchases, expenses, clients, files, settings… **no tasks** |
| `MobileBottomNav` "Tasks" | points at **`/admin/tasks`** — the desktop module, on a phone |
| `/workhub/tasks` | **20-line stub** (and WorkHub is the *workforce* app — not where Florin's tasks belong) |
| `TaskModuleShell` data source | `getDatabase('db-tasks')` — **bare id, not tenant-resolved** |

**So: the logic exists, the mobile app exists, and nobody connected them.**

---

## ARCHITECTURE — Florin's three parts, made concrete

One module, one data representation, **two lenses**:

```
                    TASK MODULE  (one surface, switchable)
                   ┌──────────────────┬──────────────────┐
                   │   MY TASKS       │  PROJECT TASKS   │
                   │  (Florin's own)  │ (linked to a job)│
                   └──────────────────┴──────────────────┘
                              one store: db-tasks
                    ┌─────────────────────────────────────┐
                    │  DESKTOP /admin/tasks               │
                    │  MOBILE  /m/tasks   ← the missing    │
                    └─────────────────────────────────────┘
   WorkHub  /workhub  — workforce assignments. NOT part of this. Unchanged.
```

**One representation, two lenses — not two stores.** "My tasks" and "project tasks" are the **same records** filtered by whether a project relation is set. Creating a second task model would be defect shape #1, and there are already three task-ish concepts in the schema (`db-tasks` pages, portal `Task`, `ShiftTask`). **Do not add a fourth.**

Workforce members get tasks in WorkHub and have no personal list — so nothing in this spec touches the worker app.

---

## THE WORK

### PART A — MY TASKS ON THE PHONE 🟥 *the whole point; everything else can wait*

- [ ] **TASK-M1 · `/m/tasks` exists** — a real page in the mobile shell, inside the PWA Florin already has installed. Not a link to `/admin/tasks`, not an iframe, not a responsive squeeze of the desktop grid.
- [ ] **TASK-M2 · Capture in two taps from cold.** Open the app → capture → done, one thumb, no scrolling, no modal stack. **This single number is what decides whether a task manager is trusted**: if capture is slower than reaching for paper, the list goes stale and everything else is wasted. Title-only is a complete task; everything else is optional and set later.
- [ ] **TASK-M3 · Capture survives being offline.** In a basement, a van, a site with no signal — the capture is queued and syncs later, and the UI says so plainly. A capture that vanishes because of signal is exactly the "untrustworthy" this spec exists to end. The service worker (`public/sw.js`) and the store's existing `syncQueue` dirty-page protection are the pieces; wire them, do not invent a second queue.
- [ ] **TASK-M4 · The default view is *today*, not *everything*.** Opening the app answers "what am I doing now" — due today, deferred-until today, flagged. A full list is a tap away, never the landing view.
- [ ] **TASK-M5 · Complete with one thumb.** Tick from the list without opening a detail sheet. Undo available for a few seconds; no confirmation dialog.
- [ ] **TASK-M6 · Fix the nav.** `MobileBottomNav` "Tasks" → `/m/tasks`. *(Related, already logged: `MOBILE-HOME-NOT-WORKHUB` — "Home" routing to WorkHub on mobile.)*
- [ ] **TASK-M7 · Fix the installed-PWA layout jump** — Florin's `UI-INSTALLED-PWA-JUMP`: *"installed webapp loads and on click all screen graphics jump up by ±20px."* This is in the way of trusting the mobile app at all. Likely the address-bar/viewport-unit shift (`100vh` vs `100dvh`) or a safe-area inset applied after hydration. **Trace before fixing.**

### PART B — PROJECT TASKS 🟧
- [ ] **TASK-P1 · The second lens** — same records, filtered to those with a project relation; grouped by project. Switchable from My Tasks by a single control (Florin: *"accessible by a button or a menu choice"*).
- [ ] **TASK-P2 · Reachable from the project** — the project detail opens its tasks in this lens rather than a separate grid. *(Feeds `PROJ-4` / `PROJ-DOC-ROLLUP`.)*
- [ ] **TASK-P3 · Mobile parity** — the project lens works at `/m/tasks` too. Standing on site, "what's open on this job" is the question.

### PART C — THE FULL MODULE 🟨 *after A and B are in daily use*
- [ ] **TASK-F1 · Keep the logic, fix the presentation.** `PerspectiveBuilder`, `RecurrenceEngine`, `ReviewMode`, `DependencyGraph` are built and stay. The desktop UI is what Florin calls "far from optimised" — treat it as a redesign of the existing engine's surface, not a rewrite. *(Same pattern as `GRID-REPLACE`: keep the logic, replace the component.)*
- [ ] **TASK-F2 · Assignment and team visibility** — only once A and B are trusted. This is the part that turns a tool into a module, and it is the part Florin explicitly deferred.

### CROSS-CUTTING — small, do them inside Part A
- [ ] **TASK-X1 · Tenant-resolve the database** 🟥 — `TaskModuleShell.tsx:34` asks for `getDatabase('db-tasks')`, the **bare** id, and `:59`/`:102`/`:109`/`:138` write to `'db-tasks'` the same way. Must resolve per tenant. **This is a live instance of the R1 fail-open seam** — `resolveDbId` returning the bare id — in the module Florin is about to rely on daily. Fix it here; R1 will enforce it globally later.
- [ ] **TASK-X2 · No new write path.** Tasks keep using the existing store mutators. When `R2-2` lands, tasks inherit field-level intents for free. **Do not build a private task-writing path** — that would be a fifth door.
- [ ] **TASK-X3 · Localise as you go** — per the LOCALISATION DIRECTIVE, every new string in `en/nl/fr` at the time it is written. No new hardcoded Dutch.

## VERIFY — the only test that matters is daily use
1. **Cold phone, app closed → captured task in ≤2 taps and ≤5 seconds.** Time it. If it fails this, nothing else counts.
2. Airplane mode → capture three tasks → back online → all three are there, and the UI showed their pending state honestly.
3. Opening `/m/tasks` shows **today**, not a list of 200.
4. Complete from the list with one thumb; undo works.
5. Switch to Project Tasks, pick a project, see its open tasks — on the phone.
6. The installed PWA does **not** jump on first interaction.
7. Nothing in `/workhub` changed.
8. `npm run test:compile` · `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'` (baseline 77/5, `i18n` pre-red).

## PLACEMENT AND HONESTY
This is an **L3 feature** on the existing record core — it does not touch the kernel and does not block, or wait for, `R1`/`R2`. It is being done ahead of them **deliberately**, because the tool Florin runs his week with is worth more to him right now than another root, and because it is cheap: the engine exists, the mobile shell exists, and the gap between them is a page and a nav entry.

**One caution, stated once.** Part C's redesign of the desktop surface is where this could quietly become a large project. Parts A and B are small and finite. **Ship A, use it for a week, then decide whether C is still worth it** — after a week of a working mobile list, the desktop complaint may simply be gone.
