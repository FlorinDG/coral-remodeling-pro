# CORAL — R1 CENSUS — the tenancy root, visible in production data — Planner 2026-09-16

**Source:** full `GlobalDatabase` census run by Florin on production, 2026-09-16. **22 databases, 2 tenants.** This is the census I said `R1` would need — it arrived early, from a question about custom grids.

---

## THE HEADLINE — the databases are in TWO populations, and only one is tenant-scoped

| Scoped — id carries a tenant suffix | Unscoped — **bare id, no suffix** |
|---|---|
| `db-clients-cmneyas2` / `-cmoa44mj` | `db-bestek` — **8,216 pages** |
| `db-invoices-cmneyas2` / `-cmoa44mj` | `db-articles` — 794 |
| `db-expenses-cmneyas2` / `-cmoa44mj` | `db-1` (Projects) — 72 |
| `db-quotations-cmneyas2` / `-cmoa44mj` | `db-tasks` — 68 |
| `db-suppliers-cmneyas2` / `-cmoa44mj` | `db-bobex` — 41 |
| `db-tickets-cmneyas2` / `-cmoa44mj` | `db-crm` — 24 |
| `db-payments-in-cmneyas2` | `db-journal-general` — 11 |
| `db-payments-out-cmneyas2` | `db-projects-hr` — **0** |

**Every bare-id database belongs to tenant `cmneyas2b…` — Florin's.** **9,226 pages** — the large majority of all data — sits in databases whose identity is a name the system treats as global.

**Tenant `cmoa44mjn…` exists today** and has six databases. It has **no** tasks, CRM, projects, articles, bestek, journal or bobex database of its own.

---

## 🔴 F1 · THE BARE FALLBACK IS FAIL-OPEN, AND IT RESOLVES TO FLORIN'S DATA

`lockedDbUtils.ts:62` — the last line of `getLockedDbId`:
```ts
return base; // Legacy FOUNDER fallback — bare IDs still work
```
**A tenant whose `lockedDbIds` is empty resolves `db-tasks` to `db-tasks` — which is Florin's, with 68 live rows.**

The self-healing branch above it saves the common case: tenant 2 has *some* mapped values, so `db-tasks` becomes `db-tasks-cmoa44mj`, which does not exist → an empty screen, not a leak. **The isolation currently holds by arithmetic on a string suffix, not by a boundary.**

**The window where it does not hold** is any tenant with `lockedDbIds = {}`: a newly created tenant before provisioning completes, a tenant whose provisioning partially failed, or any code path reading before the map is populated. In that window **every unscoped read returns the founder's data**, and every write lands in it.

**This is the same defect as `TenantContext.tsx:26`'s `resolveDbId: (base) => base`, in a second place, with the same comment justifying it.** Both are `R1-2`. **A fallback that silently returns another tenant's data is not a fallback, it is a leak with a comment.**

## 🔴 F2 · `db-projects-hr` IS ONE CLEANUP RUN FROM DELETION

| | |
|---|---|
| In `SYSTEM_DB_PREFIXES`? | **No** |
| In `BASE_TO_KEY`? | **No** |
| Name | **"New Workspace"** — on `GARBAGE_NAMES` |
| Pages | **0** → `safe: true` |

`schema-cleanup/route.ts:129` classifies it as garbage, and `:336` deletes garbage with zero pages. **Nothing stops it.** It survives only because nobody has run the cleanup.

It is empty, so no rows are lost — but it is a **registered surface for the HR projects module that exists in no list.** Deleting it means the module has no database and no provisioning path to recreate one.

- [ ] **Decide what `db-projects-hr` is**: a real system database (→ add to `SYSTEM_DB_PREFIXES` and `BASE_TO_KEY`) or dead (→ delete deliberately). **It must not remain in a state where a maintenance script decides for us.**

## 🟧 F3 · "New Workspace" is an unset display name on four databases
`db-crm` (24 pages) · `db-tasks` (68) · `db-bobex` (41) · `db-projects-hr` (0).

**For the three system ones this is cosmetic** — they are matched by **id**, never by name, so the sales/CRM module works fine. The risk is not today's behaviour, it is that **`GARBAGE_NAMES` matches on name**, so their protection is *"they happen to contain rows."* **Three load-bearing databases are protected by a page count.**
- [ ] Give them real names. Cosmetic fix, real safety margin.
- [ ] **Better: `schema-cleanup` must never consider a database in `SYSTEM_DB_PREFIXES` to be garbage, whatever it is called.** Identity comes from the id; the name is a label. *(It already skips system databases via `isSystemDatabase` — confirm that covers bare ids, since these have no suffix.)*

## 🟧 F4 · Tenant 2 is provisioned for six of sixteen databases
`cmoa44mjn…` has clients, invoices, expenses, quotations, suppliers, tickets. It has **no** tasks, crm, bobex, projects, articles, bestek, journal, payments-in, payments-out.

So for tenant 2 those modules resolve to `db-<base>-cmoa44mj`, which does not exist. **The user sees an empty screen with no explanation** — the not-loaded-vs-empty ambiguity, at the database level. *(`MEM-3`/`LAZY-2` fixed this for pages; the same confusion exists one level up.)*
- [ ] `provisionTenantDbs` must cover **every** base in `BASE_TO_KEY`, and **`R1` must verify provisioning completeness per tenant** rather than assume it.

---

## WHAT THIS CHANGES ABOUT `R1`

1. **`R1-1a` was specced as "reconcile the two system-database lists."** The census shows a **third** population: databases that are load-bearing but registered in neither list — `db-journal-general` and `db-projects-hr`. **The reconciliation is three-way.**
2. **`R1-1b` (`logicalKey` + backfill) is now measurable**: 8 bare-id databases carrying 9,226 pages must acquire a key and a tenant-scoped identity. **`db-bestek` alone is 8,216 rows** — the migration's cost is concentrated in one table and must be rehearsed on the Neon `staging` branch first.
3. **`R1-2` has two fail-open defaults, not one** — `TenantContext.tsx:26` and `lockedDbUtils.ts:62`. **Both die together or neither does.**
4. **The negative isolation suite has its first concrete case**: *a tenant with empty `lockedDbIds` must resolve nothing rather than resolve to the founder's databases.*

## WHAT IS **NOT** WRONG — stated plainly so the urgency is not overstated
- **No cross-tenant leak is occurring today.** Both tenants have populated `lockedDbIds`, so the suffix arithmetic keeps them apart.
- **No data is at risk right now.** `db-projects-hr` is empty; the cleanup refuses to delete anything with pages.
- **The scoped half of the estate is correct** — six databases are properly duplicated per tenant. **The pattern works; it was simply never applied to the other eight.**

**The exposure is conditional, and the condition is "onboard a tenant".** Which is the plan. **That is why `R1` comes before tenant #2, not after.**
