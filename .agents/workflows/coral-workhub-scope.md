# CORAL — WORKHUB SCOPE — repair or rebuild, and where the resources go — Planner 2026-09-27

> **Florin:** *"i have the feeling we are either refactoring workhub from scratch, or chasing our own tail."* → *"let us get a clear picture on how we deploy resources in this."*

**Measured, not estimated.** And the answer is better than the feeling: **the module is not entangled with the ERP. It only looks that way because shared plumbing happens to live inside it.**

---

# 1 · THE SIZE

| Subtree | Files | Lines |
|---|---|---|
| `components/` | 34 | **11,307** |
| `hooks/` | 20 | 2,106 |
| `pages/` | 5 | 1,670 |
| `lib/` | 5 | 405 |
| `contexts/` | 2 | 214 |
| `i18n/` | 1 | 48 |
| `types/` | 1 | 42 |
| **total** | **68** | **15,792** |

**Concentration is extreme — and that is good news.**
```
CreateShiftForm.tsx   1,967   (12.5% of the module in ONE file)
EditShiftDialog.tsx     915
ShiftViewDialog.tsx     626
ApprovalManager.tsx     606
ScheduleMatrixView.tsx  604
UserDetailView.tsx      563
pages/Schedule.tsx      556
Performance.tsx         456
LateEntryCard.tsx       429
MySchedule.tsx          426
                     ───────
top 10                6,148   = 39% of the module
```
**Three files are the shift editor** (`CreateShiftForm` + `EditShiftDialog` + `ShiftViewDialog` = 3,508 lines, 22%). Whatever happens, that is the centre of gravity.

## Health
- 🔴 **21 of 68 files carry `@ts-nocheck`** — **31% of the module is invisible to the compiler.**
- 🔴 **38 of 68 files carry the Supabase field shape** *(SUPA-2 allowlist, minus the 2 outliers elsewhere)* — **56%.**
- **Overlap is near-total:** the silenced files and the shape-carrying files are largely the same files.

---

# 2 · 🔴 THE KEYSTONE — the dependency is INVERTED

**71 files outside the time-tracker import from it.** That sounds like deep entanglement. It is not:

| Imported | Count | What it actually is |
|---|---|---|
| **`lib/utils`** | **52** | 🔴 **`cn()`. Seven lines. The shadcn classname helper.** |
| `contexts/ThemeContext` | 7 | theming |
| `contexts/AuthContext` | 7 | the next-auth bridge |
| `lib/hr-api` | 4 | the HR API client |
| `hooks/use-toast` | 2 | shadcn plumbing |
| `hooks/use-mobile` | 1 | shadcn plumbing |
| **actual features** | **8** | `pages/{TimeOff,Profile,Performance,Index}` · `ScheduleManagement` · `Header` · `Documents` · `TimesheetEntryDetail` · `useScheduledShifts` · `useClockEntries` |

```ts
// src/components/time-tracker/lib/utils.ts — ALL of it
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
🛑 **`src/lib/utils.ts` DOES NOT EXIST.** So **the app's entire shadcn UI kit — 52 files — imports its classname helper from inside the time-tracker.** The design system depends on the module we are deciding whether to delete.

## 🟢 What that means
**Strip the plumbing and the real coupling is 8 imports, reached from ~15 app route files — all of them HR/workhub routes that exist solely to host this module.**

> ### The time-tracker is not woven into the ERP. It is a LEAF that is holding the ERP's coat.

---

# 3 · WHAT `board-v2:748` GETS WRONG — it is five months stale

That paragraph still describes *"a half-migrated PARALLEL APP… own duplicate `components/ui/*` (full shadcn set), own `i18n/` + locales, own `contexts/`, own `pages/`, and an `integrations/supabase` data layer… SPLIT-BRAIN DATA."*

**Measured today:**
| Claim | Reality |
|---|---|
| own duplicate shadcn set | ✅ **GONE** — `components/ui/` inside it: **0 files**. It imports `@/components/ui/*` |
| `integrations/supabase` | ✅ **GONE** — directory removed, package unimported *(`SUPA-1` removed the dep)* |
| split-brain data | ✅ **GONE** — no Supabase client, no keys, no network calls |
| Supabase `AuthContext` | 🟨 now a **next-auth bridge** *(writes were unbridged until `696d5c7`)* |
| own `i18n/` + locales | 🔴 **STILL TRUE** — its own i18next instance, **5 locales: en · nl · fr · ro · ru** |
| own `pages/`, `contexts/` | 🔴 still true |

🟢 **The consolidation largely happened and nobody recorded it.** *That stale paragraph is why this felt like a swamp.*

🟨 **The `ro` / `ru` locales are a real requirement, not junk** — the crews. The app's own i18n carries nl/fr/en. **Any rebuild inherits Romanian and Russian.**

---

# 4 · WHERE THE RESOURCES GO

## 🟢 STEP 1 · EXTRACT THE PLUMBING — small, and it unblocks the decision
**Do this whatever you decide. It is cheap, it is not throwaway, and it makes the boundary real.**
- [ ] **Create `src/lib/utils.ts` with `cn()`.** Repoint the **52** importers. 🔴 **This alone removes 73% of the apparent coupling.**
- [ ] **Move `use-toast` and `use-mobile`** to `src/hooks/`. Repoint 3.
- [ ] **Move `ThemeContext`** to `src/context/`. Repoint 7.
- [ ] **Move `lib/hr-api`** to `src/lib/`. Repoint 4.
- [ ] `AuthContext` stays for now — it is the next-auth bridge and `SUPA-2` is still eating it.
- [ ] 🟢 **Afterwards the module has 8 inbound imports and the decision below becomes reversible.**

**Cost: one to two passes. Risk: near zero — moves and repoints, no logic.**

## THEN CHOOSE — and the numbers now say which

### A · REPAIR — finish `SUPA-2` 2.2–2.6, lift 21 `@ts-nocheck`, fix as found
- **Cost:** 5 batches × 38 files, plus 21 files entering type-checking for the first time. **Every one will produce errors nobody has seen.**
- 🔴 **The tail-chasing is real and measurable:** two days of touching this module produced a dead logout, a dead auth context, a `null` clock link with 11 false readers, `-2.00` approved hours, 11 orphaned clock entries. **Not one of those was the thing being worked on.**
- **Yield:** the same features, type-checked and camelCase. **No new capability.**

### B · REBUILD the shift editor only — the 22% that is the centre
`CreateShiftForm` (1,967) + `EditShiftDialog` (915) + `ShiftViewDialog` (626) = **3,508 lines, 3 files**.
- **These three are also where the defects cluster:** the clock-link readers, most of the `project_id` sites, the attachment inputs, the `[ERP]` prefix.
- **Rewrite against the corrected kernel** — one project database, `scope.systemDatabase`, the declared `ClockEntry.shift` relation, camelCase throughout.
- **Repair the other 78% in place** — it is mostly display.
- 🟢 **Highest yield per line touched, and it is the part a rewrite would rebuild anyway.**

### C · REBUILD the module — 15,792 lines
- **Only rational after Step 1**, and only if the crews' workflow is itself changing.
- 🛑 **Inherits, non-negotiably:** 5 locales incl. ro/ru · offline/PWA behaviour · GPS capture · approval chain · the corrected clock relation · `timesheet-export` and `timesheet-reports`, which feed **payroll**.
- 🔴 **Do not start before the kernel lands.** `PROJ-0` is undecided and `R1-4` is four gates out. **A rebuild on today's kernel rebuilds the `[ERP]` prefix and the 74 id-parse sites into new code.**

---

# 5 · THE PLANNER'S READING

**`A` is the tail-chasing Florin can feel.** Five batches of renaming, in a module where 31% of files have never been compiled, yields the same product with tidier field names — while the next batch keeps finding a defect that has nothing to do with renaming.

**`C` is premature.** The kernel it would be built on is mid-repair; `PROJ-0` isn't decided; `R1-4` is four gates away. **A rewrite now inherits the defects we are in the middle of removing.**

> ## Recommendation: **Step 1, then B.**
> Extract the plumbing. Rewrite the three shift-editor files against the corrected kernel. Repair the display layer in place, opportunistically, with the ratchet holding the line.

**And keep the two gates regardless:** the `SUPA-2` pattern ratchet costs nothing and stops new code joining the shape; the `@ts-nocheck` count is the honest health metric — **21 files, and it should only ever fall.**

## 🔴 One thing to fix before any of it
**`board-v2:748` must be corrected or deleted.** It describes a system that no longer exists, and it is the document that made a nearly-consolidated module look like a live split-brain. **A stale map costs more than no map.**
