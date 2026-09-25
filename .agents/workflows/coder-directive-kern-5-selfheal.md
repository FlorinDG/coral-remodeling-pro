# CORAL — CODER DIRECTIVE — `KERN-5` pass 2 · provisioning self-heals — Planner 2026-09-25

Governed by `coral-kernel-system-databases.md`. **Pass 1 (`759477a`) is verified and correct.** This pass makes it *reach* the tenants.

---

# THE GAP — pass 1 fixed provisioning, and nothing calls it

Provisioning is wired into **three** layouts (`admin`, `workhub`, `m`) — always behind the same guard:

```ts
const persistedIds = tenant?.lockedDbIds as Record<string, string> | null;
if (persistedIds && Object.keys(persistedIds).length > 0) {
    lockedDbIds = persistedIds;                                   // 🔴 Murgu: 6 keys — truthy, forever
} else {
    lockedDbIds = await provisionLockedDatabases(tenantId, prisma);
}
```

**A PARTIALLY bound tenant never provisions.** `Murgu, Catalin` has 6 of 16 and takes the first branch on every request, permanently.

**The guard was correct when it was written** — provisioning was not idempotent, so re-running would have duplicated rows. **Pass 1 made it idempotent by binding. The guard is now the only thing preventing self-repair**, and it is why there is no way to run provisioning from the UI: *there was never meant to be one.* **The app heals itself, or it does not heal.**

---

# `K4` · MAKE THE COMPLETE PATH FREE

🔴 **Do this FIRST.** Called unconditionally as it stands, `provisionLockedDatabases` writes `tenant.update` on **every layout render**.

- [ ] **Track whether anything was created. Persist only if it was:**
  ```ts
  let created = 0;
  for (const role of SYSTEM_DATABASE_ROLES) {
      if (existing[role]) { ids[role] = existing[role]; continue; }
      … create … ; ids[role] = createdRow.id; created++;
  }
  if (created > 0) {
      await db.tenant.update({ where: { id: tenantId }, data: { lockedDbIds: ids } });
  }
  return ids;
  ```
- [ ] 🟢 **A fully-bound tenant then costs sixteen map lookups and ZERO queries.** That is what makes calling it on every render acceptable.
- [ ] **Return `ids` either way.** The caller must not care whether work happened.

# `K5` · DELETE THE GUARD IN ALL THREE LAYOUTS
- [ ] `src/app/[locale]/admin/layout.tsx:~132` · `workhub/layout.tsx:~92` · `m/layout.tsx:~92`
  ```ts
  lockedDbIds = await provisionLockedDatabases(tenantId, prisma);   // unconditional
  ```
- [ ] 🛑 **All three, or the tenant heals on one surface and not another** — and which surface they landed on becomes load-bearing. *(Three call sites, one behaviour: the `TSC-4` lesson.)*
- [ ] **Keep the surrounding `try/catch`.** 🔴 **A provisioning failure must not white-screen the layout** — log it, fall back to whatever bindings exist, let the page render degraded. *(Same principle as `HRA`: the user's work is not refused because a side effect failed.)*

# `K6` · THE SAME RULE, STATED ONCE
- [ ] Add to `provisionTenantDbs.ts`:
  > *"Call this unconditionally. It is idempotent by binding, writes nothing when the tenant is complete, and is the ONLY repair path for a partially-bound tenant. Do not guard it — a guard on `lockedDbIds` being non-empty is what kept `Murgu, Catalin` at 6 of 16 roles indefinitely."*

---

# VERIFY — on staging

1. **Complete tenant is free.** Load `/admin` as `BV CORAL` with query logging on:
   **zero `GlobalDatabase` inserts, zero `Tenant` updates.** 🛑 **A `tenant.update` here is a fail.**
2. **Partial tenant self-heals.** Reset a staging tenant's `lockedDbIds` to 6 roles, load any of the three layouts → **16 bindings after**, the original 6 **byte-identical**, 10 rows created.
3. **Second load after healing is free** — repeat check 1 against that tenant. **Zero writes.**
4. **All three surfaces heal.** Repeat check 2 once per layout — `/admin`, `/workhub`, `/m`. 🛑 **Report all three separately.**
5. **Failure is survivable.** Force `provisionLockedDatabases` to throw → **the layout still renders**, the error is logged, no white screen.
6. `npm run validate` exit 0 · `eslint src --quiet` **0 errors** · suite **186 pass / 13 red** *(the 13 are `TSC-9`'s `NOT_IMPLEMENTED` — unchanged)*.
7. **Allowlist still 121.** These are existing prisma importers; none may be added.

## PROHIBITIONS
- 🛑 **Do not touch `getLockedDbId`, `BASE_TO_KEY`, `resolveDbId` or the 54 `'db-1'` literals.** Pass 3.
- 🛑 **Do not run anything against production.** Florin loads a page; that is the whole procedure.
- 🛑 **No admin UI, no script, no endpoint.** 🔴 **If a tenant needs a human to run a repair, the repair is in the wrong place.**

---

## WHAT THIS ANSWERS
> **Florin:** *"how do i run provisioning? there is no process in the ui."*

**There is no process because there should not be one.** After this pass, **Florin loads `/admin` once as each tenant and both are repaired** — and every tenant onboarded afterwards is complete from the first page view, including the `projects` database that `PROJ-0` and the whole free-tier-per-prospect model depend on.
