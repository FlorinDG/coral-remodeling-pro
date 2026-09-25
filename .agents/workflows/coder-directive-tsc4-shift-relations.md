# CORAL — CODER DIRECTIVE — `TSC-4` · the two undeclared shift relations — Planner 2026-09-24

**`TSC-0` classified these as "Class C — FK present, relation not declared" and called them a tiny blocker.** Measured against the routes, they are not only a blocker. **The missing relation is the direct cause of a live cross-tenant read and a live cross-tenant write.**

**Nothing here is speculative. Every claim below was read out of the repo at `b68b2ea`.**

---

# 0 · 🔴 THIS DIRECTIVE SHIPS IN TWO PARTS. DO NOT DO THEM TOGETHER.

| Part | Contents | Depends on | Hand over |
|---|---|---|---|
| **`TSC-4-NOW`** — §1, §4a | Close the read hole and the write hole. **No schema change. No migration. No database access.** | nothing | **immediately** |
| **`TSC-4-SCHEMA`** — §3, §4b | Declare the relations, make the scoping structural | ✅ **census CLEARED 0 / 0 — see §2** | **unblocked** |

**Why this order and not the other one.** The holes are fixable today with the check `PATCH` already performs — `prisma.scheduledShift.findFirst({ where: { id, tenantId } })` — which needs no relation. **A P0 tenancy fix must not wait behind a foreign-key migration against live data.** The relation, when it lands, then *replaces* the improvisation rather than being the precondition for it. *(Displacement rule, applied to the sequencing.)*

🛑 **The coder does not touch `prisma/schema.prisma` in `TSC-4-NOW`.** If the schema is modified in that commit, it is rejected.

---

# 1 · WHAT THE MISSING RELATION ACTUALLY COSTS

`src/app/api/hr/[entity]/route.ts` is a generic entity router. It lists three models as **`noTenantEntities`** — scoped "via parent" rather than by `tenantId`:

```
team-members · shift-tasks · shift-attachments
```

**`team-members` is correctly scoped. The other two are not. The difference is the `@relation`.**

```ts
// :123  team-members — SAFE, in BOTH branches
where.team = { tenantId: ctx.tenantId };      // ✅ expressible: HrTeamMember.team is declared

// :119  shift-tasks / shift-attachments — the parent is UNREACHABLE
const shiftId = url.searchParams.get('shiftId');
if (shiftId) where.shiftId = shiftId;          // 🔴 and if it is absent? where = {}
```

You cannot write `where: { shift: { tenantId } }` for a relation Prisma does not know exists. **So the route did the only thing it could, and the only thing it could is not enough.**

## 🔴 `TSC-4a` — cross-tenant READ
`GET /api/hr/shift-tasks` **with no `shiftId`** → `where = {}` → **every tenant's shift tasks.** Same for `shift-attachments`, whose rows carry `url` — blob links to other tenants' files.
- **Authentication is required; tenancy is not.** Any signed-in user of any tenant.
- 🟢 **Not exercised by the UI.** All six call sites (`useTasks.ts:171`, `useScheduleAttachments.ts:32`, …) pass `shiftId`. **It is reachable by hand, not by accident** — which is why the fix carries no UI risk.

## 🔴 `TSC-4b` — cross-tenant WRITE, and this one is worse
`POST` skips `tenantId` injection for these entities (`:383-386`) and **never verifies the parent shift.**

| Door | Parent verified? |
|---|---|
| `PATCH` `:410` | ✅ `findFirst({ id: existing.shiftId, tenantId })` |
| `DELETE` `:~500` | ✅ same check |
| **`POST`** | **🔴 nothing** |

A client POSTs `{ shiftId: "<another tenant's shift>" }` and **attaches a task, or a file, to a shift it does not own.**

**Defect shape #1, exactly: three write doors, two check, one does not.**

## 🟨 `TSC-4c` — the fail-open guard in the two doors that *do* check
```ts
if (existing.shiftId) { /* verify parent */ }   // PATCH :412 · DELETE
```
`shiftId` is non-nullable, so this can only be empty string — but **the shape is "absence is permission"**, which `R1-2` exists to kill. One line, fix it while you are here.

---

# 2 · ✅ CENSUS RUN — CLEARED 2026-09-24 (Florin, production branch)

```
ShiftTask orphans         0        ShiftTask total          9
ShiftAttachment orphans   0        ShiftAttachment total    1
                                   ScheduledShift total    72
```

🟢 **`TSC-4-SCHEMA` IS UNBLOCKED.** The foreign keys will take. **10 child rows across 72 shifts — this migration is trivial in size**, nothing like `R1-1b`'s 9,226 pages. No rehearsal burden, no lock concern.

### 🔴 PLANNER CORRECTION — the hazard below was overstated
The original text read *"orphans are near-certain"* and *"every shift ever deleted left its tasks and attachments behind."* **That was inferred from code shape — no cascade, no cleanup code — and the data contradicts it.** Same error class as the `P-1` schema-drift prediction: **inferring data state from code structure.** The census was still correct to run; a *verified* 0/0 is a different object from an assumed one. **The reasoning below is retained because the mechanism is real and will produce orphans as the table grows — only the confidence was wrong.**

---

# 2c · 🔴 RESOLVED 2026-09-24 — THE MIGRATION WAS A NO-OP

`ALTER TABLE` failed with **`constraint "ShiftTask_shiftId_fkey" ... already exists`**. Inspection of `pg_constraint` on **both branches**:

```
ShiftTask_shiftId_fkey        CASCADE     (production AND staging)
ShiftAttachment_shiftId_fkey  CASCADE     (production AND staging)
```

**The foreign keys already existed, with the correct delete rule.** No migration mentions `ShiftTask` — those tables predate the migration history and were created by `db push`, which creates FKs. **The database was right; `schema.prisma` was wrong.**

- 🟢 **This is why the census returned 0/0** — not because shifts are rarely deleted, but because **Postgres has been enforcing referential integrity the whole time.** The Planner's hazard reasoning was wrong for a concrete reason, which is better than being right by luck.
- 🟢 **`TSC-4-SCHEMA`'s real effect was never data integrity — it was expressibility.** Declaring the relation is what made `where: { shift: { tenantId } }` possible. That was always the point.
- 🟨 **`BLOB-8` is therefore PRE-EXISTING, not introduced by this work.** Cascade has been deleting attachment rows and stranding their blobs all along.
- [x] Resolved with `prisma migrate resolve --applied 20260924204500_add_shift_relations`.

---

# 2b · THE MIGRATION HAZARD — the reasoning, retained

**There is no `relationMode = "prisma"`.** Declaring a relation creates a **real Postgres foreign key**, and *creating a foreign key fails if a single orphan row exists.*

**Orphans are near-certain.** With no relation there is no cascade, and the generic `DELETE` calls `model.delete({ where: { id } })` with **no child cleanup anywhere** — `grep` for `shiftTask.deleteMany` / `shiftAttachment.deleteMany` returns nothing. **Every shift ever deleted left its tasks and attachments behind.**

### 🔴 WHICH BRANCH — this is not interchangeable
| Step | Branch | Why |
|---|---|---|
| **Census (below)** | 🔴 **`production`** | It predicts whether the FK migration fails **against production**. **Read-only — it changes nothing.** |
| **Migration rehearsal** | `staging` | Where a write is allowed to go wrong |
| **Orphan cleanup, if any** | `production` | Snapshot first. Attachment rows carry blob URLs — **look before deleting** |

🛑 **Do NOT census on `staging`.** Staging is a Neon branch that has been written to independently since it was cut — invoices sent, `2026-55` edited, 86 records stamped. **Its orphan count is its own, not production's.** A clean staging gives false confidence; a dirty staging sends you hunting rows that do not exist in production.

### 🛑 FLORIN RUNS THIS FIRST, ON THE PRODUCTION BRANCH. The coder does not touch the schema until the count is known.
```sql
-- census only. changes nothing.
SELECT 'ShiftTask' AS tbl, COUNT(*) AS orphans FROM "ShiftTask" t
  LEFT JOIN "ScheduledShift" s ON s.id = t."shiftId" WHERE s.id IS NULL
UNION ALL
SELECT 'ShiftAttachment', COUNT(*) FROM "ShiftAttachment" a
  LEFT JOIN "ScheduledShift" s ON s.id = a."shiftId" WHERE s.id IS NULL;
```
- **0 / 0** → proceed to §3.
- **anything else** → 🛑 **stop and report the numbers.** Orphaned attachments carry blob URLs; they are deleted only after we have looked at them. **Neon snapshot before any delete.**

---

# 3 · THE SCHEMA CHANGE — additive, relation-only, no data movement

```prisma
model ShiftTask {
  shiftId String
  shift   ScheduledShift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  @@index([shiftId])
}

model ShiftAttachment {
  shiftId String
  shift   ScheduledShift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  @@index([shiftId])
}

model ScheduledShift {
  tasks       ShiftTask[]
  attachments ShiftAttachment[]
}
```

- [ ] **`onDelete: Cascade` is correct here** — a shift task has no meaning without its shift, and the current behaviour (silent orphaning) is strictly worse.
- [ ] 🟨 **`ShiftAttachment` cascade deletes the ROW, not the BLOB.** Deleting a shift will now orphan files in Vercel Blob instead of orphaning rows in Postgres. **That is an improvement, not a fix.** Log it as `BLOB-8` in the roadmap; **do not solve it in this directive.**
- [ ] 🛑 **`ShiftTask.taskId` is NOT a relation and must not become one.** It points at a page in the dynamic `db-tasks` database, which is not a Prisma model. Leaving it undeclared is correct. **Do not "complete the set."**
- [ ] **Migration is generated, never applied by the coder.** `prisma migrate dev --create-only`, commit the SQL, **Florin applies it.** 🛑 No `db push`, no `--accept-data-loss`.

---

# 4a · `TSC-4-NOW` — CLOSE BOTH HOLES, NO SCHEMA

**Everything here uses the check `PATCH` already performs at `:412`. Nothing here needs a relation.**

- [ ] **GET — `shiftId` becomes REQUIRED for these two entities.** Absent → **400**. Then verify it belongs to the tenant before querying:
  ```ts
  if (entity === 'shift-tasks' || entity === 'shift-attachments') {
      const shiftId = url.searchParams.get('shiftId');
      if (!shiftId) return NextResponse.json({ error: 'shiftId required' }, { status: 400 });
      const parent = await prisma.scheduledShift.findFirst({
          where: { id: shiftId, tenantId: ctx.tenantId }, select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      where.shiftId = shiftId;
  }
  ```
  🔴 **`where` is never left empty for these entities.** That is the whole of `TSC-4a`.
  🟢 **Safe:** all six UI call sites pass `shiftId`. The failure mode for anything that does not is a visible **400**, never a silent empty list.
- [ ] **POST — verify the parent before writing** (`TSC-4b`). `data.shiftId` missing → **400**. Not resolving to a shift in `ctx.tenantId` → **404**, never 403 *(do not confirm the row exists)*.
- [ ] **PATCH / DELETE — drop the `if (existing.shiftId)` wrapper** (`TSC-4c`). The check runs unconditionally.
- [ ] 🛑 **No schema file is touched. No migration is generated.**
- [ ] 🛑 **No behaviour change for legitimate callers.** All six call sites operate within their own tenant; every one must still pass.

# 4b · `TSC-4-SCHEMA` — make it structural, and delete the improvisation

**Only after §3 has landed.**

- [ ] **GET** — the explicit parent lookup from §4a becomes a relation filter, mirroring `team-members`:
  ```ts
  where.shift = { tenantId: ctx.tenantId };   // ALWAYS — not inside any conditional
  if (shiftId) where.shiftId = shiftId;       // narrowing only
  ```
  **One query instead of two, and the scope is no longer something a future edit can forget.**
- [ ] **`shiftId` may relax back to optional on GET** once the relation filter is unconditional — a listing with no `shiftId` now returns this tenant's rows and nothing else.
- [ ] 🟢 **Delete the §4a explicit lookup.** *(Displacement rule: the improvisation goes when the structure arrives. If both are still present, this item is not done.)*

---

# 5 · VERIFY

> # 🔴 PLANNER CORRECTION 2026-09-24 — THE SINGLE-TENANT CAVEAT BELOW IS WRONG
> **There are TWO tenants in production and on staging:** `BV CORAL ENTERPRISES` and `Murgu, Catalin`.
> The Planner asserted a single tenant **without querying**, and wrote that caveat into two directives.
> **Cross-tenant behaviour IS observable and SHOULD be tested directly.** The holes closed by `TSC-4a/b` and
> `HRA-1…3` were live against a real second tenant's data, not a hypothetical one.
> *(Fourth instance in one session of stating a data fact without checking it — see `pd.md` §5b.)*

## `TSC-4-NOW` — tested on **preview → Neon `staging`**

### 🔴 READ THIS BEFORE CLAIMING THE HOLE IS CLOSED
**Staging carries one tenant.** With one tenant, `where = {}` and `where = { tenantId: ours }` **return the same rows.** A test on staging therefore **cannot observe the leak**, and a report saying *"checked, no cross-tenant data returned"* would be true, worthless, and misleading.

- 🛑 **Do not report `TSC-4a` as "verified no leak" from a single-tenant run.** That is the **ZOMBIE RULE**: a path that works for the founder and fails for everyone else.
- ✅ **What a single-tenant run CAN prove:** the `400`, the `404`, the absence of a created row, and that all six UI call sites still work. **Report exactly that and nothing more.**
- ✅ **What proves the leak existed:** the code at `route.ts:104-121` — `noTenantEntities` skips the `tenantId` clause, and the `shiftId` clause is inside an `if`. **Already read and recorded. It needs no runtime proof.**
- 🟨 **If a throwaway second tenant is created on staging to observe it directly, say so explicitly in the report** and delete it afterwards.

1. `GET /api/hr/shift-tasks` **with no `shiftId`**, signed in → **400**. 🔴 **Record what it returned BEFORE the fix** — a row count greater than this tenant's own is the proof the hole was real.
2. Same for `shift-attachments`.
3. `GET` with a `shiftId` belonging to another tenant → **404**, empty body.
4. `POST /api/hr/shift-tasks` with another tenant's `shiftId` → **404**, and **no row is created** *(check the table, not just the response)*.
5. `POST` with no `shiftId` → **400**.
6. **All six UI call sites still work**: assign a task to a shift, remove it, tick a subtask, upload an attachment, delete it, open `MySchedule`.
7. `npm run validate` exit 0 · full suite green · **`eslint src --quiet` still zero errors** *(this route is on the grandfathered prisma allowlist — it must not gain a new import)*.
8. 🛑 **`git diff --stat` shows `prisma/schema.prisma` untouched.**

## `TSC-4-SCHEMA`
9. `npx prisma validate` clean · migration SQL contains **two `ADD CONSTRAINT … FOREIGN KEY`** and nothing else.
10. Delete a shift that has tasks and attachments → children gone, **no FK error**.
11. Re-run 1–7. **1 and 2 now return this tenant's rows rather than 400**, per §4b.
12. 🟢 **The §4a explicit parent lookup is gone from GET** — not commented, gone.

## 🟢 THE DISPLACEMENT NOTE — `TSC-0 D7`
This directive **hand-rolls parent verification in a fourth place.** That is deliberate and temporary: `saveGlobalDatabase:350-353` already hand-rolls the same check, and `TSC-0 D7` says the scoped client makes it automatic.
- [ ] **Add a `TODO(R1-4)` at each parent-verification block** — GET, POST, PATCH, DELETE — reading: *"Class-B parent check — `TenantScopedClient` makes this automatic (`TSC-0 D7`). Delete this block when `R1-4` lands."*

### 🔴 THE COUNT CHANGES BETWEEN THE TWO HALVES — report it at both points, do not reconcile them
| After | Hand-rolled parent checks in this route | Why |
|---|---|---|
| **`TSC-4-NOW`** | **4** — GET, POST, PATCH, DELETE | §4a adds the GET lookup |
| **`TSC-4-SCHEMA`** | **3** — POST, PATCH, DELETE | §4b replaces GET's with the relation filter and **deletes** it |
| **`R1-4`** | **0** | `TenantScopedClient` absorbs all three |

Plus `saveGlobalDatabase:350-353`, which is outside this route and unaffected by either half.

🛑 **A report saying "4" after `TSC-4-SCHEMA` means the §4a lookup was left behind.** *(Displacement rule: the primitive is not done until what it replaces is gone.)*

---

## WHY THIS MOVED UP THE LIST
`TSC-0` called Class C "scopable in principle and unscopable in practice." **The practice turned out to include two live holes.** The schema gap did not merely block `R1-4` — **it forced the route to improvise, and the improvisation leaks.**

**That is the argument for the seraph in one example:** `team-members` is safe because someone declared a relation years ago, not because anyone was careful at the route. **Correctness came from the model, not from the vigilance.**
