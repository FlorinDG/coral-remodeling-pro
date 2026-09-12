# CORAL — SUBTASKS — the thing that replaces dependencies — Planner 2026-09-12

**Florin:** *"I'd rather have subtasks than dependencies."* → *"And give me subtasks."*

Execution-order position: **Phase 2, item `2.10`**, after the sheet fixes (`2.6`–`2.9`) because subtasks live inside the detail sheet and that sheet is currently broken.

> **INVARIANT:** *A subtask is a part of its parent, not a task that happens to point at one. It inherits the parent's context, it is never orphaned, and completing it is visible progress on the parent — but the parent is closed by a person, not by arithmetic.*

---

## WHY THIS IS SMALL WHERE DEPENDENCIES WERE NOT

Dependencies were a **scheduling constraint** — a graph, with cycles, propagation, enforcement semantics, and a decisional matrix to design. **Containment has none of that.** A subtask has exactly **one** parent; there is no cycle to detect, nothing to propagate, and no semantics to decide beyond one question (below). That is why Florin's instinct to swap them was right.

---

## DATA MODEL

- [x] **`prop-task-parent`** — a relation on `db-tasks` pointing at **`db-tasks` itself** (self-relation), holding **at most one** id. The **child** points at the parent, exactly as `prop-task-project` points at a project.
- [x] **Declare it in the `db-tasks` schema** alongside the `F1` set. Do not leave it undeclared — that was `F1`'s whole lesson.
- [x] **No `prop-task-subtasks` array on the parent.** One direction only. A parent's children are found by filtering — a back-reference is a second representation of one fact, and the two would drift.
- [x] **One level.** A subtask cannot itself have subtasks. Enforce it: the parent picker excludes tasks that already have a parent. *(Nesting is the door back to a graph — closed deliberately.)*

## RULES

- [x] **A subtask inherits its parent's project**, and follows it if the parent's project changes. The child's own project is not independently editable — that is what "part of" means.
- [x] **Subtasks do not appear as separate rows in the My Tasks list.** They appear **inside** their parent's row and detail. A list where a five-step task becomes six entries is the clutter that makes people stop trusting a list.
- [x] **The parent row shows progress — `3/5`** — and nothing else changes about it.
- [x] **🟥 Completing all subtasks does NOT complete the parent.** It surfaces the parent as ready to close, and **Florin closes it.** Per the standing principle: *automation is good, but the user remains the ultimate authority.* **This is the one semantic decision, and it is made here — say so if you disagree.**
- [x] **Deleting a parent:** its subtasks are **promoted to top-level tasks**, not deleted. Report how many were promoted. **Never silently cascade a delete** — that is data loss wearing a tidy-up costume.
- [x] A subtask keeps its own due date, flag and status. It is a real task, just contained.

## MOBILE — where it actually gets used

- [x] **In the detail sheet:** a subtask list with **inline add** (type, Enter, stays focused for the next — same pattern as capture) and one-tap complete per row.
- [x] Reorder by drag **only if it is free** with the existing list; otherwise skip it. Order is not the point.
- [x] **Promote a subtask to a task**, and **demote a task into a subtask** — both from the detail sheet. The second is how a captured task that turns out to be part of something bigger gets filed.
- [x] ≥44px targets; the subtask list lives in the sheet's scrollable body, never behind the fixed footer (`TASK-M12`).
- [x] en/nl/fr/ro.

## DESKTOP
- [x] **Out of scope.** The fence holds. Subtasks written on mobile are stored as ordinary `db-tasks` rows with a parent relation, so the desktop module shows them as normal tasks — **not wrong, just unaware.** Part C teaches it the relationship.

## VERIFY
1. Add three subtasks to a task in ≤3 taps each; the input stays focused between them.
2. The parent row shows `0/3`, then `2/3` as they are ticked.
3. **Subtasks do not appear as separate rows** in Today or All.
4. Completing all three does **not** auto-close the parent; the parent is marked as ready and closed by hand.
5. Assign the parent to a project → the subtasks follow.
6. A subtask cannot be given its own subtask.
7. Delete the parent → the three are **promoted to top-level**, with a message saying so.
8. Offline: add a subtask, it queues and is marked pending like any other write.
9. `npm run test:compile` · `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'`

## PROHIBITIONS
- **No nesting beyond one level.**
- **No back-reference array on the parent.**
- **No auto-completion of the parent.**
- **No cascade delete.**
- **No desktop changes.**
- **`prop-task-depends-on` stays deleted** — subtasks are not dependencies wearing a new name, and nothing here revives them.
