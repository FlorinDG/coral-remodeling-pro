# CORAL — `SUPA-2` · THE SUPABASE SHAPE — Planner 2026-09-26

> **Florin:** *"get rid of any traces of supabase. seek and destroy, said a wise man."*

**The library is already dead.** `@supabase/supabase-js` is imported nowhere, `src/integrations/` is gone, no `SUPABASE_*` env var is read, and the only textual references are two comments *(`SUPA-1` removes both)*.

**What survives is the SHAPE.** Prisma returns `clockInTime`; the app converts it back to `clock_in_time` to feed components written against Supabase. **~250 field accesses across 28 files.**

🛑 **This is not a deletion. It is a rename, and not even a uniform one.** A sweep is the wrong instrument.

---

# 1 · THE MAPPING — measured against `prisma/schema.prisma`

| snake_case | Prisma | Model | Kind |
|---|---|---|---|
| `clock_in_time` | `clockInTime` | ClockEntry | casing |
| `clock_out_time` | `clockOutTime` | ClockEntry | casing |
| `task_description` | `taskDescription` | ClockEntry | casing |
| `project_id` | `projectId` | ClockEntry · ScheduledShift | casing |
| `user_id` | `userId` | several | casing |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | several | casing |
| `shift_date` / `shift_start` / `shift_end` | `shiftDate` / `shiftStart` / `shiftEnd` | ScheduledShift | casing |
| `first_name` / `last_name` | `firstName` / `lastName` | **Employee** | casing, different model |
| 🔴 **`full_name`** | 🔴 **`User.name`** | User | **SEMANTIC — not a rename** |

🔴 **`full_name` is the trap.** There is no `fullName` in the schema. It maps to `User.name`, a *different field on a different model*, and `Employee` splits the name in two. **A find-and-replace on `full_name` produces code that compiles and reads `undefined`** — which renders as a blank name, not as an error.

---

# 2 · 🔴 CONVERT THE MANUFACTURERS, NOT THE CONSUMERS

**Snake_case does not arrive from the database. The app creates it.** Two manufacturers are confirmed:

```ts
// AuthContext.tsx:95 — a Supabase-shaped profile invented from the next-auth session
const bridgedProfile: Profile = { id, user_id: …, full_name: … };

// actions/timesheets.ts:97 — "The component expects snake_case for Supabase compatibility"
return clockData.map(c => ({ clock_in_time: …, clock_out_time: …, task_description: …, project_id: … }));
```

🛑 **The Planner has NOT traced all ~250 sites to their sources.** Two manufacturers are known; there are probably more *(hooks that map API responses — `useScheduledShifts.ts` carries 17 sites and is the prime suspect)*.

> ### `SUPA-2.0` · INVENTORY THE MANUFACTURERS FIRST — this is the whole plan
> **Find every place a snake_case key is WRITTEN**, not read. An object literal, a `.map()`, a type declaration. **Report the list before converting anything.**

**Why this order and not a rename pass:** kill a manufacturer and its consumers break **visibly and immediately** — a TypeScript error, not a blank field at runtime. **Convert the consumers first and the manufacturer keeps feeding the old shape to code that no longer asks for it, silently.** *(The `full_name` trap, at scale.)*

---

# 3 · 🛑 WHAT IS AT RISK — read before touching `TimesheetView`

**`clock_in_time` / `clock_out_time` are payable hours.** `TimesheetView.tsx` carries **17 of the ~250 sites**, the single largest concentration.

- A wrong mapping does not crash. **It renders a blank, a zero, or a wrong duration** — and a wrong duration is a wrong wage.
- 🔴 **`TimesheetView` and `ClockButton` convert LAST**, after the mechanism is proven on something harmless.
- 🛑 **Verification is a FIGURE, not a render.** Take a real week for a real worker, record total hours before, convert, compare. **Equal or it reverts.**

---

# 4 · THE RATCHET — same mechanism as `PRE-1d` and `KERN-7`

- [ ] **ESLint `no-restricted-syntax` as `error`** on member access and object keys matching:
  ```
  clock_in_time · clock_out_time · task_description · project_id · user_id
  shift_date · shift_start · shift_end · full_name · first_name · last_name
  created_at · updated_at · employee_id
  ```
- [ ] **Grandfather the 28 files by name**, header comment:
  > *"These carry the Supabase-era field shape. Prisma is camelCase; these are the last translation. **Do not add to this list.** Its length is the `SUPA-2` metric."*
- [ ] **Report the exact allowlist length. 28 today, and it only falls.**
- [ ] 🔴 **Prove it fires** — a new file using `full_name` fails the build. Paste the message. *(`PRE-1c`.)*
- [ ] 🟨 **`created_at` / `updated_at` may appear in non-Supabase contexts** (external API payloads, Peppol, Stripe). **Scope the rule to `src/components/time-tracker/**` plus the named outliers** rather than the whole tree, and say so in the comment. **A rule that over-reaches gets disabled, and a disabled rule is not a rule.**

## Conversion order — by risk, not by size
```
2.1  AuthContext bridgedProfile        the manufacturer of full_name / user_id
     → its consumers in the SAME commit (Header, Profile, Index, UserCard, …)
2.2  useScheduledShifts.ts             the suspected shift-shape manufacturer (17 sites)
     → ScheduleTable · ScheduleCalendar · ScheduleMatrixView · MySchedule · DailySummary
2.3  admin/*                           UserDetailView · UserManager · ApprovalManager ·
                                       AllSchedulesView · ScheduleManagement · UserCard
2.4  schedule dialogs                  CreateShiftForm · EditShiftDialog · ShiftViewDialog
2.5  the outlier                       admin/database/components/ProjectDetailView.tsx —
                                       ONE project_id, outside the time-tracker. The shape leaked.
2.6  🔴 LAST: TimesheetView · ClockButton · Performance · LateEntryCard
                                       payroll surfaces, figure-verified
```

---

# 5 · VERIFY — per batch, not once at the end
1. **`npm run test:compile` is the instrument.** Killing a manufacturer must produce **type errors at every consumer**. 🛑 **A batch that compiles clean on the first try means the manufacturer is still alive somewhere.**
2. `eslint src --quiet` → **0 errors**, allowlist shorter than the previous batch. **Report the length each time.**
3. **The surface still works** — walk the feature, do not just load it.
4. **Suite: 0 fail / 13 todo.** *(The 13 are `TSC-9`'s `NOT_IMPLEMENTED`.)*
5. 🔴 **For 2.6 only:** total hours for a named worker over a named week, **before and after, as numbers, in the report.**

## PROHOBITIONS
- 🛑 **No global find-and-replace.** `full_name → fullName` produces a field that does not exist, compiles, and renders blank.
- 🛑 **No batch spanning two manufacturers.** One source per commit, consumers included.
- 🛑 **Do not widen the ESLint allowlist to make a batch pass.** A new violation is a stop-and-ask.
- 🛑 **Do not remove `timesheets.ts:98-106` until its consumers are converted.** It is load-bearing.
- 🛑 **Do not touch `@supabase/supabase-js` here** — that is `SUPA-1`.

---

## 🟢 WHAT "SEEK AND DESTROY" ACTUALLY MEANS HERE
**The search already found the corpse cold.** No client, no keys, no network calls, no `integrations/` directory — the migration happened and nobody recorded it *(`board-v2:748` still describes a live Supabase split-brain; it is five months out of date)*.

**What is left is the accent.** ~250 field names in a dialect the database stopped speaking, plus two places still translating into it. **The manufacturers are the target. The consumers follow for free.**

🔴 **And the last line of the deleted integration is still visible in the schema's absence:** `Profile.full_name` describes a table that no longer exists. That is the only reference that cannot be renamed — **it has to be re-thought**, because `User.name` and `Employee.firstName/lastName` are two answers to the question it was asking.
