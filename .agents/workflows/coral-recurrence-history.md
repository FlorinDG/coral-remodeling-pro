# CORAL — RECURRENCE HISTORY — track the occurrences, read-only first — Planner 2026-09-17

**Florin, 2026-09-17:** *"A completed occurrence isn't a task — it's an event — agreed… let us start with some track of the done occurrences, albeit read-only, and develop after."*

Found on staging-pass item 9. **Not scheduled now** — sits behind promotion and `R1`.

---

## THE GAP
`prop-task-completed-at` is a **single value**, overwritten on every recurrence (`m/tasks/page.tsx:519`). **Each cycle destroys the record of the last one.** A monthly task has no history at all — *"when did I last do this"* is unanswerable.

## `REC-1` · APPEND-ONLY HISTORY 🟧 — the whole of step one
- [ ] **`prop-task-history`** — append-only array of `{ at, by }`. Written when a recurring task completes, **at the same moment** the due date rolls forward.
- [ ] **Keep `prop-task-completed-at`** as the current-cycle value. Don't overload one field with two meanings — the last entry of the history and "am I done right now" are different questions.
- [ ] **Read-only in the UI.** A list in the detail sheet: date, and who. Nothing editable, nothing re-openable.
- [ ] **Not subtasks.** Deliberately. An occurrence stored as a subtask would enter `subtaskProgress` (a monthly task reading `12/12`), be re-openable, grow unbounded (daily = 365/year), and appear in every list, board and perspective. **`lib/tasks/subtasks.ts` must not see these.**
- [ ] Desktop and mobile show the same list. **Same rule as subtasks: one concept, every surface.**

## `REC-2` · 🅿️ PARKED — occurrences as records
Florin's direction: *"a custom notion-like table, where every item in the checklist opens the corresponding record — there might be documents to append to the completion."*

**Worth noting where this lands:** an occurrence that owns documents **is a record**, and a record needs a database — which is the **custom-database work** (`coral-r1-tenancy.md` A5). **The two requests converge**, so `REC-2` costs much less once that exists, and building it before would mean building a bespoke table first.

- [ ] Reconsider **after** custom databases exist. `REC-1`'s array migrates into it cleanly — an append-only list of `{at, by}` is the degenerate case of the same thing.
- [ ] Attachments go through `storage.put` under a tenant-scoped key (`BLOB-3`), linked by key — **never a raw blob URL.**

## 🅿️ ALSO PARKED — multi-checklist subtasks (Trello-style named groups)
Raised alongside this, to stop recurrence history polluting subtask counts. **`REC-1` removes that reason** by not putting history in subtasks at all. So named groups become a want, judged on their own merits, **not a fix.** Noted, not scheduled.

## 🔴 SEPARATE FINDING — the recurrence anchor is MOBILE-ONLY
`grep -rn "recurrence-anchor" src/components/admin/tasks/` → **zero matches.** `TASK-M14` exposed *from due date* / *from completion* on mobile; **desktop always uses the default and offers no way to change it.**

Same two-surfaces-disagree shape as subtasks before `2.10-b`. **Add to the desktop task work** — not a new defect, an unfinished one.
