# CORAL — R5 · SCHEDULED WORK ROOT — one job per tenant, not one job over all tenants — Planner 2026-09-13

**Florin, 2026-09-13:**
> *"So we are doing kernel work already. The reminder workflow starts as kernel (whatever script is the reminder itself made of), goes to core — a function, a building block that gating can use, and not have one job scar 100 tenants, but 100 jobs scanning their gated tenant."*

**Accepted, and it is a root — not a detail of the reminder feature.** This is `R5`, the fifth root alongside `R1` tenancy, `R2` write path, `R3` grid, `R4` document engine. `R2`'s question is *"how does a write reach the database?"*; **`R5`'s is *"how does work that no user started reach the database?"*** — and today it has no answer, so every cron invents one.

---

## THE INVERSION, IN ONE LINE

| | |
|---|---|
| **Today** | one job, one process, **reads across all tenants**, hand-rolls its own scoping |
| **`R5`** | the scheduler fans out **one scoped run per tenant**; a job body **cannot see another tenant** because it is never handed one |

**The difference is not performance. It is blast radius.** A job that walks every tenant has, by construction, the authority to damage every tenant — so a mistake in a job body is a **cross-tenant** mistake. A job body that receives one tenant's scope can only ever be wrong about that tenant. **Florin's phrasing is exact: one job scarring 100 tenants, versus 100 jobs each scanning their own.**

---

## 🔍 THE EVIDENCE — four cron routes, four different answers to the same question

```
src/app/api/cron/invoice-overdue/route.ts     122 lines
src/app/api/cron/reminders/route.ts           111 lines
src/app/api/cron/trial-check/route.ts          42 lines
src/app/api/cron/trial-notifications/route.ts  42 lines
```

- **`reminders`** — `prisma.globalPage.findMany()` with **no `where` at all.** Every page of every tenant, then `JSON.stringify` per page. **The worst of the four, and the newest** — which is the point: with no primitive to reach for, each new job re-derives scoping from scratch, and the quality is whatever that day's attention allowed.
- **`invoice-overdue`** — **better**: resolves databases first, then pages per database, and reads `tenantId` off the relation. **Still one process walking every tenant**, still hand-rolled, still its own loop.
- **`trial-check` / `trial-notifications`** — thin wrappers over service functions; the traversal lives deeper.

**Four routes, four hand-rolled traversals, four different scoping qualities. This is defect shape #1 at the job layer** — the same shape as three blob readers, five write doors, four line readers. **We have been finding it leaf by leaf; Florin has found it at the root.**

---

## THE LAYERS — where each piece lives

Per the inverted pyramid: **calls go down only; each capability exists once, at the lowest layer that can hold it.**

### L0 · KERNEL — `lib/kernel/tenant-job.ts`
The primitive. Knows nothing about reminders, invoices or trials.
```ts
export interface TenantJobContext {
    tenantId: string;
    db: TenantScopedClient;      // ← cannot reach another tenant. not "should not". CANNOT.
    now: Date;
    logger: JobLogger;
}

export type TenantJob = (ctx: TenantJobContext) => Promise<JobResult>;

export async function runForEachTenant(
    job: TenantJob,
    opts: { name: string; concurrency?: number; tenantFilter?: TenantFilter }
): Promise<JobRunSummary>;
```
- [ ] **`db` is a scoped client, not a raw `prisma`.** A job body that can import `prisma` directly has learned nothing. **Scoping is a capability the job is *given*, never one it is *trusted to apply*.** This is `R1`'s principle — scope at the boundary — applied to work with no user attached.
- [ ] **One tenant's failure never stops another's.** Failures are collected and reported per tenant; the run continues. **A tenant whose data trips a bug must not silence 99 others' reminders.**
- [ ] **Bounded concurrency.** 100 tenants must not open 100 simultaneous connection pools.
- [ ] **Per-run, per-tenant record: started, finished, items processed, outcome.** Without it, *"did it run for this tenant?"* is unanswerable — and that is the first question asked when a customer says a reminder never arrived.

### L1 · ERP CORE — `lib/jobs/`
The registry and the entry point. One HTTP route shape for all scheduled work: authenticate `CRON_SECRET` **once**, resolve the job by name, call `runForEachTenant`, return the summary.
- [ ] **`CRON_SECRET` verification exists once**, not copied into four routes. *(It is currently copied, and in `reminders` it is skipped entirely when the variable is unset — a job endpoint that is **open when misconfigured**. Fail closed.)*
- [ ] Registry maps a job name to its body and schedule, so the set of scheduled work is **readable in one file** instead of inferred from `vercel.json` plus four directories.

### L2 · MODULES — the job bodies
- [ ] `jobs/reminders.ts` · `jobs/invoice-overdue.ts` · `jobs/trial-check.ts` · `jobs/trial-notifications.ts`
- [ ] Each is **a function of one tenant's context**. No HTTP, no auth, no traversal, no `prisma` import. **Directly unit-testable** — which none of the four is today.

### THE GATE
- [ ] **CI fails if any file under `app/api/cron/` imports `prisma` directly**, or if any job body does. **The kernel is closed by a build gate, not by discipline** — the `BLOB-3` rule, applied at a new layer before the copies accumulate rather than after.

---

## WHAT THIS CHANGES ABOUT `REM-2`

**`coral-task-reminders.md` `REM-2` is now the first CONSUMER of `R5`, not a route that fixes itself.**
- `D1` (unfiltered cross-tenant `findMany`) stops being a bug to fix and becomes **impossible to express**: the job body is handed a scoped client and never sees the others.
- The `*/5 * * * *` schedule and the indexed predicate stay exactly as specced — **they are now per-tenant**, which is what makes 288 runs a day affordable at 100 tenants instead of ruinous.
- **Florin's sequencing is right: build the primitive, then the reminder rides it.** Writing the reminder first and extracting the primitive later means writing it twice, and the second write happens under the pressure of the first tenant complaint.

---

## SEQUENCING — 🛑 **FLORIN DECISION, and there is a real trade-off**

`R5` **depends on `R1`.** A scoped client is only meaningful once `R1-2`'s fail-closed resolver exists — until then, "scoped" is the `(base) => base` default wearing a uniform. So the clean order is **`R1` → `R5` → `REM`**.

**But that puts reminders a long way out**, and Florin wants them working. Three honest options:

| | What it means | Cost |
|---|---|---|
| **(a) `R1` → `R5` → `REM`** | Correct order, no rework. | Reminders wait for the whole tenancy root. |
| **(b) `R5` kernel first, `R1` after** | Build `runForEachTenant` now; the scoped client initially wraps today's resolver and tightens when `R1-2` lands. | The primitive's guarantee is **partial until `R1`** — real, but not yet enforced. **It must be labelled as such in the code, not quietly assumed.** |
| **(c) `REM` as a one-off now, `R5` later** | Fastest reminders. | **Writes a fifth hand-rolled traversal** — the exact thing this spec exists to stop. **The Planner recommends against it**, and would rather say so than have it chosen by default. |

**Planner recommendation: (b).** The kernel shape is the expensive thinking and it does not change when `R1` lands; only the strictness of the scoped client does. It gets the primitive in before a fifth copy exists, and `REM` rides it from day one — but **the partial guarantee must be written into the file, not remembered.**

---

## PROHIBITIONS
- **No job body imports `prisma`.** It receives a scoped client.
- **No new file under `app/api/cron/` that traverses tenants.** The fifth copy does not get written.
- **No `CRON_SECRET` check that passes when the variable is unset.** Fail closed.
- **No job that aborts the whole run because one tenant failed.**
- **No unbounded concurrency.**
- **`R5` does not start before promotion** — `coral-execution-order.md` Phase 3 block applies to every root equally.
