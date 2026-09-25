# CORAL — CODER DIRECTIVE — `KERN-5` pass 1 · one vocabulary, complete provisioning — Planner 2026-09-24

Governed by `coral-kernel-system-databases.md`. **This is `K1` + `K2` only.** It is **purely additive**: no call site changes, no resolver changes, no deletions of existing data.

🛑 **`getLockedDbId` is NOT touched in this pass.** It is deleted in pass 3, after Florin's backfill. Removing it now turns a silently-empty tenant into a hard error.

---

# WHY — measured, production + staging

| | |
|---|---|
| Roles `BASE_TO_KEY` knows | **16** |
| Roles `LOCKED_DB_BASES` provisions | **8** |
| Roles bound for tenant `Murgu, Catalin` | **6** |

**`projects` is known but never provisioned.** `BV CORAL`'s `db-1` was made by hand in the founder era. **Every tenant onboarded since gets no projects database**, and the resolver covers by synthesising `db-1-<suffix>` — an id for a database that has never existed.

**Three lists for one concept.** *(Defect shape #1.)*

---

# `K1` · ONE VOCABULARY

- [ ] **Create `src/lib/kernel/system-databases.ts`:**
  ```ts
  export const SYSTEM_DATABASE_ROLES = [
    'invoices','clients','suppliers','expenses','tickets','quotations',
    'payments-in','payments-out','projects','tasks','articles','crm',
    'bobex','bestek','journal-general','hr',
  ] as const;
  export type SystemDatabaseRole = typeof SYSTEM_DATABASE_ROLES[number];
  export const SYSTEM_DATABASE_NAMES: Record<SystemDatabaseRole, string> = { … };
  ```
- [ ] **`LockedDbKey` becomes an alias of `SystemDatabaseRole`** — do not maintain two unions.
- [ ] **`LOCKED_DB_BASES` and `DB_NAMES` are deleted**, their content absorbed. **`BASE_TO_KEY` stays for now** — pass 3 removes it with the resolver.
- [ ] 🔴 **Exactly one array may list the roles.** A second is the bug returning.
- [ ] 🛑 **No prisma import in this file.** It is kernel; the `R1-5` gate is `error` and it must not join the allowlist.

## Name the 16 correctly
The eight provisioned names are known (`Sales Invoices`, `Contacts`, `Suppliers`, `Purchase Invoices`, `Expense Tickets`, `Quotations`, `Received Payments`, `Paid Payments`). For the other eight, **take the names from `BV CORAL`'s existing rows** — `Projects`, `Material Articles`, `Bestek Templates`, `General Journal`. 🛑 **Three currently read `New Workspace` (`db-tasks`, `db-crm`, `db-bobex`) — do NOT copy that. Name them `Tasks`, `CRM`, `Bobex`** and note it in the report; renaming the founder's existing rows is a separate, Florin-gated change.

---

# `K2` · PROVISION ALL SIXTEEN, WITH OPAQUE IDS

- [ ] **`provisionLockedDatabases` iterates `SYSTEM_DATABASE_ROLES`.** 🔴 **`projects` gets provisioned — that is the point of this pass.**
- [ ] 🛑 **Delete `const suffix = tenantId.slice(0, 8)` and the `${base}-${suffix}` construction.** New ids are **`cuid()`**. A tenant's id must not be recoverable from its databases' ids.
- [ ] 🔴 **Idempotency is by BINDING, not by constructed id:**
  ```ts
  for (const role of SYSTEM_DATABASE_ROLES) {
      if (existing[role]) { ids[role] = existing[role]; continue; }   // already bound — leave it
      const id = cuid();
      await db.globalDatabase.create({ data: { id, tenantId, name: SYSTEM_DATABASE_NAMES[role], … } });
      ids[role] = id;
  }
  ```
  🛑 **Never `findUnique` on an id you built from a pattern.** That is the defect this pass removes.
- [ ] **Read the tenant's current `lockedDbIds` first and preserve every existing binding byte-for-byte.** 🛑 **`BV CORAL`'s `db-1` must survive untouched.** Re-running provisioning on a fully-bound tenant is a **no-op**.
- [ ] 🟨 **Provisioning is not entitlement.** All 16 are created; `activeModules` decides what may be *used*. A free tier without a projects database is broken, not limited.

---

# VERIFY

1. **Idempotence on the founder — the critical test.** Run provisioning for `BV CORAL` on **staging**:
   - all 16 bindings present afterwards,
   - 🛑 **`projects` still `db-1`**, `clients` still `db-clients-cmneyas2` — **every pre-existing binding byte-identical**,
   - **`hr` binding unchanged** *(it points at a non-existent `db-hr`; that is Florin's to resolve, not this pass's)*,
   - `GlobalDatabase` row count for that tenant **unchanged**.
   **Report the before/after binding map.**
2. **A tenant missing roles gains them.** Run for `Murgu, Catalin` on **staging**: 6 bindings → **16**; the 10 new rows carry **`cuid` ids with no tenant suffix**; the original 6 are untouched.
3. **New-tenant path:** a fresh signup provisions 16, **every id a bare `cuid`**. 🛑 **Assert no new id contains `tenantId.slice(0,8)`.**
4. `grep -c "tenantId.slice"` in `provisionTenantDbs.ts` → **0**.
5. **Exactly one array lists the roles** — `grep` for `LOCKED_DB_BASES` and `DB_NAMES` returns nothing.
6. `npm run validate` exit 0 · `eslint src --quiet` **0 errors** · suite green.
7. **A unit test** in `tests/` asserting `SYSTEM_DATABASE_ROLES.length === 16` and that `SYSTEM_DATABASE_NAMES` has an entry for each. *(Cheap, and it is the vocabulary's ratchet.)*

## PROHIBITIONS
- 🛑 **Do not touch `getLockedDbId`, `resolveDbId`, `TenantContext`, or any of the 54 `'db-1'` literals.** Pass 3.
- 🛑 **Do not rename or re-id any existing `GlobalDatabase` row.** Additive only.
- 🛑 **Do not run provisioning against production.** Florin does that, after reviewing the staging result.
- 🛑 **No migration.** `lockedDbIds` is an existing JSON column.

---

## WHAT THIS UNBLOCKS
After Florin backfills both tenants, **every role resolves for every tenant** — which is the precondition for pass 3 deleting `getLockedDbId` and its four fallbacks, including `return base // Legacy FOUNDER fallback`.

**The founder exception is removed by making the founder's data canonical, not by keeping a branch for it.**
