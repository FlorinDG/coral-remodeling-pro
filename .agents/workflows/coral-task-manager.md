# CORAL — TASK MANAGER — make the one we have trustworthy, starting on the phone — Planner 2026-09-12

**Florin:** *"My strongest pain is the lack of a trustworthy task manager… can we just build or embed a proper task manager, that I can ideally also use on mobile?"* · *"I really need this to be working."*

**Scope (Florin):** *"Mine, project, team and the works — but in three parts. Submodule for my tasks, one for project tasks, and one for full blown module. The workforce members get their tasks in the WorkHub app, they don't have personal tasks."*
**What breaks trust (Florin):** *"Unusable on mobile, UI really far from optimised."*
**Amendments:** *"We don't touch desktop."* · *"Check, correct and improve the recurrence engine."* · *"So the tasks, as the WorkHub, gets a route that I can install as webapp?"* · *"I need to be able to add the task to a project."*

**Build instructions: `coder-directive-tasks-part-a.md` (9 commits).** Dependencies audit: `coral-task-dependencies.md`. This file is the reasoning and the record of decisions.

---

## THE CORRECTION THAT SHAPES THIS SPEC

The Planner assumed the trust problem was the **write path** — lost edits, sync conflicts — and was about to sequence this behind `R2`. **Florin says otherwise: the data is not what fails him, the interface is.** So this does not wait for R1 or R2.

**And it is not a build-from-scratch.** The module exists and is ambitious — **3,190 lines**: `PerspectiveBuilder`, `RecurrenceEngine`, `ReviewMode`, `DependencyGraph`, `TaskQuickAdd`, `TaskBoardView`, `TaskListView`, `TaskSidebar`, `TaskDetailPanel`. The thinking is done. What is missing is a surface Florin can use.

### The gap, measured
| | State |
|---|---|
| `/m` mobile PWA (installed, own manifest + service worker) | 11 pages — **no tasks** |
| `MobileBottomNav` "Tasks" | points at **`/admin/tasks`** — the desktop module, on a phone |
| `/workhub/tasks` | **20-line stub** (and WorkHub is the *workforce* app) |
| `TaskModuleShell` data source | `getDatabase('db-tasks')` — **bare id, not tenant-resolved**, 5 sites |

**The logic exists, the mobile app exists, and nobody connected them.**

---

## ARCHITECTURE — Florin's three parts

One module, one data representation, **two lenses**:

```
                    TASK MODULE  (one surface, switchable)
                   ┌──────────────────┬──────────────────┐
                   │   MY TASKS       │  PROJECT TASKS   │
                   │  (mine to do)    │ (grouped by job) │
                   └──────────────────┴──────────────────┘
                              one store: db-tasks
     DESKTOP /admin/tasks          MOBILE /m/tasks  ← Part A builds this
   WorkHub /workhub — workforce assignments. NOT part of this. Unchanged.
```

**One representation, two lenses — not two stores.** There are already three task-ish concepts in the schema (`db-tasks` pages, portal `Task`, `ShiftTask`). **A fourth would be defect shape #1.**

---

## DECISIONS ON RECORD

**D1 · My Tasks is scoped by OWNERSHIP, not by absence of a project.** *(Planner correction after Florin's project requirement.)* An earlier draft defined My Tasks as tasks with no project — under which **assigning a project would make a task vanish from the list**. Capture it, file it, lose it. My Tasks = everything that is mine to do; **a project is an attribute, not a filter**. Part B is a different *grouping* of the same records, never a different set.

**D2 · Tasks gets its own installable PWA — but no subdomain.** `manifest-tasks.json`, `start_url: /m/tasks?capture=1`, `scope: /m`. The `start_url` is the point: the app opens with the capture field focused — **one tap to capture**.
*No subdomain.* WorkHub has one because it is a different audience with its own auth redirect (`auth.ts:100-113`, `middleware.ts:120`). Tasks is Florin, same tenant, same session. A subdomain is a different origin → separate cookies and session on **every** platform, a third branch in the login redirect, DNS and domain config — for no gain, since iOS already isolates per installed app. *Revisit only if Android installs matter (Chrome separates by manifest `scope`, and ours overlaps `/m` — the lever there is a narrower scope, not a subdomain) or if Tasks is ever given to other people.*

**D3 · iOS storage isolation is a design input, not a risk.** *(Confirmed by Florin with sources.)* Each home-screen app gets its own container: own login, own IndexedDB, own `syncQueue`, empty on first launch. Consequences: the Tasks app logs in separately; a capture reaches CoralOS Mobile only **after it syncs** (the server is the join point, and the UI must say so); and — the important one — **the Tasks app must not hydrate the whole workspace.** Production holds 9,776 pages / ~52 MB; a naive second container would duplicate it. It loads **schemas + page index + `db-tasks` only**, via the `MEM-3a/b/c` lazy path that already shipped. **iOS isolation therefore makes Tasks the lightest client in the system** instead of the heaviest.

**D4 · Project assignment is not in the capture path.** Capture stays title-only — that is what protects the ≤5-second budget. The project is set afterwards, in two taps from the list. The picker is sourced from the **in-memory page index** filtered to `db-1`, sorted most-recently-updated first — **never** a load of the projects database. Works offline; cold-launch payload unchanged.

**D5 · Status values: `opt-*` is canonical.** Two disjoint sets exist — `DatabaseClone` declares `t-todo`/`t-prog`/`t-done`, the module uses `opt-todo`/`opt-doing`/`opt-review`/`opt-done`/`opt-dropped` across 40 usages. **The grid's select options match no stored value.** The data follows the code, so `opt-*` wins and the *declaration* is corrected — gated on a read-only count first: **if any `t-*` values exist in live data, stop**, because that is `PROJ-2` work. **`PROJ-2` is PARKED** (Florin) for the larger project work; only this `db-tasks` carve-out is in scope, and only because mobile and desktop must agree on what "done" means.

**D6 · Offline is scoped honestly.** `public/sw.js` is **27 lines and caches nothing by design**, so the app cannot cold-start offline. **In scope:** warm offline — app open, signal drops, capture queues and syncs. **Out of scope:** cold offline (`TASK-M3b`). We do not claim offline the app does not have.

---

## THE WORK

### PART A — MY TASKS ON THE PHONE 🟥 *the whole point* — `coder-directive-tasks-part-a.md`
`TASK-M1` the page (ownership-scoped, D1) · `TASK-M2` capture in ≤2 taps / ≤5s · `TASK-M3` warm-offline capture · `TASK-M4` today-not-everything · `TASK-M5` one-thumb complete with undo · `TASK-M6` nav · `TASK-M7` the installed-PWA ±20px jump · `TASK-M8` **recurrence engine defects** · `TASK-M9` its own installable app (D2) · `TASK-M10` assign to a project (D4) · `TASK-X1` tenant-resolve `db-tasks` · `F1` declare the 7 undeclared properties.

**`TASK-M8` — the recurrence engine is not merely unpolished, it is wrong.** Six defects in 66 lines, no tests:
`d.setMonth(+1)` on **31 January rolls to 3 March** — every month-end recurrence drifts and never returns, and month-end is VAT, payroll and rent · same bug on 29 February for yearly · `"every 0 days"` parses to `interval: 0`, so any caller advancing to a future date **hangs** · weekly-on-a-named-day ignores `interval` · a missed task never catches up · an unparseable rule returns `null`, so a typo or Dutch input **silently means no recurrence** — the silent-failure shape, in the feature whose job is to remember for you.
Plus a missing capability, now specified: **repeat-from-due-date (default) vs repeat-from-completion-date**. A VAT return due the 20th stays due the 20th even if filed on the 27th; "service the van every 3 months" opts into from-completion.

### PART B — PROJECT TASKS 🟧
`TASK-P1` the second lens — same records, grouped by project, switchable by one control · `TASK-P2` reachable from the project detail · `TASK-P3` mobile parity.
*(D4 already delivers assignment in Part A; Part B is the grouped view.)*

### PART C — THE FULL MODULE 🟨 *after A and B are in daily use*
`TASK-F1` desktop surface redesign **over the existing engine** — perspectives, recurrence, review and dependencies stay; same pattern as `GRID-REPLACE`, keep the logic and replace the component · `TASK-F2` assignment and team visibility · **the dependency work** (`coral-task-dependencies.md`, `DEP-0…5`) lands here, including Florin's decision on informational vs enforcing.

### CROSS-CUTTING
`TASK-X1` tenant-resolve the database (a live instance of the R1 fail-open seam, in the module Florin will rely on daily) · `TASK-X2` **no private write path** — tasks keep the store mutators and inherit `R2-2` field intents for free · `TASK-X3` localise every new string en/nl/fr as written.

## VERIFY — the only test that matters is daily use
1. **Timed, from the installed Tasks icon:** tap → type → done. **1 tap to a focused field, ≤5 seconds.**
2. Airplane mode → capture three → back online → all three there, pending state shown honestly.
3. Opening the app shows **today**, not a list of 200.
4. Complete with one thumb; undo works.
5. **Assign a project in ≤2 taps → the task stays in My Tasks**, now with a chip. Reload: still there, still assigned.
6. Monthly recurrence from 31 January → 28/29 Feb → **31** March. Three steps, not one.
7. The installed PWA does not jump on first interaction.
8. `/admin/tasks` and `/workhub` unchanged.

## PLACEMENT AND HONESTY
An **L3 feature** on the existing record core. It does not touch the kernel and does not block, or wait for, `R1`/`R2`. It runs ahead of them **deliberately** — the tool Florin runs his week with is worth more right now than another root, and it is cheap: the engine exists, the mobile shell exists, and the gap between them is a page and a nav entry.

**One caution, stated once.** Part C's desktop redesign is where this could quietly become a large project. **Ship A, use it for a week, then decide whether C is still worth it** — after a week of a working mobile list, the desktop complaint may simply be gone.
