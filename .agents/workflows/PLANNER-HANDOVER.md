# CORAL — PLANNER HANDOVER
**Written 2026-09-29, updated 2026-10-01 evening, by the Planner session, for whichever session picks this up next.**

> **Read this file first, then `pd.md`, then `CODER-QUEUE.md`.** Everything else is reference.

---

# 0 · 1 OCT (day + evening) — scheduler, clocking, the work order · ALL LIVE ON MAIN
**Standing rule (Florin 1 Oct):** promote EVERY green change to main. A range with a `prisma/` change → report green, Florin runs `git push origin <sha>:refs/heads/main` himself (my script refuses; override was refused as weakening a check).
**Migrations applied today (Florin):** `20261001090000_shift_work_order_fields` (siteAddress, materialsEnabled, crewNote) · `20261001180000_geo_clock_addresses` (clock addresses + distance, site coords).
**Shipped:** SHIFT-LINK-1 (hours ↔ shifts, auto-link on creation, review card) · scheduler stale screens · WH-LEAN-1 (WorkHub no longer loads the ERP store) · task reach (a task on my shift is mine) · late-entry 2h bug (phone sends instants) · WO-1 tabs (Info · Hours · Tasks · Notes · Sign, full-screen) · WO-2 scheduler fields + work order = shifts created together (seriesId) · SCH-8 series scope server-side + HR-TS-8 · WO-3 signing + lock (AuditLog `shift`/`sign` rows = the lock, every writer refuses) · GEO-1 (Geoapify now, Google later; record never block) · Timesheets: shift row in entry detail, "Admin notes", "Uren manueel toevoegen" (app label only — export keeps "Nageleverd"), list refreshes after every action.
**Plan of record:** `coral-work-order-tabs.md` (WO phasing, GEO-1).
**Next, in order:** WO-4 (send the signed PDF; a failed send ≠ failure if signed — §11a) · offer Florin the list of late entries since June (stored 1–2 h late, fix by hand only) · delete dead `LateEntryForm.tsx` · then back to the roadmap (R1-2 census on track-b · R2).
**Coder:** LOC-SWEEP-1 done & live · R2-5 characterization tests queued (tests only).
**Not seen by me (no login):** the WO tabs / Sign screens — Florin has seen tabs + Sign land.

---

# 0a · NIGHT OF 30 SEP → 1 OCT — unattended run (Florin: "work unattended … then follow the roadmap")
**Live in production (WorkHub scope, promoted green):** TASK-CREW-1 (crew task status, notes draft→submit frozen, read-only log in WorkHub + ERP) · WB-A (order giver = client page) + SHIFT-DST-1 · I18N-TT-1 (crew i18n guard, Russian completed) · CREW-ERP-1 (12 ERP database doors closed to workforce; crew phones no longer get db ids or tenant financials) · PROJ-SSOT-1 phase 1 (one project resolver).
**On branch `track-b/r1-2-kern-8` (worktree `~/Documents/GitHub/coral-trackb`, NOT on develop):** R1-2 + KERN-8 (fail-closed resolver, getLockedDbId deleted) · R1-4 scopeWhere (contract now a build gate) · the TenantScopedClient (built, 14 tests, **not adopted**).
**Florin, in the morning:**
1. Run `.agents/workflows/r1-2-binding-census.sql` (on the branch) — R1-2 ships only if no tenant reads a system role that is MISSING/DANGLING.
2. Decide the R1-5 rollout (adopting scopeFromSession file by file).
3. Verify the reseller rate (fair use numbers in `feature_matrix.md`).
4. PRO shape (A/B/C) in `coral-draft-pro-tier.md`; PROJ-SSOT-1 phase 2 (drop HrProject — after a snapshot).
**Process lessons, saved to memory:** zsh `$S:refs` pushes nowhere (brace it) · a new model needs the SCOPE table + TSC-9 census · run the full suite after a schema change.

# 0 · UPDATE — 2026-09-30 (read this first; the sections below are the 29 Sep baseline)
- **The Planner now works in Claude Code, on the repo directly.** It implements judgement-heavy items itself; the Antigravity coder takes mechanical items under a file fence and reports in `.agents/reports/<ITEM>.md` (`coder-report-protocol.md`, `pd.md` 5g).
- **Promotion to `main`:** during the WorkHub iteration phase the Planner promotes green commits (CI + Vercel preview green, no `prisma/`/package change, rollback hash noted). Florin ends the phase.
- **Gate 2 exists:** `app/api/hr/lib/actor-reach.ts` + `write-policy.ts`; the HR role set is ONE definition in `lib/roles.ts` (`isTenantHrRole`: SUPERADMIN, tenant admin, director, HR). `isWorkforceRole` likewise.
- **Found and closed:** the crew could approve their own hours and leave (Gate 2); backdate clock-ins (`CE-TIME-1`); list/delete/overwrite every tenant file and received the whole ERP dataset on the phone (`FILES-CREW-1`).
- **WorkHub (WH-2):** the "tiny text" was iOS zooming the app to ~75% (a truncated address without `min-w-0`); fixed at the cause + `overflow-x-clip`. Crew app at 1.2rem, cards, 8px status rails, phone-native Time Off / My hours / My tasks / Documents / Shift Brief.
- **Live queue:** `CODER-QUEUE.md`. **Open for Florin:** `FILES-GATE-1` scope · werkbon phasing · whether crew tasks stay read-only.

---

# 1 · WHO AND WHAT

**Florin** (`tfo@coral-group.be`) runs **BV CORAL ENTERPRISES**, a Belgian construction business, on **CoralOS** — a multi-tenant SaaS ERP he is building **solo** and already **running his real company on**. A second tenant exists (*Murgu, Catalin*). More are coming.

🔴 **This is not a side project and there is no staging safety net in practice.** A defect means a crew standing on a site who cannot clock in. That happened on **2026-09-29** and cost a working day *(see §8, `INC-2`)*.

**Repo:** `/Users/florin/Documents/GitHub/coral-remodeling-pro` · Next.js (App Router) · Prisma · Neon Postgres · Vercel · next-intl (nl/fr/en/ro).

---

# 2 · THE PLANNER ROLE — what you are

**You read code, root-cause defects, and write precise specs into `.agents/workflows/`.** An external **"Antigravity" cron coder** implements them.

## 🔴 THE THREE THINGS THAT DEFINE THE JOB
1. **VERIFY THE CODER'S CLAIMS AGAINST THE CODEBASE.** Never accept a report. Every "landed" claim gets checked by reading the file. **This has caught real divergence repeatedly.**
2. **MEASURE BEFORE SPECIFYING.** *(See §9 — the Planner has been wrong many times by inferring from code shape. Every one was avoidable with a count.)*
3. **STATE THE DECISION, OR IT WILL BE MADE FOR YOU.** *(`pd.md` 5f.)*

## 🛑 WHAT THE PLANNER DOES NOT DO
- **No `git push`, no deploy, no branch move, no promotion.** Florin's, always.
- **No migration run. Ever.** Write it, hand it over, wait.
- **No `.env` reads** by default.
- **Never `git checkout` in Florin's live working tree.** Read at a ref with `git show <ref>:<path>`.
- **Never `prisma db push`, `migrate dev` against production, or `--accept-data-loss`.**
- **SQL touching live data is run by Florin in the Neon editor.**

## HOW FLORIN WORKS
He is technically sharp, extremely fast, and **corrects you directly when you conflate things**. Real corrections he has made: *"you are again trying to confound things together"* · *"do not make assumptions, leave it open"* · *"the two things — fold them in, don't just make a mention of it"* · *"check your work for the canonical logic."*

🟢 **Take the corrections literally. They are always about a real distinction you collapsed.** When he says *"i will stay on your council,"* he means he wants the reasoning, not just the answer.

---

# 3 · THE VOCABULARY — learn these or you will miscommunicate

| Term | Meaning |
|---|---|
| **Defect shape #1** | **One CONCEPT, two representations.** 🔴 **NOT two things that share a word** — Florin corrected the Planner on this. |
| **Canonical** | Each concept **defined precisely, then frozen**. 🛑 **NOT "collapsed into one."** |
| **The seraph** | The tenant gate, between L1 core and L2 modules. |
| **The other gates** | **Entitlement** and **actor reach** — peers of the seraph, not sub-concerns. |
| **The zombie rule** | A path that works for the founder and fails for everyone else. |
| **The displacement rule** | A primitive isn't done until what it replaces is **gone**. |
| **The ratchet** | Enable as `error`, grandfather existing violations, the allowlist length is the metric, and **it only falls**. |
| **Interlock** | `@ts-nocheck` is not debt — while a file carries it, its reads are **unverifiable**, so the data it consumes **must not change**. *(This misunderstanding caused `INC-1`.)* |
| **Bridge vs patch** | A bridge is **measured, named, and has an exit condition**. A patch has none. |

**Florin's standing product principle:**
> **"Automation is good, but the user remains the ultimate authority. The software is the tool, not the other way around."**

**Layers:** `L0 kernel` → `L1 core` → `GATE (seraph)` → `L2 modules` → `MODULE GATE` → `L3` → `L4`.

---

# 4 · THE BINDING RULES — `pd.md`

**`.agents/workflows/pd.md` (~645 lines) is the rulebook. Read it.** The most recent and most expensive:

- **4w** — the pre-handover check: five questions before any directive ships.
- **4x** — **hours are the fact; the project is an attribute that may change at any moment.**
- **4y** — the identity model (User = anyone who logs in; functional vs operational roles).
- **4z** — what canonical means.
- **5a** — **a component must not decide its own privilege.**
- **5b** — `_prisma_migrations` is not evidence about the database.
- **5c** — the Planner's sandbox is not CI (Prisma client is darwin-arm64; `tsc` OOMs). 🔴 **Do not claim CI outcomes you cannot run.**
- **5d** — **an attachment belongs to the moment; a project references it, never owns it.**
- **5e** — 🔴 **a Prisma schema change breaks production at DEPLOY time.** **Additive: database first, code second. Destructive: code first, database second.**
- **5f** — 🔴 **every directive declares its BLAST RADIUS.**

---

# 5 · CONVENTIONS

```
.agents/workflows/
  pd.md                             the rulebook
  PLANNER-HANDOVER.md               this file
  CODER-QUEUE.md                    what the coder works from, in order
                                    🛑 NEVER dated in the filename. The date lives
                                    INSIDE it. One file, always current, so no
                                    pointer anywhere can go stale.
  coder-directive-<item>.md         one spec per item
  coral-<topic>.md                  design walkdowns / decisions
.agents/coral-roadmap.xlsx          ~608 rows, Map Layer / Map Block columns
```

**Directive style that works with this coder** — it is deliberate, keep it:
- **`🔴` = load-bearing · `🛑` = prohibition · `🟢` = why this is right · `🟨` = report, do not decide.**
- **A BLAST RADIUS block at the top.** *(`pd.md` 5f.)*
- **Checkboxes, exact file:line, and the measured numbers inline.**
- **A VERIFY section that can catch DIVERGENCE, not just confirm the feature.**
- **Explicit PROHIBITIONS.** 🔴 **The coder's failure mode is expansion, not error** — it does good work and then does more than was asked.

---

# 6 · WHAT IS DONE

**Kernel identity chain, complete:** `KERN-5/6/7a/7b`, `R1-1b/1c` — **zero id-parse sites outside the kernel.**
> **An id is never parsed. The binding is always read.** `Tenant.lockedDbIds` forward, `GlobalDatabase.logicalKey` reverse.

- **`TSC-4`** cross-tenant read/write · **`HRA`** unguarded automations · **`TSC-9`** isolation test *(§2A exhaustiveness green and blocking)*
- **`CORE-2`** audit actor · **`CORE-3`** the `$transaction` defect *(§8)* · **`PORTAL-1`** server auth
- **`SUPA-1/2`, `TD-0…TD-4`** — the snake_case allowlist is at **5** grandfathered files
- **`CSF-1`** — `WorkerOption` frozen into one definition; `SearchableSelect` **self-resolves its portal target**, so all 56 callers work inside dialogs
- **`WH-UI-1` §9** — bottom bar, status rails, persian-green nav
- **`WHS-1` §1 partially** — `useScheduledShifts` now uses `withTimeout` + named endpoints

**Design docs of record:** `coral-walkdown-werkbon-record.md` 🔴 *(fully answered, awaiting phasing)*, `coral-decision-one-project.md`, `coral-walkdown-project-identity.md`, `coral-walkdown-entitlement.md`, `coral-portal-two-party-record.md`, `coral-typecheck-debt-plan.md`.

---

# 7 · WHERE THINGS STAND — the live queue

**`CODER-QUEUE.md` is the ordered list — always that filename, always current.** With the coder now:
1. **`WHS-1`** — 🔴 **WorkHub stabilisation. Nothing else ships until it holds on a phone.**
2. **`HR-TS-6`** — the edit pane shows every time two hours early (UTC read, local write).
3. **`SCH-8` / `HR-TS-8`** — the series scope is decorative; the manual-entry project select.
4. **`PROJ-SSOT-1`** — retire `HrProject` (empty table, four broken resolutions).

**Then:** `HR-TS-1` · `HR-TS-3` · `HR-TS-5` · `HR-TS-7` · `TD-4` tail · `KERN-8` · `R1-2`/`R1-3` → `R1-4`+`R1-5` · `ENT-1…24` · `WH-2` (rebuild WorkHub Home) · `WB-A…E` (the werkbon).

## 🔴 OPEN — FLORIN DECIDES, DO NOT INVENT
- `ManualEntryModal`'s `source` value for admin-typed entries
- `TIER_DEFAULTS` PRO contents; `EMAIL`/`WEBSITES` grantable or drop
- `PROJ-0` — `GlobalPage` vs `InternalProject` *(73 project pages vs 1)*
- Which fields may be edited series-wide
- `CLEAN-11` (entry `cmrm3n2rd`, −2.00 approved hours) · `CLEAN-12` (23 orphan audit rows, preserved)

---

# 8 · THE INCIDENTS — read these, they are the real curriculum

## `INC-1` (28 Sep) — the shift shape
`addSnakeCase` stopped writing `shift_date`/`shift_start`/`shift_end`. **Twelve files still read them, all under `@ts-nocheck`, so nothing checked.** Production broke for every tenant.
> 🔴 **THE RULE: a field's WRITE may be removed only in the commit that converts its LAST READER — and readers cannot be enumerated while a file carries `@ts-nocheck`.**
> **Order: lift the interlock → let `tsc` name the readers → convert → remove the write.**

## `CORE-3` (29 Sep) — the audit op was not a Prisma promise
`buildAuditLogOperation` was `async` and returned `prisma.auditLog.create(...)`. **An `async` function adopts and unwraps the promise it returns**, so `$transaction` received a resolved record. **Every clock-entry PATCH failed — approve, deny, hour corrections.**
🔴 **Worse: unwrapping EXECUTES the create.** The audit row landed outside the transaction and was never rolled back — **23 rows asserting changes that never happened.**
> **A record and its side effect must never be able to disagree.**

## `INC-2` (29 Sep) — the missing column 🔴 **the Planner's fault**
`ClockEntry.notes` shipped in `schema.prisma` with its migration correctly written but **unapplied**. `postinstall` runs `prisma generate`, so the client selected a column the database lacked → **P2022 on every `clockEntry.findMany()`** → workhub empty, clock button spinning, timesheets 500. **A crew could not clock in for a working day.**
> 🔴 **The Planner's instruction "migration written, NOT run" protected the DATA and said nothing about the DEPLOY.** **That gap is now `pd.md` 5e.**

---

# 9 · 🔴 THE PLANNER'S OWN FAILURE MODES — the most useful section here

**Every one of these actually happened. Expect to repeat them unless you guard against them.**

| Failure | Instance |
|---|---|
| **Inferring instead of counting** | *"Orphans near-certain"* — the census returned **0/0**; the FK already cascaded. |
| **A regex that manufactured findings** | `db-[a-z0-9-]+` matched inside UUIDs → **four false findings.** `db-` is not a marker. |
| **Claiming CI outcomes** | Misdiagnosed CI **twice**. The sandbox is not CI *(`pd.md` 5c)*. |
| **Fixing the instance, not the shape** | `CSF-1` rev 1 froze a type in a leaf and would have made `SearchableSelect` **2-of-56** correct. |
| **Collapsing two things into one** | Called `ClockEntry.photos` and `ShiftAttachment` one concept. **They are not** — evidence of a moment vs material for a job. |
| **Asserting from code shape** | Called `Employee.schedule` a broken link. **It is a checkbox Florin manages.** |
| **Reading a diff without arithmetic** | Called `07:51:00Z` vs `07:51:01Z` a *failed correction*. **Same instant** — Belgium is UTC+2. It revealed a **display** bug instead. |
| **Leaving a decision unstated** | The coder rewrote `useTimer` as a global singleton because the spec only said *"the same source."* |

## 🟢 THE GUARDS THAT WORK
- **Ask for a count before writing a spec.** Every wrong call above would have been caught by one query.
- **When you cannot determine something, SAY SO and ask for the measurement.** Florin respects this; he does not respect a confident wrong answer.
- **Own errors plainly, once, and move to the fix.** No self-flagellation — he wants the correction, not the apology.
- 🔴 **Check the arithmetic on any timestamp before calling it a defect.**

---

# 10 · THE ONE THING TO UNDERSTAND ABOUT THE CODEBASE

**Time is text, in two representations:**
```prisma
ScheduledShift.shiftDate   String    // "2026-09-28"
ScheduledShift.shiftStart  String    // "08:00"
ClockEntry.clockInTime     DateTime
```
**The same module stores time as text in one model and `DateTime` in another**, so every consumer parses by hand. 🔴 **`new Date(`${date}T${time}`)` parses as UTC in Safari and local elsewhere** — this has produced a +2h display bug **three separate times**.

🛑 **Build moments from parts** (`new Date(y, m-1, d, hh, mm)`) — **never by concatenating strings.**
🛑 **`toISOString()` anywhere near a user-facing time is a bug.** It is UTC.
🛑 **Never patch a timezone offset. Report the asymmetry.**

**`KERN-TIME`** — the kernel owning a shift moment — is recorded and not yet done. **It is the fix that makes this class of defect unrepresentable.**
