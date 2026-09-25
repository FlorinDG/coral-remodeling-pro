# CORAL — CODER DIRECTIVE — `HRA` · the unguarded HR automations — Planner 2026-09-24

**`TSC-4` is verified and correct. This is what it did not cover, found while verifying it.**

`TSC-4` scoped `shift-tasks` and `shift-attachments`. **The same file reaches sideways into `ScheduledShift` from the `clock-entries` path, with an id the caller supplied and nobody checked.**

**The shape:** *the entity being written IS tenant-checked; the automation it triggers is not.* The guard is on the front door, and the automation goes through the wall.

---

# 1 · FOUR SITES — all in `src/app/api/hr/[entity]/route.ts`

| # | Line | What | Guarded? |
|---|---|---|---|
| `HRA-1` | **:464** | `scheduledShift.findUnique({ where: { id: data.shiftId } })` → inherits `projectId` onto the new clock entry | 🔴 **no tenant** |
| `HRA-2` | **:484** | clock-in → `scheduledShift.update(status: 'in-progress')` | 🔴 **no tenant** |
| `HRA-3` | **:676** | clock-out → `scheduledShift.update(status: 'completed')` | 🔴 **no tenant** |
| — | **:692** | all sibling tasks done → `scheduledShift.update(status: 'completed')` | ✅ **safe — `TSC-4b` verified the parent on POST.** *Leave it.* |

## What `HRA-2` / `HRA-3` actually permit
`clock-entries` **does** get `data.tenantId = ctx.tenantId` injected. **But `data.shiftId` is caller-supplied and never verified.** So:

> POST a clock entry carrying **another tenant's `shiftId`** → **their shift flips to `in-progress`, then to `completed`.**

The clock entry is correctly yours. **The side effect lands on them.** A worker's schedule, in another company, silently marked done.

## `HRA-1` — a read, and it writes what it read
`projectId` is copied off an unverified shift onto your own clock entry. **Another tenant's project identifier, persisted in your data**, and from there into timesheet reports.

## 🔴 ALL FOUR SWALLOW THE FAILURE
```ts
} catch { /* shift may not exist */ }
} catch { /* silent */ }
```
**If a scoped client later refuses one of these, the refusal is swallowed and the automation silently does nothing.** *(Same shape as `store.ts:545`, which is how the export-lock refusal reached the accountant. A refusal is not an error to be hidden — it is the answer.)*

---

# 2 · THE FIX — verify the parent once, reuse it

## 🔴 THE CLOCK ENTRY IS NEVER REFUSED — read this before writing the guard
**A clock-in is a worker's payable hours. The `shiftId` is metadata about it.** *(Planner's first draft returned **404** on an unresolvable `shiftId` and created nothing. That would have meant a worker with a stale or cached `shiftId` — shift deleted, rescheduled, offline app — **failing to clock in at all.** Trading payable hours to protect a linkage is the wrong trade, and on a construction site it is the expensive one. Corrected before handover.)*

> **RULE: an unresolvable `shiftId` drops the linkage. It never drops the entry.**

This closes the hole just as completely — the cross-tenant `update` is what leaks, and it simply does not run — while the worker's hours are always recorded.

- [ ] **In the `clock-entries` POST path, resolve the parent once, within the tenant:**
  ```ts
  let parentShift: { id: string; projectId: string | null } | null = null;
  if (data.shiftId) {
      parentShift = await prisma.scheduledShift.findFirst({
          where: { id: data.shiftId as string, tenantId: ctx.tenantId },
          select: { id: true, projectId: true },
      });
      if (!parentShift) {
          // 🔴 NOT a 404. The entry is real work and is always recorded.
          warnings.push('shift_not_found');   // surfaced on the response
          delete data.shiftId;                // no linkage, no automation, no leak
      }
  }
  ```
  🛑 **`delete data.shiftId` is the load-bearing line.** With it gone, `:484` / `:676` cannot fire on a shift the tenant does not own — **there is nothing left to reach with.**
- [ ] **`HRA-1`** — inherit from `parentShift.projectId`. **Delete the second `findUnique`.** *(Displacement: one lookup, not two.)*
- [ ] **`HRA-2` / `HRA-3`** — the `update` runs only when `parentShift` is non-null. **Add `tenantId: ctx.tenantId` to the `where` regardless**, so the guard survives a future refactor that moves the check.
  🛑 `update` cannot take a non-unique `where`. Use **`updateMany`** with `{ id, tenantId }` — a 0-row result is then the refusal, and it is *visible*.
- [ ] **All four `catch` blocks** — 🔴 **stop swallowing.** A caught error is `console.error`'d **and** the response carries a non-fatal `warnings: []` array naming what did not happen. **The clock entry still succeeds** — it is real work and must not be lost — but the user is told the shift status did not move.
- [ ] 🛑 **:692 is already correct. Do not touch it.**
- [ ] **Add `TODO(R1-4)`** at the new parent check, same wording as the other three. **The displacement count goes 3 → 4 in this route** and is driven to 0 by `R1-4`.

---

# 3 · VERIFY
1. `POST /api/hr/clock-entries` with a `shiftId` from another tenant → 🔴 **201, the clock entry IS created**, with `shiftId` null and `warnings: ['shift_not_found']`; **the other tenant's shift status is unchanged** *(check the row, not the response)*.
1b. Same with a `shiftId` that exists in no tenant at all (stale / deleted) → **identical behaviour. The worker clocks in.** 🛑 **A 404 here is a fail.**
2. Normal clock-in on your own shift → entry created, shift → `in-progress`, `projectId` inherited.
3. Clock-out → shift → `completed`.
4. A shift-task completing the set still flips the shift (`:692` path untouched).
5. Force the update to fail → **the clock entry is still created** and the response carries a warning. 🛑 **A swallowed failure is a fail.**
6. `npm run validate` exit 0 · `eslint src --quiet` zero errors · suite green.
7. **Report the `TODO(R1-4)` count in this route: expect 4.**

> # 🔴 PLANNER CORRECTION 2026-09-24 — THE SINGLE-TENANT CAVEAT BELOW IS WRONG
> **There are TWO tenants in production and on staging:** `BV CORAL ENTERPRISES` and `Murgu, Catalin`.
> The Planner asserted a single tenant **without querying**, and wrote that caveat into two directives.
> **Cross-tenant behaviour IS observable and SHOULD be tested directly.** The holes closed by `TSC-4a/b` and
> `HRA-1…3` were live against a real second tenant's data, not a hypothetical one.
> *(Fourth instance in one session of stating a data fact without checking it — see `pd.md` §5b.)*

## 🔴 SINGLE-TENANT CAVEAT — carried over from `TSC-4`
**Staging has one tenant, so none of 1–3 can demonstrate cross-tenant behaviour.** What a single-tenant run proves: the 404, the absent row, the unchanged status, and that normal clock-in/out still works. **Do not report "no cross-tenant leak observed."** *(ZOMBIE RULE.)*

---

## 🟢 WHY THIS CLASS KEEPS APPEARING
Every one of these is a **write to a model other than the one the request names**. The request-level guard checks the named entity; the automation reaches past it. **No amount of care at the route fixes a pattern this easy to reintroduce** — `TenantScopedClient` does, because `scheduledShift.update` simply stops being reachable without a scope.

****`HRA-1…4` is a patch**. `R1-4` is the fix.** *(Displacement rule — and this directive adds a fourth thing for it to delete.)*
