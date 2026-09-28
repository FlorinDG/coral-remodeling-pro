# CORAL — CODER DIRECTIVE — `CSF-1` · the shift creation modal — Planner 2026-09-28 (rev. 2)

**Revision 2 replaces revision 1.** The first draft fixed both defects **at the instance** and left the shape that produced them — the same criticism made of `SEND-1` being fixed for invoices and not quotes. **Both fixes below are at the definition.**

Two defects, both live on `develop` and `main`, both in the entry point Florin uses 99% of the time.

---

# A · WORKER NAMES RENDER BLANK — one concept, four definitions

**Symptom:** the employee flyout in the shift modal shows checkboxes with no labels, so it reads as empty.

**Mechanism:** the producer supplies `name`; every consumer reads `full_name`.
```ts
// ScheduleManagement.tsx:70-76 — the producer
.map(e => ({ id: e.userId!, name: `${e.firstName} ${e.lastName}`, hourlyRate: e.hourlyCost }))
```
```
CreateShiftForm.tsx:807 · 813      uncontrolled copy — trigger label, list
CreateShiftForm.tsx:1438 · 1444    controlled copy   — trigger label, list
```

## 🔴 THE SHAPE — `WorkerOption` is declared THREE TIMES
```
src/components/time-tracker/components/schedule/CreateShiftForm.tsx:45
src/components/time-tracker/components/schedule/EditShiftDialog.tsx:53
src/components/time-tracker/components/admin/ScheduleManagement.tsx:19
```
plus `WorkerWithProfile` in `hooks/useWorkerSchedules.ts:17` as a fourth shape of the same idea.

**Each declares `name?` and `full_name?` as OPTIONAL**, so reading either type-checks and one of them is always `undefined`. **Three copies of a type, each free to drift — and they did.** *(`pd.md` 4z: one concept, one definition, frozen. This is the genuine defect shape, not two things sharing a word.)*

## FIX — define it once, in the module's existing types home
- [ ] **`src/components/time-tracker/types/` already holds the module's shared types** (`timesheet.ts`: `ClockEntry`, `GeolocationCoordinates`, `QuickLink`). **Put it there.**
  ```ts
  /** A person who may be assigned to a shift. Derived from Employee + its User link. */
  export interface WorkerOption {
      id: string;            // User.id — NOT Employee.id
      name: string;          // REQUIRED. The only name.
      hourlyRate?: number | null;
  }
  ```
- [ ] 🔴 **Delete all three local declarations.** All three files import the one definition.
- [ ] **`name` is required; `full_name` does not exist.** 🛑 **Do not add `full_name` to the producer.**
- [ ] **All four reads become `worker.name`** — both copies of the form.
- [ ] 🟨 **`WorkerWithProfile` stays for now** — it carries schedules and is a different concern. **Report whether it should absorb or import `WorkerOption`; do not merge it in this pass.**
- [ ] **`grep -rn "full_name" src/components/time-tracker`** and report what remains. Anything left is `TD-4`'s, not this pass's.

---

# B · THE PROJECT CANNOT BE SELECTED FROM THE MATRIX **+**

**Confirmed by Florin: it selects from the "Schedule Shift" button and not from the +.**

`SearchableSelect` defaults to `usePortal = true` and falls back to `document.body` (`SearchableSelect.tsx:263`). Inside a Radix dialog the list therefore renders **outside** it, and the focus trap treats every click as *outside* — **the list appears and nothing selects.**

## 🔴 THE SHAPE — 56 CALLERS, ONE PASSES A CONTAINER
```
<SearchableSelect …>  across src        56
…of which pass portalContainer           1     ← CreateShiftForm:848, the accidental survivor
```
**The component requires every caller to know about Radix focus traps, and 55 do not.** Any `SearchableSelect` inside any dialog anywhere in the app is broken the same way. 🛑 **Making it 2 of 56 fixes today and guarantees the 57th caller is wrong.**

## FIX — in the component, so no caller can get it wrong
- [ ] **`SearchableSelect` determines its own portal target.** From its trigger element:
  ```ts
  const target = portalContainer                                   // explicit still wins
      ?? triggerRef.current?.closest('[role="dialog"]')            // nearest dialog
      ?? document.body;                                            // unchanged otherwise
  ```
- [ ] 🟢 **All 56 callers become correct by construction.** A caller outside a dialog gets `null` from `closest` and lands on `document.body` — **behaviour unchanged**. A caller inside a dialog gets the fix.
- [ ] **`portalContainer` stays supported** as an explicit override.
- [ ] 🟨 **`CreateShiftForm:848`'s explicit container may then be removed** — it becomes redundant. **Removing it is the proof the default works.**

## 🔴 VERIFY THE POSITIONING — this is the real risk
The dropdown is `position: fixed` with viewport coordinates. **Inside an ancestor carrying a `transform`, `fixed` positions relative to that ancestor, not the viewport** — and Radix `DialogContent` commonly uses a transform to centre itself.

- [ ] **Check the dropdown's placement inside a dialog**, not merely that it opens. **If it is offset, the position must be computed relative to the container** — report it rather than leaving it visually wrong.
- [ ] 🟢 The uncontrolled copy already portals into a dialog and reportedly looks right, **so this is a check, not an expected failure.**

## And the ref is shared
```
line 711   <DialogContent ref={dialogContentRef}>   uncontrolled
line 1342  <DialogContent ref={dialogContentRef}>   controlled    ← the same ref
```
- [ ] **One ref per element.** Give the controlled dialog its own, even after the default fix — a ref on two elements is wrong regardless.

---

# C · 🛑 NOT A DEFECT — DO NOT FIX
```ts
// ScheduleManagement.tsx:70
.filter(e => e.schedule !== false && e.userId)
```
**`Employee.schedule` is a deliberate per-employee flag**, set from a checkbox in the employee's profile, controlling whether they appear in the scheduler. **Florin manages it.** The short employee list is that flag working. *(The Planner mistook it for a broken `User`↔`Employee` link.)*
- [ ] 🛑 **Do not remove or relax this filter. Do not "repair" missing `Employee.userId` links.**

---

# VERIFY — both entry points, every check
1. **"Schedule Shift" button:** names visible · project list opens **and selects** · **and is correctly positioned** · shift saves with the project.
2. **Matrix + button:** the same four.
3. **`projectId` persists** — reload after the sync queue drains, from both paths.
4. **Leave-type entries** still hide the project field, both paths.
5. **`Employee.schedule` still respected** — an employee with the box unticked stays out.
6. 🔴 **Spot-check three other `SearchableSelect` callers that sit inside dialogs** — they were broken too and are now fixed. **Name which three you checked.**
7. `npm run test:compile` exit 0 · `test:lint` exit 0 · suite exit 0.
8. **Report the `@ts-expect-error` count.** Retiring `full_name` may clear one or more: **63 or fewer, never more.**

---

## 🔴 FOR `WH-7`, NOT FOR THIS PASS
**A ~900-line form exists twice in one file.** Both defects here are a fix that reached one copy and not the other — and the copy that missed both is the matrix-**+** path, **the one actually used**.
🛑 **Do not deduplicate it now.** It is `WH-7`'s justification, and a stronger one than field renaming.
