# CORAL — CODER DIRECTIVE — `CORE-2` · the audit log cannot name three of its four actors — Planner 2026-09-27

```prisma
model AuditLog {
  actorUserId  String     // 🔴 NOT NULL, and no @relation
  entityType   String     // 'clockEntry' | 'article' | 'expense' | 'globalPage' …
  action       String
  field        String?
  before       Json?
  after        Json?
  reason       String?    // ← already anticipates a system write. There is nowhere to put the actor.
}
```

**The scope has four constructors. The audit log can record one of them.**

| Scope | Actor | `actorUserId` |
|---|---|---|
| `scopeFromSession()` | a person | ✅ a real user |
| `systemScope(tenantId, reason)` *(`TSC-3`)* | cron · webhook | 🔴 **no user exists** |
| `portalScope(portalId)` *(`PT-5`)* | a client | 🔴 **no user exists, by design** |
| operator impersonating *(`coral-impersonation.md`)* | two actors at once | 🔴 **inexpressible** |

🔴 **One non-nullable column blocks portal writes, scheduled work and the impersonation trail that Florin specified as a tenant guarantee.** Small change, three unblocks.

---

# 1 · THE SHAPE

```prisma
enum ActorKind { USER SYSTEM PORTAL OPERATOR }

model AuditLog {
  actorKind      ActorKind            // 🔴 required — the answer is never absent
  actorUserId    String?              // the person, when USER or OPERATOR
  actorRef       String?              // portalId when PORTAL; job name when SYSTEM
  actorLabel     String               // frozen display name at write time
  onBehalfOfId   String?              // OPERATOR only: the tenant user being impersonated
  …
}
```

- [ ] **`actorKind` is required.** 🛑 **A nullable kind means "unknown", and an audit row with an unknown actor is not an audit row.** *(Absence must not be an answer — `R1-2`.)*
- [ ] **`actorUserId` becomes nullable.** `actorRef` carries the non-person identity.
- [ ] **`actorLabel` is frozen at write time.** A renamed or departed employee must not retroactively change who did something. *(Same reason invoices freeze the client address.)*
- [ ] **`onBehalfOfId`** exists so an operator action records **both** parties. *(Florin: operator sessions in impersonation mode must be tracked — it is tenant liability and a guarantee to the tenant.)*
- [ ] 🛑 **Set from the SCOPE, never from a payload.** *(`R1-3`.)*

## Migration — additive, per `pd.md`
- [ ] **All four columns nullable first.** `actorKind` arrives nullable, is backfilled, **then** tightened in a second migration.
- [ ] **Backfill: every existing row is `USER`** — every current writer passes a real `actorUserId`. `actorLabel` resolves from `User.name`, falling back to the id.
- [ ] **Generate the SQL, do not apply it.** 🛑 **Florin applies.**
- [ ] 🔴 **Check whether the constraint already exists before assuming** — twice this month a `db push`-era artefact was already in the database *(`TSC-4`, `WORKHUB-CLOCKLINK`)*. **Report `pg_constraint` and the row count first.**

---

# 2 · THE WRITERS — three sites, one helper
```
src/app/api/financials/export/route.ts:476, 516   (actorUserId)
src/app/api/hr/[entity]/route.ts:676              (auditPayload)
```
- [ ] **One helper — `lib/audit.ts` — takes the scope and the event.** 🔴 **No call site constructs an `AuditLog` row by hand**, or `actorKind` will be wrong somewhere within a month. *(The `TSC-4` lesson: four doors, three check.)*
- [ ] **Repoint all three.** Behaviour identical: they are `USER` writes and stay so.
- [ ] 🛑 **Do not add new audit calls in this pass.** Portal and system writers come with `PT-2` and `TSC-3`.

---

# 3 · VERIFY
1. `npx prisma validate` clean; the migration contains **only** the four added columns — no other DDL.
2. The three existing writers produce rows with `actorKind = 'USER'`, the same `actorUserId` as before, and a resolved `actorLabel`. **Paste one row before and after.**
3. **A row cannot be written without `actorKind`** once tightened — prove it by attempting one and pasting the failure.
4. `actorUserId = null` with `actorKind = 'PORTAL'` and an `actorRef` **is accepted**. *(A constructed test row, deleted afterwards — this is the case the whole directive exists for.)*
5. `eslint src --quiet` exit 0 · `npm run test:compile` exit 0 · suite 0 fail / 13 todo.
6. **Report the grandfathered prisma allowlist length** — it must stay **40**; `lib/audit.ts` may import prisma only if it is added deliberately and reported, **not** silently.

## PROHIBITIONS
- 🛑 **Do not drop or rename `actorUserId`.** Nullable, not gone — existing rows depend on it.
- 🛑 **No `actorKind` default.** A default is how an unknown actor becomes a plausible one.
- 🛑 **Do not apply the migration.**
- 🛑 **No fourth audit model.** `AuditLog` and `RateChangeAudit` already exist; this makes `AuditLog` sufficient.
