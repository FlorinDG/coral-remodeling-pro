# CODER DIRECTIVE — R2-1-B · the remaining direct record writes onto the one door — PLAN REQUEST

**Planner 2026-10-05. Gate 1 only: write the PLAN (`.agents/plans/R2-1-B.md`) per `coder-report-protocol.md` §0,
push, STOP.** §3a (THROW PROOF) and §3b (a fence is a wall) are binding.

## Where we are
The ONE record write door exists and is live (dfdf1ddb):
- rule, pure: `src/lib/records/record-intent.ts` (`applyRecordIntent`, `intentFromPage`, `deleteRefusal`);
- door: `src/lib/data/records.ts` — `saveRecord(db, intent, { by, meta?, createIfMissing? })`, `deleteRecord(db, id)`
  — on a SCOPED client, one serializable transaction, persisted state returned;
- already adapters: `saveGlobalPage`, `saveGlobalPagesBatch`, `deleteGlobalPage` (global-databases.ts),
  `createPageServerFirst`, `updatePageServerFirst` (pages.ts).

Your census (`.agents/reports/R2-1-CENSUS.md` §8, 36 writes) is the input. Rows 1–5 are done. Several others were
already moved to a scoped client by the Planner (accept-*, scan, portal tasks, crons, quote-service, export,
timesheet-invoicing, quote-revision) — **re-measure at your Start SHA**; the census table is a starting point, not
the truth.

## The work
Every remaining direct `GlobalPage` write (`(prisma|db|tx).globalPage.(create|update|upsert|delete…)` outside
`src/lib/data/records.ts`) becomes a call to `saveRecord` / `deleteRecord`, or is justified in writing (one line
each in the plan: why it must stay direct — e.g. a multi-row transaction that also writes other tables).

## 🔴 Canonical logic — kernel → core → seraph
- **The door's scoped client comes from the caller's door**: `scopeFromSession()` (a session), `systemScope(tenantId,
  reason)` (cron / webhook / job — the reason names the job), `portalScope(access)` (a verified portal). Never the raw
  client, never a tenant id passed around by hand.
- **`by`** is the system-write tag the census recorded (`'system:peppol'`, `'system:cron-overdue'`, …) or the user id.
- **Only changed fields** in `intent.fields` — a writer that today spreads `{ ...page.properties, x }` sends `{ x }`.
- A refusal from the door (`EXPORT_LOCKED`, `DOCUMENT_LOCKED`, `STALE_WRITE`, `NOT_FOUND`) is HANDLED at the call
  site and said (log for jobs, an error for users) — never swallowed.
- No new rule outside `lib/records`. If a writer needs a rule the door lacks: STOP and say so in the plan.

## Your plan must contain
1. The re-measured list (file:line) — each with: door (session / system / portal), `by`, intent fields, fate
   (adapter / justified), and the refusal handling.
2. For each module: the test that proves the adapter (node:test, throw proof) — where the writer has logic worth
   testing, extract it as a pure function first (lib/records) and test that.
3. Milestones (one module per commit) and what Florin can click through.
4. Open questions.

## 🛑 FENCE
Later milestones may change: the files that hold the writes, `tests/*` (new tests), the R1-5 allowlist entries
(remove only) and `CEILING` (lower only, from its current value). Read-only: `src/lib/data/records.ts`,
`src/lib/records/record-intent.ts`, `src/lib/data/scope*.ts`, the kernel, the store. If you need a change there:
STOP and say so in the plan.
