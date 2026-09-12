# CORAL — 🟥 TASK STATUS: TWO LIVE SUBSYSTEMS, NOT STALE DATA — Planner 2026-09-12

## ⛔ THE MIGRATION IS RETRACTED. DO NOT RUN `task-status-38-records.sql` STEP 3.

The Planner proposed migrating 38 `t-*` records to `opt-*`, calling them legacy. **That was wrong, and running it would have broken project progress reporting.** The `t-*` convention is not stale — it is the **live, actively-written convention of the entire project subsystem.**

---

## WHAT THE NUMBERS SAID, AND WHAT THEY MEANT

```
t-todo  22   (22 with a project)
t-prog  11   (11 with a project)
t-done   5   ( 5 with a project)
         ──
        38   ← ALL 38 have a project. None is a personal task.
```

**That was the clue.** These are not old records; they are **project tasks**, and the project subsystem writes `t-*` today:

| Writer | Line | What it does |
|---|---|---|
| `ProjectDetailView.tsx` | **:422** | creates project tasks with **`'t-todo'`** |
| `ProjectDetailView.tsx` | **:439-440** | the status toggle cycles `t-done → t-todo → t-prog` |
| `ClientQuotationEngine.tsx` | **:734** | creates tasks with **`'t-todo'`** |
| `lib/services/quote-service.ts` | **:128** | **`autoCreateProjectFromQuote`** creates tasks with **`'t-todo'`** |
| `store.ts` | **:1699, :1703, :1711** | **project progress automation** keys off `t-prog` and `t-done` |

And the readers: `ProjectCockpit.tsx:80-124` groups by `t-todo`/`t-prog`/`t-done`; `ProjectDetailView.tsx:51-53, 161-162, 774-800` renders and counts by them. **`DatabaseClone.tsx:626-628` still declares the `t-*` options** — `F1` correctly left them alone because the gate was dirty.

### Why the migration would have caused real damage
`store.ts:1703-1715` sets a **project to Done when every one of its tasks is `t-done`**. Migrate those 5 records to `opt-done` and they stop counting as done — so:
- project completion would **never** trigger,
- `ProjectCockpit` would show those tasks in no column at all,
- `ProjectDetailView` counts and the progress bar would silently change,
- and `t-prog` → `opt-doing` would break the "first task busy → project in progress" trigger.

**Silent, and in the project reporting Florin runs jobs from.** The 5 wrong rows on mobile would have been traded for a broken automation.

---

## THE ACTUAL SITUATION

**Two subsystems, two conventions, both live, both writing:**

| Subsystem | Convention | Surfaces |
|---|---|---|
| **Project tasks** | `t-todo` · `t-prog` · `t-done` | ProjectDetailView · ProjectCockpit · quote→project automation · progress automation · the grid's declared options |
| **Personal / task module** | `opt-todo` · `opt-doing` · `opt-review` · `opt-done` · `opt-dropped` | TaskModuleShell and everything under `components/admin/tasks/` · `/m/tasks` |

**`PROJ-2` is therefore not a stale note about drifted values. It is a live subsystem boundary**, and it is correctly parked — but its parking note must say *this*, not "two conventions in the data".

**Planner error, recorded:** I read `t-*` as legacy because the module used `opt-*` and the triage note called `t-*` canonical-but-stale. I inferred *drift* from a value mismatch without checking **who writes what**. The same failure I have flagged in the coder's plans twice: inference from code shape, without tracing the writers. The 15 seconds of `grep` that produced the table above should have come before the SQL, not after.

---

## WHAT TO DO NOW

### TS-1 · MOBILE READS BOTH — a documented, temporary tolerance 🟥
**This reverses my "no `t-*` hedge" instruction**, which was correct only under the assumption the data was legacy. It is not.

- [ ] `src/app/[locale]/m/tasks/page.tsx` — `isDone` accepts **`opt-done` OR `t-done`**; the open-list filter excludes **`opt-done`, `opt-dropped`, `t-done`**.
- [ ] **Writes stay canonical `opt-*`.** A task *created or completed on mobile* uses `opt-*`; a project task completed in the project view keeps `t-*` until `PROJ-2`. Mobile reads both, writes one.
- [ ] **Comment the reason at the read site**, naming `PROJ-2` and this file — so the next person does not "clean it up" and reintroduce the bug.
- [ ] Extend `tests/task-part-a.test.ts`: `t-done` counts as done; `t-todo`/`t-prog` count as open.

**Why a tolerance is acceptable here and was not before:** a hedge that accommodates *dead* data is debt. A hedge that accommodates a *live, actively-written* second subsystem is an honest interface boundary, held until the two are unified.

### TS-2 · CORRECT THE `PROJ-2` PARKING NOTE 🟧
- [ ] Rewrite it to say what this file says: two live subsystems with their own writers and automations — **not** drifted data. Whoever unpicks it must know that migrating values without moving the writers and the progress automation together will break project completion.

### TS-3 · WHEN `PROJ-2` IS DONE — the real job 🟨 *(parked, scoped here so it is not underestimated)*
One status vocabulary, and in the same commit: both creation paths · the toggle · the progress automation (`store.ts:1699-1715`) · `quote-service` · `ProjectCockpit` · `ProjectDetailView` · the declared options · **and** the data migration. **All of it together, or not at all** — the pieces are only correct in combination.

## VERIFY
1. The 5 `t-done` project tasks no longer appear as open in `/m/tasks`.
2. `t-todo`/`t-prog` project tasks still appear as open.
3. Completing a task **in the project view** still drives project progress — unchanged.
4. Completing a task **on mobile** writes `opt-done` and does not disturb the project automation.
5. `npm run test:compile` · full suite green bar the known `i18n` red.

## STATUS OF THE SQL FILE
`task-status-38-records.sql` — **Step 1 (read-only) was correct and produced the finding. Steps 3 and 4 are RETRACTED and must not be run.** The file is kept for the count and this record.
