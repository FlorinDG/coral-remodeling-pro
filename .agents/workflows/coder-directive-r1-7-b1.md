# CODER DIRECTIVE — R1-7 · batch 1 · move 16 call sites onto the seraph

**Planner 2026-10-05.** Spec: `coral-r1-tenancy.md` §R1-7 ("migrate the call sites, module by module, smallest
first, one commit per module"). R1-4 (the scoped client) and R1-5 (the gate + ratchet) exist; this batch shrinks
the grandfathered list. §3a (THROW PROOF) and §3b (a fence is a wall) are binding.

**Do this AFTER `WH-7` M1 is pushed** (while the Planner reviews M1). No plan gate: this is mechanical — but every
STOP below is real.

## 🔴 Canonical logic — kernel → core → seraph (Florin: work that bypasses it is rejected)
The doors (`src/lib/data/scope.ts`, read it first):
- **`scopeFromSession()`** — every route below has a session. All reads and writes of tenant models go through the
  client it returns. The tenant is NEVER a parameter you pass; the client injects it (and THROWS on a model the
  SCOPE table cannot scope — `src/lib/data/scope-rules.ts`).
- **`platformDb()`** — ONLY for the `Tenant` row, and only `where: { id: <the session's tenantId> }`.
- No `systemScope` here (no cron/webhook in this batch). No `$queryRaw` (the scoped client does not expose it).
- Keep every existing role check and every existing `tenantId` condition in `where` (harmless; the client adds its
  own). Do not "simplify" any authorisation.

## The batch (16 files) — one commit per module, in this order
| Module | Files | Models |
|---|---|---|
| 1 · notifications | `src/app/api/notifications/route.ts`, `…/notifications/mark-read/route.ts` | Notification |
| 2 · calendar | `src/app/api/calendar/{accounts,events,portals,sync}/route.ts` | Account (via user), Event, Task (via portal), ClientPortal |
| 3 · tenant | `src/app/api/tenant/{accountant,cancel,expenses/approve,profile,project-access,projects-list}/route.ts`, `…/tenant/employees/route.ts`, `…/tenant/employees/[employeeId]/route.ts`, `…/tenant/users/route.ts`, `…/tenant/users/[userId]/route.ts` | Tenant (platform), User, Employee, UserProjectAccess, GlobalDatabase, GlobalPage |

Per file: replace `import prisma from '@/lib/prisma'` and every `prisma.X` with the right door. Then in the SAME
commit: remove the file from the R1-5 allowlist in `eslint.config.mjs` and lower `CEILING` in
`tests/seraph-gate.test.ts` by the number of files removed — from its CURRENT value (the Planner also removes files: 112 on 2026-10-05).

## 🛑 STOP and report (do not work around) when
1. A query must see **another tenant's** rows or a row before a tenant is known (e.g. a user looked up by e-mail
   across tenants, an invite accepted by token). That is a platform question — leave the file on the allowlist,
   write down the line, the Planner decides the door.
2. A model is **not** in the SCOPE table, or the scoped client throws `TenantMismatchError` / "cannot scope" in a
   case you believe is legitimate.
3. A `prisma.$transaction([...])` array: convert it to `db.$transaction(async tx => { … })` on the scoped client
   (see `src/lib/data/timesheet-invoicing.ts` for the pattern). If the order of writes would change, STOP.
4. Anything outside the fence below needs a change.

## Proof (§3a)
- The ratchet IS the proof that a file left the raw client: `tests/seraph-gate.test.ts` goes red if a migrated file
  stays listed, or if a listed file no longer imports `@/lib/prisma`. In your report, for ONE file per module, show
  the throw proof: re-add the file to the allowlist without the import → the test fails; restore.
- Each commit: `NODE_OPTIONS='--max-old-space-size=4096' npx tsc --noEmit` exit 0 · `npx eslint src` 0 errors ·
  `node --import ./tests/register.mjs --test 'tests/*.test.ts'` all green. Paste the counts.

## 🛑 FENCE
May change: the 16 files above · `eslint.config.mjs` (only removing these entries from the R1-5 allowlist) ·
`tests/seraph-gate.test.ts` (only `CEILING`) · the report. Everything else read-only — `src/lib/data/**`, the kernel,
other routes. No new dependency.

## Report
`.agents/reports/R1-7-B1.md` per `coder-report-protocol.md`: per file the before/after door, the STOPs (with
file:line), the three commits' check counts, the throw proofs. Committed last.
