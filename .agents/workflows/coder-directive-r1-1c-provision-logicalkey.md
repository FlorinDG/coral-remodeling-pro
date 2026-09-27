# CORAL — CODER DIRECTIVE — `R1-1c` · provisioning must write `logicalKey` — Planner 2026-09-27

**`R1-1b` landed the column and a one-time backfill. It did not land the ongoing write.**

```
grep -n "logicalKey" src/lib/provisionTenantDbs.ts   →  nothing
```

**So every database provisioned from now on has the forward binding and no reverse key.** `roleOfDatabase` returns `null` for it, and `KERN-7b`'s conversions would be **silently wrong** for every tenant onboarded after today. *The primitive exists; the thing that should use it does not.*

---

# 1 · THE FIX — two lines, and they must be atomic with the create

```ts
// src/lib/provisionTenantDbs.ts — inside the create
const createdRow = await db.globalDatabase.create({
    data: {
        tenantId,
        logicalKey: role,               // 🔴 the reverse binding, written at birth
        name: SYSTEM_DATABASE_NAMES[role],
        …
    },
    select: { id: true },
});
```
- [ ] **`logicalKey: role` on creation.** 🔴 **Same statement as the row.** Not a follow-up update — a second step is a second chance to fail *(`WH-13b` is the record of what create-then-link produces)*.
- [ ] **A custom database still gets `logicalKey: null`.** Only `provisionLockedDatabases` sets it.

## `R1-1c.2` · Idempotency must verify, not assume
```ts
if (existing[role]) { ids[role] = existing[role]; continue; }   // 🔴 skips a BROKEN binding forever
```
**This is how `hr → db-hr` survived `KERN-5` pass 2.** The binding existed, so provisioning skipped it — **and the id it pointed at had no row.** Measured: 31 keyed databases where 32 were expected; the missing one is exactly that.

- [ ] **Skip only if the bound id RESOLVES to a row for this tenant:**
  ```ts
  if (existing[role]) {
      const ok = await db.globalDatabase.findFirst({
          where: { id: existing[role], tenantId }, select: { id: true },
      });
      if (ok) { ids[role] = existing[role]; continue; }
      // dangling binding — fall through and provision a replacement
  }
  ```
- [ ] **Backfill `logicalKey` on a resolving row that lacks it** — so existing tenants self-heal the reverse key the same way they self-healed the forward one.
- [ ] 🔴 **Report every dangling binding it repairs**, with the old id. **A silent repair of a broken binding is indistinguishable from a bug.**
- [ ] 🟨 **Still cheap when healthy:** one `findFirst` per role on a complete tenant. **If that is too much per layout render, do the resolve check in ONE query** — `findMany({ where: { id: { in: Object.values(existing) }, tenantId } })` — and compare the set. *(`KERN-5` pass 2's whole point was that the complete path costs nothing.)*

---

# 2 · VERIFY
1. **A fresh tenant:** all 16 databases created with **both** `lockedDbIds[role]` **and** `logicalKey = role`. 🔴 **`roleOfDatabase` answers correctly for every one** — that is the assertion that matters.
2. **A complete, healthy tenant:** provisioning is still a **no-op** — zero rows created, zero `Tenant` updates. *(The pass-2 guarantee; do not regress it.)*
3. 🔴 **The dangling case, which is live:** for `BV CORAL`, `hr` is bound to `db-hr` and no such row exists. Run provisioning on **staging** →
   - a new database is created for `hr`, with an opaque cuid and `logicalKey = 'hr'`
   - `lockedDbIds['hr']` is repointed to it
   - **the repair is reported, naming the old id `db-hr`**
   - 🛑 **the other 15 bindings are byte-identical** — `projects` still `db-1`
4. **Keyed count on staging: 31 → 32.**
5. **An existing resolving row that lacks `logicalKey` gains it**, without being recreated.
6. `eslint src --quiet` exit 0 · `npm run test:compile` exit 0 · suite exit 0, `fail 0`.
7. **No migration in this pass** — the column already exists. 🛑 **Schema untouched.**

## PROHIBITIONS
- 🛑 **Do not create the `db-hr` row by hand, in code or in SQL.** The self-heal is the mechanism; if it cannot repair this, it cannot repair the next one either.
- 🛑 **Do not delete the dangling `db-hr` binding in a migration.** Provisioning repoints it.
- 🛑 **No second write after the create.** `logicalKey` goes in the same statement.
- 🛑 **Do not touch `getLockedDbId` or the 74 parse sites.** `7b` / `3c`.

---

## 🔴 ORDER — and it matters
```
R1-1c lands  →  Florin loads /admin as BV CORAL  →  hr is repaired, count 31 → 32  →  KERN-7b unblocks
```
🛑 **Do NOT drop the `hr` key from `lockedDbIds` before `R1-1c` lands.** Provisioning would create the row, write the forward binding, and **leave `logicalKey` null** — the count would stay 31 and the hole would be reintroduced by the repair itself.
