# PLANNER — UNATTENDED SESSIONS (Florin 2026-10-09)

Florin: "set up your unattended work sessions when i ask you to work unattended, and the coder gets a trigger on the
same time to restart the cron job." The coder's side is `coder-cron-protocol.md`, and its gate is
`.agents/tools/coder-cron-gate.sh`.

## Start (when Florin says "work unattended")
1. **The coder's switch.** In `CODER-QUEUE.md` § STATUS set `UNATTENDED: ON until <YYYY-MM-DD HH:MM>` (Florin's
   window; default 8 hours). Check the table: at least one row `GO`, and none waiting on a decision only Florin can
   make. Commit `docs(queue): unattended ON until …`, then push develop. The coder's next cron run sees it.
2. **My own runs.** `CronCreate`, recurring, every 45 minutes at off-minutes, prompt:
   *"Planner unattended run — follow .agents/workflows/planner-unattended.md § Each run."*
   - It is session-only: gone if the app closes, and it expires after 7 days.
   - Note the job id in the reply to Florin.
3. **Tell Florin** the window, the job id, and the rows marked `GO`. The coder needs one sentence: *"start the cron per
   .agents/workflows/coder-cron-protocol.md"*.

## Each run
1. `git fetch`. Develop's CI state, plus any new commits and reports since the last run.
2. **CI red** on develop: find the cause. Fix it if it is mine or a one-line obvious one (as with
   `Hr.employees.birthDate`); otherwise add a NEW correction row with the cause, first in the table.
3. **For each new `.agents/reports/<ITEM>.md`:**
   - Review every commit of that item against its directive and the binding rules (canonical layers, real-code tests
     with throw proofs, fences, dates, tenant scope).
   - Set the row to `ACCEPTED`. Corrections → a NEW row (own ID + `coder-directive-*.md` naming file:line) placed
     before the next item; the reviewed row is still `ACCEPTED` (the corrections carry on).
4. **Keep the coder fed.** If no row is `GO`, set the next `QUEUED` row to `GO` when it needs no decision from
   Florin. Never invent a new item for the coder; new items come from Florin, or from review findings written into a
   directive.
5. **Promote:**
   - `git log origin/main..<sha>`: every coder commit in the range must be `ACCEPTED`;
   - CI and the Vercel preview are green on that exact SHA;
   - no `prisma/` or package change in the range (otherwise list it for Florin);
   - then push `<sha>:refs/heads/main`.
6. **My own queue between reviews:** the Planner items in the plans (e.g. the export's batch door from R2-1-B, EDITOR-1
   E4–E7 up to Florin's package push), following the same rules. Never decide something marked `FLORIN`.
7. **Log** one line per run in `.agents/reports/UNATTENDED-LOG.md`: time · CI · reviewed · promoted · blocked on.
   Commit it with the run's changes.

## Never, unattended
- Run migrations, read `.env`, sign in anywhere, or push a schema or package range to main.
- Answer a `FLORIN` decision by inference. Write it under "Waiting on Florin" and move on.
- Delete data or send anything outside the repo (mail, Peppol, customers).

## Stop (Florin says stop, or the window ends)
- `CronDelete <job id>`.
- Set `UNATTENDED: OFF` in § STATUS, commit, push. The coder's runs then exit at the gate.
- Give Florin a summary from `UNATTENDED-LOG.md`: done, promoted, waiting on him.
