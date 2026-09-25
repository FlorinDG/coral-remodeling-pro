# CORAL — BEFORE THE KERNEL — the floor under the floor — Planner 2026-09-21

**Florin, 2026-09-21:** *"Is what's missing in the kernel scoped? Is there anything to put in place before adding the missing kernel?"*

**Answers: mostly scoped, one real gap — and yes, three things must exist first. The first one is load-bearing and I have been wrong about it all week.**

---

# 🔻 PLANNER CORRECTION — THERE IS NO GATE

I have written *"closed by a build gate, not by discipline"* and *"the same mechanism that just worked for `BLOB-3`"* in at least five specs. **I checked. That mechanism does not exist.**

```js
// eslint.config.mjs — the ENTIRE config
defineConfig([ ...nextVitals, ...nextTs, globalIgnores([ … ]) ])
```
- **No `no-restricted-imports`. No `dependency-cruiser`. No import-boundary rule of any kind.**
- **`BLOB-3` is a convention that happened to be followed**, not a rule that is enforced. It held because we watched it, not because anything stopped it.
- 🔴 **`next.config.ts`'s `eslint` key is dead (`CLEAN-1`)**, so `next build` does not lint — and even if it did, the config has nothing to say about layers.

> **Every kernel primitive in the specs ends with "and a CI gate closes it." Built today, they would be conventions, not floors — the same status `BLOB-3` has, which is the status that let `en-US` dates and four hand-rolled cron traversals accumulate.**

**This is the prerequisite. Everything else in this file is secondary to it.**

## 🔴 AND THE GATE HAS A HOLE ALREADY
```js
globalIgnores([ …, "src/components/time-tracker/**" ])
```
**The one module that most needs boundary enforcement is excluded from linting entirely.** That is not a coincidence — it is *why* it kept its own `i18n/`, `contexts/` and `lib/`, and why it renders `en-US` dates and Sunday weeks. **A ported module that nothing checks drifts by default.**

---

# WHAT MUST BE IN PLACE

## `PRE-1` · THE IMPORT-BOUNDARY GATE 🟥 — **before any new kernel block**
- [ ] **Write the layer rules down, mechanically.** `no-restricted-imports` zones or `dependency-cruiser` — either works; **the point is that it runs.**
  - L0 `lib/kernel/*`, `lib/storage`, `lib/format` — **may import nothing from `src/components`, `src/app`, or `lib/records`/`lib/services`.**
  - **Only `lib/storage` imports `@vercel/blob`** — `BLOB-3`, finally enforced.
  - **Only `lib/messaging` imports the SMS SDK.** Only `lib/notify/transports` imports `web-push`.
  - **Nothing under `app/api/cron` imports `prisma`** — `R5-3`, ready in advance.
  - **Nothing outside `lib/data` calls `prisma.<tenantModel>`** — `R1-5`, the seraph's gate, **written now and switched on when `R1-4` lands.**
- [ ] **Wire it into `npm run validate`** *(which already exists: `test:compile && test:lint`)* **and into CI.**
- [ ] 🔴 **Remove `src/components/time-tracker/**` from `globalIgnores`.** Expect a wave of warnings; **land them as warnings first, not errors**, so the gate goes in today and the cleanup is `LOC-2/3`.
- [ ] 🛑 **Prove it: add a deliberate violation, watch it fail, remove it.** `R1-5` already says this — **an untested gate is not a gate.**

## `PRE-2` · DECIDE WHERE THE KERNEL LIVES 🟧
The specs currently propose **seven** locations: `lib/kernel/` · `lib/format/` · `lib/relations/` · `lib/notify/` · `lib/messaging/` · `lib/data/` · `lib/jobs/`. Some exist, some do not.

**Without one convention, the layer is conceptual only — and the architecture map cannot be checked against the filesystem, which is the one property that makes it trustworthy.**

- [ ] **Planner recommendation — mirror the map, so the directory IS the layer:**
  ```
  src/lib/kernel/     L0 — storage · format · relations · notify/transports · messaging · acting-scope · tenant-job · mint
  src/lib/core/       L1 — data (the scoped accessor) · jobs · notify · records · document engine
  ```
  **and everything else stays where it is.** A file's path then answers *"what layer is this?"* without reading it.
- [ ] ⚠️ **Honest cost:** moving `lib/storage` (33 spec references) and `lib/records` (14) is churn on files that currently work. **Alternative: leave existing modules and apply the convention to NEW ones only** — cheaper, but then the map and the tree only half agree. **🛑 Florin decides.**

## `PRE-3` · THE " 2" FILES ARE NOW IN SOURCE DIRECTORIES 🟨
```
find src -name '* 2.*'   →  40 files
git ls-files | grep ' 2\.'  →  0 tracked
```
**Untracked, so the build is safe** — but they now include `src/lib/format/date 2.ts` and `src/lib/invoices/due-date 2.ts`, i.e. **duplicates of kernel modules**.

- [ ] **Delete them.** The risk is not the build — it is **editing the wrong one** and losing an hour, or `tsc` resolving an unexpected path.
- [ ] Add `* 2.*` to `.gitignore` so they never become tracked.

---

# IS THE MISSING KERNEL SCOPED?

| Missing L0 block | Scoped? |
|---|---|
| `mintDatabaseId` | ✅ `coder-directive-kernel-pass.md` — **authorised, in Run 4** |
| `runForEachTenant` | ✅ `coral-r5-scheduled-work.md` — interface and failure semantics defined |
| `acting-scope` | ✅ `coral-impersonation.md` — two-scope model settled |
| notify transports | ✅ `coral-notifications.md` — interface defined |
| `messaging` (SMS) | ✅ interface defined; **blocked on `SMS-0`**, the Belgian delivery test |
| **`TenantScopedClient`** | 🔴 **NO — this is the gap.** |
| desktop scroll/overlay parity | 🟨 vague; **no reported pain — leave it** |

## 🔴 THE ONE UNSCOPED BLOCK — `TenantScopedClient` (`R1-4`)
Every spec describes it by what it forbids — *"methods that cannot express an unscoped query"* — and **none defines the interface.** Open questions, all of which must be answered before it is built:

- **Which models does it cover?** `GlobalPage` has no `tenantId` (transitive via `databaseId`). `User`, `Notification`, `AuditLog` have one. `CMS_Service` has none and needs none.
- **What happens to an unscopable model?** Fail closed, or an explicit unscoped escape with a named reason?
- **Does it wrap Prisma, or replace it with named queries?** A `$extends` wrapper **does not intercept `$queryRaw`** — already a known bypass.
- **How do the three legitimate raw queries survive?** `global-databases.ts:295` is correctly tenant-joined today.
- **What does a system writer use?** `R1-6`'s `systemScope(tenantId, reason)` — same object, different construction?

- [ ] **Design `TenantScopedClient`'s interface before `R1-4` starts.** 🛑 **It is the seraph's mechanism; getting the shape wrong means every call site migrates twice.**

---

## ORDER
1. **`PRE-1` the gate** — *before any new kernel block.* Also unblocks `R1-5` and `R5-3` by existing in advance.
2. **`PRE-3` delete the duplicates** — two minutes.
3. **`PRE-2` directory decision** — Florin.
4. **Design `TenantScopedClient`** — before `R1-4`.
5. **Then the missing kernel blocks**, each landing into a gate that already closes behind it.
