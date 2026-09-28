# CORAL — INCIDENT + DIRECTIVE — the shift shape — Planner 2026-09-28

**Production is broken for every tenant.** `TypeError: undefined is not an object (evaluating 'e.split')` on the workhub.

**Mechanism:** `addSnakeCase` stopped writing `shift_date` / `shift_start` / `shift_end`. **Twelve files still read them**, all carrying `@ts-nocheck`, so nothing checked. `EditShiftDialog:103` and `CreateShiftForm:116` then run `dateStr.split('-')` on `undefined`.

🛑 **That is the mechanism, not the defect. Walked down, each layer has its own.**

---

# ROOT · PROCESS — there is no gate between *landed* and *live*

```
main  = 1841d6f   (KERN-7a)
main..develop = 0 commits
```
**`main` and `develop` are the same commit.** Every pass this week — `PRE-1d`, `TSC-4`, `HRA`, `TSC-9`, `KERN-5/6/7a`, `SUPA-1/2`, `WH-1`, `R1-1b/1c`, `CORE-2`, `PORTAL-1` — **went to production the moment it was written.**

🔴 **A kernel refactor reached the crews' phones with no staging pass, no promotion, no watch window.** `coral-promotion-plan.md` describes a release branch, a staging pass and a 48-hour watch. **None of it happened, and nobody noticed it stopped.**

- [ ] **Restore the separation before any further kernel work.** `develop` is where passes land; `main` is what crews run; promotion is deliberate.
- [ ] 🔴 **This is the only defect here that made the others reach a user.** The rest were latent.

---

# L0 · KERNEL — time is text, in two representations

```prisma
ScheduledShift.shiftDate   String     // "2026-09-28"
ScheduledShift.shiftStart  String     // "08:00"
ClockEntry.clockInTime     DateTime
```
**The same module stores time as text in one model and as `DateTime` in another.** Because the shift form is text, **every consumer parses it by hand — 25 `split('-')` / `split(':')` sites.**

The kernel owns the *arithmetic* — `computeWorkedDuration`, pure and tested — but **no type**. A component holds a string, splits it, and a missing string is a crash.

- [ ] **`KERN-TIME`: the kernel owns a shift moment.** Parsing happens once, at the boundary; components receive a value, never a string to split.
- [ ] 🟢 **Then this class of crash is unrepresentable**, not merely fixed.
- [ ] 🛑 **NOT in this pass.** Recorded so the remedy below is understood as a step, not an end.

---

# L1 · CORE — nothing owns the shape that crosses the boundary

The API returns Prisma rows in camelCase. **A client hook then invents a second shape in snake_case.** Nothing in the core says what a shift looks like when it reaches a module.

🔴 **So a client file unilaterally defines the contract, and editing it changes production.** That is why a data-layer edit reached the UI at all.

- [ ] **`CORE-DTO`: the core owns the record shape crossing to a module.** One shape. A hook maps to it; it does not invent it.
- [ ] **Recorded, not done here.**

---

# SERAPH — not involved, and that matters

**This is not a tenancy question.** The shift was correctly scoped before and after; field naming sits below the gate.

🟢 **Stated explicitly because not every defect belongs to the gate.** Pulling this one into the seraph would dilute what the seraph means.

---

# L2 · MODULE — twelve files consume a contract they cannot verify
```
blind (@ts-nocheck):  ScheduleTable · EditShiftDialog · ScheduleCalendar · CreateShiftForm
                      ShiftViewDialog · ScheduleMatrixView · AllSchedulesView · MySchedule
                      DailySummary · ScheduleManager · ClockButton · pages/Schedule
seen:                 hooks/useScheduledShifts
```
**Thirteen files consume shifts. The one the compiler could see is the one that did not break.**

## 🔴 THE PLANNER'S ERROR, NAMED
I treated `@ts-nocheck` as **debt to pay down later**. It is an **interlock**: while a file carries it, that file's reads are unverifiable, **so the data it consumes must not change.** Removing the write was sound only if every reader had been converted — twelve were invisible. **The coder proposed restoring the aliases; I refused on type-purity grounds. The type declarations were safe to remove. The writes were not.**

> ### RULE, from now on
> **A field's WRITE may be removed only in the same commit that converts its READERS — and a file's readers cannot be verified while it carries `@ts-nocheck`.**
> Order: **lift the interlock → let `tsc` name the readers → convert → remove the write.**
> Never: strip the type, remove the write, convert later.

---

# 🛑 THE REMEDY — MEASURE BEFORE CHOOSING

**The Planner cannot size this.** Those twelve files have *never* been type-checked. Lifting `@ts-nocheck` on one might yield six errors or two hundred, and the Planner's sandbox cannot run `tsc` *(`pd.md` 5c)*. **Specifying work of unknown size is how this incident happened.**

## STEP 1 · ONE FILE, ONE NUMBER — minutes, not hours
- [ ] **Lift `@ts-nocheck` from `EditShiftDialog.tsx` ONLY.** *(Both copies — 17 of the 21 files carry it twice.)*
- [ ] **Run `npm run test:compile`. Change nothing.**
- [ ] **Report: the error count for that file, and how many are shift-shape versus unrelated** (`any`, missing props, wrong signatures — debt that has nothing to do with this incident).
- [ ] 🛑 **Stop there. Do not convert. Do not lift another file.**

## STEP 2 · THE NUMBER CHOOSES THE PATH
| Result | Path |
|---|---|
| **Mostly shift-shape, a handful each** | **Convert all twelve.** Lift, let `tsc` enumerate, convert to camelCase, the write stays removed. **The correct fix, taken directly.** |
| **Buried in unrelated errors** | **Restore the write as a DECLARED BRIDGE** — and this is not the patch the Planner reached for. It is a bridge chosen with the number in hand, and it carries: the snake_case members restored on the hook type **and** in `addSnakeCase`; a comment naming this incident and the condition for removal; and an entry saying **the write is removed only when the last reader is converted.** |

🔴 **The difference between a bridge and a patch is that a bridge is measured, named, and has an exit condition.** The Planner's first instinct was a patch — no number, no exit.

## EITHER PATH
- [ ] **Keep the camelCase conversions already made** in `ApprovalManager.tsx` and `ScheduleManagement.tsx`. They read camelCase now.
- [ ] 🛑 **Do not re-add `@ts-nocheck` anywhere.** The count is 21 and only falls.
- [ ] **Verify on a phone, not a desktop:** workhub → schedule loads → open a shift → edit dialog → the date renders. **This broke for crews; it is confirmed fixed by a crew surface.**
- [ ] `npm run test:compile` exit 0 · `test:lint` exit 0 · suite exit 0.

---

# WHAT THIS CHANGES ELSEWHERE
- [ ] 🔴 **`WH-3`'s parking of `SUPA-2` 2.2–2.6 is overtaken.** It assumed those files might be rewritten, so converting them would be throwaway. **That does not survive *the app is broken for every tenant*.** The shift-consuming files are now correctness work, not tidying.
- [ ] **`KERN-7b` pauses until this is closed.** It converts files in the same tree; two conversions in flight over one surface is how a revert becomes impossible.
- [ ] **`KERN-TIME` and `CORE-DTO` are recorded** as the layer defects that made this possible.
