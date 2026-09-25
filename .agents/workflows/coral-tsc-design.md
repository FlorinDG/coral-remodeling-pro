# CORAL — `TSC-0` · TenantScopedClient — the interface design — Planner 2026-09-21

**The one unscoped kernel block.** `R1-4` builds it, `R1-5` closes it, and they ship together or not at all. **Get the shape wrong and every call site migrates twice**, so this is settled before a line is written.

**Nothing here is implementation. It is the set of decisions `R1-4` must not have to make under time pressure.**

---

# 1 · THE SCHEMA, CLASSIFIED — measured, not assumed

**55 models. Only TWO are genuinely unscopable.** That is a far better starting position than the plan assumed.

| Class | Count | Models |
|---|---|---|
| **A · DIRECT** — has `tenantId` | **33** | Lead · Booking · ClientPortal · Event · User · SiteContent · CMS_Service · CMS_Project · HrApprovalRequest · HrSupportMessage · PromotionalBanner · NotionConnection · ConnectedEmailAccount · Contact · Invoice · Quotation · Employee · InternalProject · Supplier · **GlobalDatabase** · ClockEntry · ScheduledShift · ShiftTemplate · HrTeam · TimeOffRequest · WorkerSchedule · HrProject · UserProjectAccess · Notification · HrAnnouncement · HrDocument · RateChangeAudit · AuditLog |
| **B · TRANSITIVE** — one hop to a Class-A parent | **18** | **GlobalPage**→GlobalDatabase · ProjectUpdate/Task/Document/ProjectMedia/Message→ClientPortal · Account/Session→User · CMS_ProjectImage→CMS_Project · NotionEntry→NotionConnection · PlatformLead/SalesOpportunity→Contact · InvoiceItem→Invoice · QuotationItem→Quotation · TimeEntry→Employee · HrTeamMember→HrTeam · HrAnnouncementRead→HrAnnouncement · HrDocumentAcknowledgment→HrDocument |
| **C · 🔴 FK PRESENT, RELATION NOT DECLARED** | **2** | **ShiftTask** (`shiftId`) · **ShiftAttachment** (`shiftId`) — both point at `ScheduledShift`, which is Class A |
| **D · GLOBAL by nature** | **2** | **Tenant** (the root) · **VerificationToken** (pre-auth, has no owner yet) |

### 🔴 CLASS C IS A BLOCKER AND IT IS TINY
`ShiftTask` and `ShiftAttachment` carry a `shiftId` **with no `@relation`**, so Prisma cannot traverse it and **neither can a scoped client.** They are scopable in principle and unscopable in practice.
- [ ] **Declare the two relations.** Additive, relation-only, no data movement. **Must land before `R1-4`.**
- [ ] 🛑 If either turns out not to belong to a shift, **stop and report** — that is a data-model finding, not a plumbing task.

### 🟢 Every chain is depth-1
**No model needs more than one hop to reach a `tenantId`.** The client does not need arbitrary graph traversal — it needs `where: { <parent>: { tenantId } }`. **That is the single most important fact in this document**, because it makes the whole thing mechanical.

---

# 2 · THE DECISIONS

## D1 · Wrap Prisma with `$extends` — do not hand-write an accessor
- **Why:** 51 of 55 models are covered by injecting one `where` clause. A hand-written accessor means 55 × n methods, hand-maintained, each a chance to forget.
- **Why not only `$extends`:** it **does not intercept `$queryRaw`/`$executeRaw`**, and it cannot stop someone importing raw `prisma`.
- **Therefore three mechanisms, not one:**
  1. **`$extends`** injects the scope — the *automatic* part
  2. **The type excludes `$queryRaw`/`$executeRaw`** — the *unexpressible* part
  3. **The CI ratchet** (`PRE-1d.2`) forbids importing raw prisma — the *enforced* part

**No single mechanism is sufficient. Any two leave a hole.**

## D2 · Classification lives in one table, and an unclassified model FAILS CLOSED
```ts
const SCOPE: Record<ModelName, ScopeRule> =
  { Invoice: { kind: 'direct' },
    GlobalPage: { kind: 'via', through: 'database' },
    Tenant: { kind: 'platform' }, … }
```
- [ ] 🔴 **A model absent from the table throws at query time.** Not "passes through" — **throws.**
- [ ] **This is the ratchet applied to the schema:** a new Prisma model is unusable until someone decides its tenancy. **The decision happens when the model is designed, which is the only time it is cheap.**

## D3 · The tenant is NEVER a parameter
```ts
// ❌ scopedFor(tenantId).invoice.findMany(…)     — "pass the wrong tenant" stays expressible
// ✅ const db = await scopeFromSession();        — resolved once, at the boundary
//    db.invoice.findMany(…)                      — the tenant is not in the call
```
`R1-4`'s own words. **The client is constructed from the session/grant and carries the tenant privately.**

## D4 · Platform access is a SECOND, NAMED client — never a flag
```ts
platformDb()   // Tenant, VerificationToken, and cross-tenant superadmin work
```
- [ ] **Separate import, separate name, separately gated, separately audited.**
- [ ] 🛑 **Not a `{ platform: true }` option on the scoped client.** That is the `isImpersonating` boolean again — *AUTHORITY DIRECTIVE: asked for, never asserted.*
- [ ] Reachable only from `lib/data/**`; the CI ratchet covers it.

## D5 · System writers use the same object, constructed differently
```ts
systemScope(tenantId, reason)   // R1-6 — cron, webhooks, R5's runForEachTenant
```
- **Same `TenantScopedClient` type.** Business code cannot tell which way it was built, and must not be able to.
- **Difference is construction and audit:** a `reason` is required and recorded. **A system write with no stated reason is refused.**

## D6 · Raw SQL moves above the gate, into three named functions
The three current sites are all correctly scoped today (`global-databases.ts:295` joins `GlobalDatabase` on `tenantId`; `expense-dedup.ts:53,70`).
- [ ] **They become named, reviewed functions in `lib/data/raw/`**, each taking the scope and documenting why raw SQL is necessary.
- [ ] **`$queryRaw` is not reachable from anywhere else** — removed from the client's type, forbidden by the ratchet.
- [ ] 🛑 **A fourth raw query is a stop-and-ask**, not a new file.

## D7 · Reads and writes are scoped by the same rule
- [ ] **Writes:** `create` injects `tenantId` for Class A; for Class B it **verifies the parent belongs to the tenant before writing.**
- [ ] `update`/`delete` carry the same `where` injection as reads. **A scoped client cannot update another tenant's row even by id.**
- [ ] 🔴 **`upsert` is the sharp edge** — `saveGlobalDatabase:350-353` currently hand-rolls exactly this check. **The client must make that check automatic**, and that hand-rolled version then goes away *(displacement rule)*.

---

# 3 · THE SHAPE
```ts
// lib/data/scope.ts — the ONLY place these are constructed
export type TenantScopedClient = /* Prisma client, extended, minus $queryRaw/$executeRaw */;

export async function scopeFromSession(): Promise<TenantScopedClient>;   // throws if no tenant
export function systemScope(tenantId: string, reason: string): TenantScopedClient;
export function platformDb(): PlatformClient;                            // Class D + superadmin only
```
- **`scopeFromSession` throws when there is no tenant.** Never returns an unscoped client, never returns `null`. *(`R1-2`: absence is a question, not an answer.)*
- **Impersonation constructs through the same function** — `acting-scope` decides *which* tenant, the client does not care how.

---

# 4 · WHAT MUST BE TRUE BEFORE `R1-4` STARTS
- [ ] `ShiftTask` / `ShiftAttachment` relations declared **(Class C)**
- [ ] `R1-1a` three-way list reconciliation done — the client needs one answer to *"is this a system database"*
- [ ] `R1-1b` `logicalKey` landed — `GlobalPage`'s scoping goes through `GlobalDatabase`, which must be identifiable
- [ ] `PRE-1d.2` ratchet live — **otherwise the accessor is optional the day it ships**
- [ ] `tests/tenant-isolation.test.ts` written **first**, red, then made green by the implementation

## VERIFY — the closure conditions (`coral-seraph-stress-test.md` §4)
1. No code below the gate can construct an unscoped client.
2. The resolver fails closed.
3. The server never trusts a supplied id.
4. `$queryRaw`, cross-request caches, and job bodies are each explicitly shut.
5. **`tests/tenant-isolation.test.ts` is comprehensive and green.**

---

## 🟢 WHAT THIS DESIGN REMOVED FROM THE PROBLEM
The plan assumed *"which models are scopable"* was an open question needing escape hatches. **Measured, it is 53 of 55 scopable, every chain depth-1, and two genuinely global models that get their own named door.**

**The hard part was never the mechanism. It was not knowing the shape of the data** — and that took one query.
