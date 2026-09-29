# CORAL — CODER DIRECTIVE — `HR-TS-6` · the edit pane shows every time two hours early — Planner 2026-09-29

🔴 **URGENT, SMALL, AND IT SHIPS ALONE.** Florin is clocking hours today and correcting them through this pane.

**Confirmed from the `CLEAN-12` census, not inferred.** The row the `CORE-3` report called a *failed* correction — audit `07:51:00.000Z` vs database `07:51:01.248Z` — **is the same instant, 1.2 seconds apart.** Belgium is **CEST (UTC+2)** until late October, so `07:51Z` **is** the 09:51 Florin typed. **The correction was a no-op, and only that is why no damage was done.**

---

# 1 · THE DEFECT — one function, used where it must not be

```tsx
// TimesheetEntryDetail.tsx:22-23 — EDIT MODE initial state
useState(entry.clockInTime  ? new Date(entry.clockInTime ).toISOString().substring(11, 16) : '')
useState(entry.clockOutTime ? new Date(entry.clockOutTime).toISOString().substring(11, 16) : '')
```
**`toISOString()` is UTC.** An entry clocked at **09:51** renders in the input as **07:51**.

```tsx
// :111 and :114 — DISPLAY MODE, THE SAME COMPONENT, correct
format(parseISO(entry.clockInTime), 'HH:mm', { locale: dateFnsLocale })   // → 09:51, local
```
🟢 **The component already knows how to do this correctly three lines below.** **Reading shows 09:51; editing shows 07:51.**

## WHY NOTHING BROKE YET — and why it is still serious
`handleSave` re-combines with `` new Date(`${date}T${time}:00`) ``, which parses as **local**. So **UTC out, local in** — the two errors cancel, and typing back the true time writes the identical instant.

🔴 **The inverse case is where it bites.** Trust the displayed `07:51` and adjust *relative* to it — or correct only the **Out** field and leave **In** alone — and a genuine **two-hour error is written into payroll, with an audit row agreeing.** 🛑 **The hours on a werkbon a client signs cannot be two hours wrong.**

---

# 2 · THE FIX — 🔴 fix the READ, never the write

- [ ] **Initialise both inputs from local wall-clock time**, exactly as `:111` / `:114` already do:
  ```ts
  entry.clockInTime ? format(parseISO(entry.clockInTime), 'HH:mm') : ''
  ```
  🟢 **`format` and `parseISO` are already imported in this file.** **Zero new imports.**
- [ ] 🛑 **DO NOT touch `handleSave`.** Its local parse is correct and is what makes the round-trip whole once the read is fixed. **Do not add or subtract an offset anywhere.** *(An offset patch would make today's no-op case wrong in the opposite direction.)*
- [ ] 🔴 **`useState` initialisers run ONCE.** If `entry` can change while the pane is mounted, the inputs keep a stale value. **Re-seed on `entry.id` change, or key the editor on `entry.id`.** **Verify by opening two different entries in a row without a reload.**

## 2b · 🔴 THE SAME BUG ON THE DATE HALF — a wrong-day write
```ts
// handleSave:50-51
const dateBaseIn = new Date(entry.clockInTime).toISOString().split('T')[0];   // ← UTC date
```
**An entry clocked between 00:00 and 02:00 local falls on the PREVIOUS UTC day.** A correction then saves the hours **to the wrong date** — and the timesheet, the werkbon and the export all follow it.
- [ ] **Derive the date base locally too**, from the same `parseISO` value.
- [ ] 🟨 **Report whether any production entry has a local time before 02:00** — if so, **check whether its stored date is already wrong.** 🛑 **Report only. Florin repairs data.**

---

# 3 · THE SURFACE IS CONTAINED — verified
```
grep -rn "toISOString().substring(11" src/   →   2 hits, both in this file
grep -rn "toISOString().slice(11"     src/   →   0
```
🟢 **This is the only component with the defect.** 🛑 **Do not open a codebase-wide time refactor.** *(`KERN-TIME` owns that and is not this pass.)*
- [ ] 🟨 **`src/lib/format/date.ts` now exports `formatTime`.** **Report whether it fits here.** 🛑 **Do not adopt it in this pass** — this fix must be two lines, matching the component's own working precedent.

---

# VERIFY — with a real entry, on the real clock
1. 🔴 **Open an entry clocked at 09:51. The In box reads `09:51`, not `07:51`.** **It matches the display mode directly above it.**
2. **Change In to 10:15, Save, reload: the pane reads `10:15`, and the database holds `08:15Z`.**
3. **Change ONLY the Out field. Save. The In time is unchanged in the database** — 🔴 **this is the case that was silently destructive.**
4. **Open entry A, close, open entry B without reloading: B shows B's times.**
5. **An entry clocked at 00:30 local: correcting it keeps the same DATE.**
6. **A running entry (no clock-out): the Out box is empty, and Save does not invent one.**
7. `test:compile` · `test:lint` · suite — exit 0.

## PROHIBITIONS
- 🛑 **No offset arithmetic. No `+2`, no `getTimezoneOffset()` correction.**
- 🛑 **Do not change `handleSave`'s local parse.**
- 🛑 **Do not repair any production row.** Report; Florin repairs.
- 🛑 **Nothing else from `HR-TS-5` rides along.** This ships alone, today.
