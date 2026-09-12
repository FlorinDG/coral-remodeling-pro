# CORAL — SUBTASKS — first-class, on every surface — Planner 2026-09-12 (**rewritten**)

**Florin:** *"I'd rather have subtasks than dependencies."* → *"Give me subtasks."* → **2026-09-12 evening: *"Rewrite the file so that the subtasks exist as subtasks all over the place."***

Execution-order position: **Phase 2, item `2.10`**, after the sheet fixes (`2.6`–`2.9`).

> **INVARIANT:** *A subtask is a part of its parent. Every surface that shows tasks shows that relationship — the same way, everywhere. A subtask is never a loose row pretending to be a task of its own.*

---

## ⚠️ WHAT CHANGED IN THIS REWRITE, AND WHAT IT COSTS

The previous draft made subtasks **mobile-only**, with desktop showing them as ordinary loose tasks — *"unaware, not wrong"* — and deferred desktop nesting to Part C.

**Florin has rejected that, and he is right to.** A subtask that is a subtask on the phone and a loose task on the laptop is **two representations of one concept**, which is defect shape #1 — the thing this entire pass exists to eliminate. It would also do exactly what we spent today undoing: make two surfaces disagree about the same record, which is how a tool stops being trusted.

**Therefore the desktop fence is LIFTED for this feature, narrowly and by name.** That is a deliberate scope expansion, authorised by Florin, and it is the honest price of "subtasks all over the place":

| | |
|---|---|
| **Fence lifted for** | `components/admin/tasks/TaskListView.tsx` · `TaskBoardView.tsx` · `TaskRow.tsx` · `ReviewMode.tsx` · `PerspectiveBuilder.tsx` · `TaskModuleShell.tsx` — **and** the task tab of `ProjectDetailView.tsx` |
| **Fence still holds for** | everything else. No engine, grid, financial or WorkHub changes. `ProjectCockpit`, the progress automation in `store.ts`, `bordereau`, `po` are **untouched** — see below for why they need nothing. |
| **What this buys** | one concept, one behaviour, every surface. Part C shrinks: it no longer has to teach desktop what a subtask is. |
| **What it costs** | six files that were frozen. They are **presentation** files — list rendering — not the write path. The risk is visual, not structural. |

---

## DATA MODEL — unchanged, and it is what makes the rest cheap

- [ ] **`prop-task-parent`** — a relation on `db-tasks` pointing at **`db-tasks` itself**, holding **at most one** id. The **child** points at the parent.
- [ ] **Declare it in the `db-tasks` schema** alongside the `F1` set. Nothing undeclared — that was `F1`'s lesson.
- [ ] **No `prop-task-subtasks` array on the parent.** One direction. Children are found by filtering; a back-reference is a second representation that would drift.
- [ ] **One level.** A subtask cannot have subtasks. The parent picker excludes tasks that already have a parent. *(Nesting is the door back to a graph — closed deliberately.)*
- [ ] **🔴 A subtask DERIVES its parent's project — it does NOT store one.** `prop-task-project` stays **unset** on the child.
  **This is what keeps the blast radius at six presentation files.** Traced:
  - `bordereau/[id]/page.tsx:39` filters by `prop-task-project` → a stored project would put **subtasks into a client-facing document as line items**.
  - `ProjectDetailView.tsx:161-162` counts by `prop-task-status` over project tasks → counts would inflate.
  - `store.ts:1703-1715` marks a project Done only when **every** task is done → **adding subtasks would change when a project completes.**
  Because children store no project, **those three surfaces never see a subtask and need no change at all.**

---

## THE SHARED PIECE — write it once, use it on every surface

- [ ] **`lib/tasks/subtasks.ts`** — pure, no React, no store:
  ```ts
  export function subtasksOf(parentId: string, all: Page[]): Page[];
  export function isSubtask(task: Page): boolean;
  export function topLevel(all: Page[]): Page[];          // excludes anything with a parent
  export function subtaskProgress(parentId: string, all: Page[]): { done: number; total: number };
  ```
- [ ] **Every surface uses these. No surface recomputes "is this a subtask".** That is the sideways-copy rule, applied from the first line rather than after the third copy.
- [ ] Unit tests in `tests/subtasks.test.ts` — pure and deterministic, like `invoice-totals` and `recurrence`.

---

## BEHAVIOUR — identical on every surface

- [ ] **A subtask never appears as a top-level row.** Anywhere. Lists, boards, Today, review, project task tabs — all filter through `topLevel()`.
- [ ] **A parent shows its progress — `3/5`** — and its children nested beneath it, collapsed by default.
- [ ] **🟥 Completing all subtasks does NOT complete the parent.** It marks the parent **ready to close**; a person closes it. *Automation is good, the user remains the ultimate authority.* **The one semantic decision, made here — say so if you disagree.**
- [ ] **Deleting a parent promotes its subtasks to top-level**, never cascades. Report how many were promoted. *Silent cascade delete is data loss in a tidy-up costume.*
- [ ] A subtask keeps its own due date, flag, status and notes. It is a real task, just contained.
- [ ] A subtask's project is **shown** as the parent's, and is **not independently editable**.

## SURFACES

### Mobile — `/m/tasks` 🟥
- [ ] Detail sheet: subtask list with **inline add** (type, Enter, stays focused for the next — the capture pattern) and one-tap complete per row.
- [ ] **Promote a subtask to a task** and **demote a task into a subtask**, both from the sheet. The second is how a captured task that turns out to be part of something bigger gets filed.
- [ ] Parent rows in the list show `3/5`; children never appear as their own rows.
- [ ] ≥44px targets; the subtask list sits in the sheet's scrollable body, never behind the fixed footer (`TASK-M12`).

### Desktop task module 🟥 — *fence lifted, named files only* — **⚠️ THIS SECTION IS `2.10-b`, NOT YET BUILT**
> Commit `2ffcb1a` implemented the mobile half against the superseded draft. **Zero desktop files were touched**, and `lib/tasks/subtasks.ts` has exactly one importer. The model and the module are done and tested; what follows is **presentation only**.

- [ ] **`TaskListView`** — children nested under the parent, collapsible; `topLevel()` for the root list.
- [ ] **`TaskRow`** — progress indicator `3/5`; expand/collapse affordance.
- [ ] **`TaskBoardView`** — **only parents are cards.** A card shows `3/5`; subtasks are not separate cards, or the board becomes unreadable.
- [ ] **`ReviewMode`** — review the parent, with its children visible; do not review children as separate items.
- [ ] **`PerspectiveBuilder`** — perspectives operate on top-level tasks; a perspective that matches a child shows its **parent**.
- [ ] **`TaskModuleShell`** — add/edit a parent relation; enforce one level.

### Project detail 🟧 — *task tab only*
- [ ] **`ProjectDetailView`** task tab: parents with nested children and `3/5`. Its **counts stay as they are** — children carry no project, so nothing there changes arithmetic.
- [ ] **Do not touch** `ProjectCockpit`, the `store.ts` progress automation, `bordereau` or `po`. They need nothing, and that is by design.

## VERIFY
1. Add three subtasks on mobile in ≤3 taps each; input stays focused between them.
2. Parent shows `0/3` → `2/3` as they are ticked — **on mobile and on desktop**.
3. **No subtask appears as a top-level row** in: mobile Today, mobile All, desktop list, desktop board, review mode, any perspective, the project task tab. **Check all seven.**
4. Completing all three does **not** auto-close the parent; it is marked ready and closed by hand.
5. Assign the parent to a project → the child **displays** it and **stores none**. Confirm in the database that the child's `prop-task-project` is unset.
6. `bordereau/[id]` and `po/[id]` for that project → **subtasks do not appear** as line items.
7. Project completion still triggers on parents alone (`store.ts:1703-1715`) — unchanged by adding subtasks.
8. A subtask cannot be given its own subtask.
9. Delete a parent → children **promoted to top-level**, with a message saying how many.
10. Offline: add a subtask, it queues and shows pending.
11. `grep -rn "prop-task-parent" src` → every read goes through `lib/tasks/subtasks.ts`; **no surface implements its own check.**
12. `npm run test:compile` · `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'`

## PROHIBITIONS
- **No nesting beyond one level.**
- **No back-reference array on the parent.**
- **No auto-completion of the parent.**
- **No cascade delete.**
- **No `prop-task-project` written on a child.** Derive from the parent.
- **No changes to `ProjectCockpit`, `store.ts` automation, `bordereau`, `po`** — they need none.
- **No second implementation of "is this a subtask".** One module, every caller.
- **No files outside the named list.** The fence is lifted for six task files plus `ProjectDetailView`'s task tab, and **nothing else**. A change anywhere else is a stop-and-ask.
- **`prop-task-depends-on` stays deleted.** Subtasks are not dependencies renamed.
