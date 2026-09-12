# ⛔ WITHDRAWN — 2026-09-12

**Florin: *"Remove it entirely… I'd rather have subtasks than dependencies. Some blocked by / blocks logic can be built at any given moment, when we have time to develop a decisional matrix… but now, it can simply go and not consume resources."***

The feature is **deleted** — see `coder-directive-dep-removal.md` (execution-order item `1.0`). `DEP-0…5` are cancelled, not parked. The replacement want is **`TASK-SUBTASKS`** (containment, not scheduling constraints), unscoped and unauthorised.

**Stored `prop-task-depends-on` values are deliberately left in the data**, so this costs nothing if blocked-by/blocks is ever designed fresh.

The audit below is kept **only** as the record of why it went.

---

# CORAL — TASK DEPENDENCIES — audit and spec — Planner 2026-09-12

**Status: SPEC ONLY. Not in Part A.** Part A is mobile capture; `DependencyGraph.tsx` is a desktop surface and the desktop fence holds. This is sequenced with **Part C (full module)**, alongside the parked `PROJ-2`.

> **INVARIANT (target):** *A dependency is a state the system respects, not a picture it draws. If a task is blocked, every surface knows it; when the blocker clears, the blocked task moves on its own.*

---

## HOW IT WORKS TODAY — traced, not assumed

**Storage.** `prop-task-depends-on` is a plain array of task page ids held **on the blocked task**, pointing back at its prerequisites. One direction. No back-reference. `TaskModuleShell.tsx:129` initialises it to `[]` for every new task.

**Reads** — all of them in `DependencyGraph.tsx`:
```ts
// prerequisites of the selected task — its own array, mapped to pages
(currentTask.properties['prop-task-depends-on'] as string[] || [])
    .map(id => pages.find(p => p.id === id))
    .filter((p): p is Page => !!p)                                    // :31-33

// dependents — a full scan of every active task, per render
activePages.filter(p => (p.properties['prop-task-depends-on'] as string[] | undefined)?.includes(currentTask.id))   // :38-41
```

**View.** Three columns — *Prerequisites (Must Do First)* → *Current Task* → *Unlocks Next (Deferred Flow)*. A prerequisite renders with a green check when `status === 'opt-done'`, an amber warning otherwise; the centre card shows *"Blocked by incomplete prerequisites"* when any prerequisite is open.

**That is the entire feature.** It is a hand-maintained relationship rendered in one screen.

---

## THE GAPS

| # | Gap | Consequence |
|---|---|---|
| **D-1** | **Nothing is enforced.** A blocked task can be completed, flagged, put in My Day and shown in Today like any other. | "Blocked" is a label in one view, not a state. The system will happily let you do things in the wrong order. |
| **D-2** | **Nothing propagates.** Completing a prerequisite does not defer, release, notify, or move a date on the dependent. | The column is headed *"Unlocks Next (Deferred Flow)"* and **no deferral exists**. The label promises behaviour the code does not have. |
| **D-3** | **Dangling ids are dropped silently.** Delete a prerequisite and its id stays in the dependent's array; `.filter(p => !!p)` removes it from the render with no trace. | A blocker vanishes and nothing says so. **Silent-failure shape.** The task now looks unblocked when its prerequisite was deleted, not completed. |
| **D-4** | **No cycle detection.** A→B→A is representable. | Two tasks block each other forever, with no warning and no way to see why. |
| **D-5** | **`depends-on` is read in exactly one file.** The list, board, Today view and mobile know nothing about it. | You have to go looking for the dependency screen to learn anything. A dependency you must remember to check is not doing its job. |
| **D-6** | **Reverse lookup is an O(n) scan per render.** | Harmless at current volume. Noted so it is a decision later rather than a surprise. |

---

## THE WORK

### DEP-0 · DECIDE THE SEMANTICS FIRST 🟥 — **Florin's call, and it governs everything below**
Two coherent designs. Picking neither is what produced today's state.

- **(a) Informational** — dependencies describe order, the system never stops you. Cheap, honest, and it means **renaming the UI to match** (*"Unlocks Next (Deferred Flow)"* has to go). Fix D-3 and D-4 and stop.
- **(b) Enforcing** — a blocked task is *deferred until its prerequisites are done*: hidden from Today, excluded from My Day, surfaced automatically the moment the last blocker closes. Requires D-1, D-2, D-3, D-4 and D-5 together.

**Planner recommendation: (b), but only inside Part C.** Half-enforcement is worse than none — a system that hides some blocked tasks and shows others teaches you not to trust the list, which is the exact failure we are fixing. **Do not implement (b) piecemeal.**

### DEP-1 · REFERENTIAL INTEGRITY 🟧 *(worth doing whichever way DEP-0 goes)*
- [ ] Deleting a task removes its id from every `prop-task-depends-on` array that references it — or, if that is too expensive, the graph **reports** the dangling reference instead of filtering it away. **Never a silent drop.** Per the ERROR-SURFACING DIRECTIVE.
- [ ] A one-off read-only audit: count existing dangling references. Report before changing anything.

### DEP-2 · CYCLE DETECTION 🟧
- [ ] Adding a dependency that would create a cycle is **refused at the point of the edit**, naming the path (`A → B → A`). Not detected later, not rendered as a warning — refused.

### DEP-3 · ONE BLOCKED STATE, READ EVERYWHERE 🟧 *(only under DEP-0 (b))*
- [ ] `isBlocked(task)` derived in **one** place and consumed by the list, board, Today, review and mobile. **Do not** recompute it per surface — that is the sideways-copy shape.
- [ ] Blocked tasks are excluded from Today and My Day, and visibly marked wherever they do appear.

### DEP-4 · PROPAGATION 🟧 *(only under DEP-0 (b))*
- [ ] Completing the **last** open prerequisite releases the dependent: it becomes eligible, and it says so — a notification, or appearing in Today the next time it is opened.
- [ ] Deliberately **not** automatic rescheduling. Per Florin's standing principle — *"automation is good, but the user remains the ultimate authority"* — releasing a task makes it available; it does not decide when it happens.

### DEP-5 · REVERSE INDEX 🟨
- [ ] Build the dependents map once per render pass rather than scanning per task. Only worth doing if DEP-3 lands, since that is what makes the lookup hot.

## VERIFY *(when built)*
1. Delete a prerequisite → the dependent **reports** a missing blocker; it does not silently look unblocked.
2. Attempt A→B→A → refused at the edit, with the path named.
3. Under (b): a blocked task does not appear in Today; completing its last prerequisite makes it appear.
4. Under (b): `grep` finds exactly one definition of blocked-ness.
5. Under (a): no UI text promises deferral.

---

## RELATED — `PROJ-2` IS PARKED (Florin, 2026-09-12)
The status-value split found while auditing this — `DatabaseClone` declaring `t-todo`/`t-prog`/`t-done` while the module uses `opt-todo`/`opt-doing`/`opt-review`/`opt-done`/`opt-dropped` — is `PROJ-2 TASK-STATUS-CONSISTENCY`. **Florin has parked it for the larger project work.**

**One piece is carved out and stays in Part A**, because mobile cannot ship without it: the Part A directive writes and reads `opt-*`, and `F1` corrects the declared options so a task completed on the phone does not read as untouched on the desktop. That is the minimum for the two surfaces to agree. **Everything wider — auditing every status consumer, project task statuses, any `t-*` data that may exist — is parked with `PROJ-2`.**

⚠️ **Gate on the carve-out:** before changing the declared options, run a **read-only count** of `db-tasks` pages whose `prop-task-status` starts with `t-` versus `opt-`. If any `t-*` values exist, **report and stop** — that would mean two conventions in live data and it becomes `PROJ-2` work, not Part A work.
