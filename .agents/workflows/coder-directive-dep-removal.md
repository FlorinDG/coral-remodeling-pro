# CORAL — CODER DIRECTIVE — `DEP-REMOVE` · delete task dependencies — Planner 2026-09-12

**Sequence position: `coral-execution-order.md` item `0.1`, now resolved. This runs BEFORE `1.2`.**

**Florin's decision, verbatim:**
> *"Remove it entirely. It does not sound like something that is going to catch too much of my time. I'd rather have subtasks than dependencies. And some blocked by / blocks logic can be built at any given moment, when we have time to develop a decisional matrix to embellish the software. But now, it can simply go and not consume resources."*

This supersedes the keep/revert/re-open options the Planner offered. **The whole dependency feature goes, not just the unrequested commit.**

---

## WHAT TO REMOVE

```
src/components/admin/tasks/DependencyEngine.ts        ← added by a2dc5ba — DELETE
src/components/admin/tasks/DependencyGraph.tsx        ← pre-existed; rewritten by a2dc5ba — DELETE
tests/task-dependencies.test.ts                       ← added by a2dc5ba — DELETE
```
Plus the render path:
```
src/components/admin/tasks/TaskModuleShell.tsx:18     import { DependencyGraph } from './DependencyGraph';   → remove
src/components/admin/tasks/TaskModuleShell.tsx:350    <DependencyGraph … />                                   → remove, with its view/tab entry
```
`TaskModuleShell.tsx` also reads `prop-task-depends-on` (it initialises it to `[]` at `:129`) — **remove that initialisation too**, so new tasks stop acquiring a field nothing reads.

**Prefer a clean removal over `git revert a2dc5ba`.** A revert would restore the *old* `DependencyGraph.tsx`, which is also going. Remove the feature in one commit.

## WHAT NOT TO TOUCH — ⚠️ read this twice

- [ ] **Do NOT delete stored `prop-task-depends-on` values.** Leave the property data exactly as it is in `GlobalPage.properties`. It is inert JSON, it costs nothing, and **removing a UI is reversible while deleting data is not.** No migration, no cleanup script, no backfill.
- [ ] **Do NOT remove the property from the `db-tasks` schema declaration** if it is declared — same reason.
- [ ] `src/app/actions/tasks.ts` and `src/components/admin/database/mockData.ts` also mention `prop-task-depends-on`. **Only remove references that exist solely to drive the deleted UI.** If a reference is doing something else, leave it and **say so in the report**.
- [ ] **Nothing else under `components/admin/tasks/`.** The desktop fence still holds; this directive is the exception and it is limited to the files named above.

## VERIFY
1. `grep -rn "DependencyGraph\|DependencyEngine" src` → **0 results.**
2. `grep -rn "prop-task-depends-on" src` → only references deliberately kept, each named in the report.
3. `/admin/tasks` opens and works, with the dependency view gone and no dead tab or empty panel left behind.
4. A newly created task does **not** get a `prop-task-depends-on` field.
5. An existing task that **has** stored dependency ids still opens normally — the data is ignored, not choked on.
6. ```bash
   npm run test:compile
   node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
   ```
   Baseline drops by the 126-line dependency suite; `tests/i18n.test.ts` stays pre-existing red.

**Commit:** `DEP-REMOVE: remove task dependency graph and engine (Florin: subtasks over dependencies)`

---

## THE RECORD — why, and what replaces it

Dependencies were **hand-maintained metadata in a screen you had to go looking for**: nothing enforced them, nothing propagated when a blocker closed, deleting a prerequisite silently dropped the link, and cycles were representable. Making that trustworthy was `DEP-0…5` — a decisional matrix's worth of work for a feature Florin would have to feed by hand.

**What Florin actually wants is subtasks** — *"prepare the site"* with four steps under it — which is a containment relationship, not a scheduling constraint. Different data shape, different UI, genuinely useful daily.

**`coral-task-dependencies.md` is WITHDRAWN.** Not parked — withdrawn. If blocked-by/blocks returns it will be designed fresh alongside the decisional matrix, and this removal costs nothing then, because **the stored `prop-task-depends-on` values are still there**.

**Subtasks are NOT authorised by this directive.** Logged as `TASK-SUBTASKS` for Part B/C scoping — do not start it.
