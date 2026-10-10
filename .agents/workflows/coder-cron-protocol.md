# CODER CRON PROTOCOL — how the coder works on its own (Florin 2026-10-09)

Florin: "the coder … check for work on his own, and check if it was verified and get next item on his own, in a .md
file you manage." This file is the coder's STANDING INSTRUCTION. Read it at the start of every run.

## The one file
`.agents/workflows/CODER-QUEUE.md` — the **STATUS** block at its top. **The Planner is its only writer.** The coder
NEVER edits `CODER-QUEUE.md`, `board-v2.md`, `.agents/plans/**` or any `coder-directive-*.md`. The coder reports in
exactly two ways:
- the commit message, which starts with the item ID, e.g. `fix(review-fix-1): A1 — …`;
- the report file `.agents/reports/<ITEM-ID>.md`, committed last. When this file exists, the item is DONE.

## One-time setup: your own worktree
The Planner works in the live tree (`coral-remodeling-pro`). Never work there.
```bash
git -C /Users/florin/Documents/GitHub/coral-remodeling-pro worktree add ../coral-coder -b coder/work origin/develop
```
Work only in `/Users/florin/Documents/GitHub/coral-coder`. Install dependencies there once (`npm ci`).

## Every run (cron: every 30 minutes, at :07 and :37)
1. **Sync.** In `coral-coder`: `git fetch origin`, then `git rebase origin/develop`. If the rebase conflicts, abort it
   and STOP; write the conflict into `.agents/reports/CRON-BLOCKED.md` and push it.
2. **Ask the gate**, the ONLY decision of whether and what to work:
   ```bash
   .agents/tools/coder-cron-gate.sh
   ```
   - `WAIT <reason>` (exit 1): **end the run now and do nothing.** Causes: the switch is OFF or its window has ended;
     develop's CI is red or still running; your last item is done and awaits the Planner's review; no row is `GO`.
   - `WORK <ITEM> | <state> | <directive>` (exit 0): build exactly that item. Review corrections arrive as a NEW row
     with their own ID and directive (e.g. `REVIEW-FIX-1`), placed before the next item.
   The gate reads the STATUS block from `origin/develop`, never a local copy. Do not second-guess it, and do not pick
   anything else.
3. *(folded into the gate)*
4. **Read the directive completely** before the first edit.
5. **Build it as the directive says.**
   - One commit per step, with the step ID in the message.
   - Every new test gets a throw proof (break the real code, show it fail, restore).
   - `npx tsc --noEmit`, the full `node --import ./tests/register.mjs --test 'tests/*.test.ts'` suite and
     `npm run lint` are green before every push.
6. **Push to develop:** `git push origin HEAD:refs/heads/develop`. If rejected, fetch, rebase and retry once; then STOP.
7. **Write the report** `.agents/reports/<ITEM-ID>.md` per `coder-report-protocol.md`. Commit it last, push, and END
   THE RUN. **One item per run.**

## Never
- Push to `main`. Promotion is the Planner's, or Florin's for a schema or package range.
- Run a migration, `prisma db push` or `migrate dev`, or read `.env`.
- Leave a `prisma/` or package change unflagged. That commit goes on develop alone; the report says
  "Florin pushes this range", and you STOP.
- Bend a directive. A blocked step is STOPPED and written in the report, never worked around (§3b).
- Touch a file outside the directive's fence, or "improve" something you noticed. Write it in the report instead.
- Edit the STATUS block or any Planner file.

## Turning it on and off
Florin starts both sides at the same moment:
- he tells the Planner "work unattended", and the Planner sets `UNATTENDED: ON until <time>` and pushes;
- he tells the coder "start the cron per coder-cron-protocol.md".

**Auto mode** (`UNATTENDED: AUTO idle 30`): the gate itself says WORK once Florin has been away 30 minutes and WAIT
as soon as he is back. Nothing changes for you: keep the cron running and obey the gate.

Your cron may keep running all the time: while the switch is OFF, every run exits at step 2.
