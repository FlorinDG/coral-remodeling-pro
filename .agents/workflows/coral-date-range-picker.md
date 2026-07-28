# CORAL — DATE RANGE PICKER (shared component) — Planner spec 2026-07-28

**Florin:** *"I sincerely hope we can scope and code a 2026 date range picker in a flyout."*

---

## PART A — 🟥 THE IMMEDIATE BUG (format mismatch)
The timesheets filter renders raw ISO timestamps in the date fields: `2026-07-01T00:00:00+02:00`.

**Cause:** `CustomDatePicker` speaks **`YYYY-MM-DD`** — it emits that format (`CustomDatePicker.tsx:133`) and matches the selected day by string equality (`:199` `dayObj.dateStr === value`). `TimesheetFilterBar.tsx:110/117` passes it a **full ISO timestamp with offset**. Two consequences:
1. `formatDateDisplay(value)` (`:213`) can't parse it ⇒ the raw string is printed in the trigger.
2. `isSelected` never matches ⇒ **the chosen day isn't highlighted in the calendar either** (the less obvious half).

**FIX (independent of Part B, do it either way):** one boundary, one format. The picker's contract is `YYYY-MM-DD`; the **filter bar** converts to/from the API's ISO range (`from` = start-of-day, `to` = end-of-day, in the tenant's timezone) at the point it builds the query. Never pass timestamps into a date-only component.

---

## PART B — 🟧 `DateRangePicker` — ONE CONTROL, IN A FLYOUT
**No new dependency:** `react-day-picker@9.14` (native `mode="range"`) and `date-fns@4` are already in `package.json`; `CalendarModule` already uses `DayPicker`.

### What it replaces
The filter bar currently shows **three** controls for one concept — a Period `<Select>`, a "from" picker, and a "to" picker. Collapse to **one** trigger button.

### Anatomy
- **Trigger:** a single button showing the active range in human form — `1 – 31 jul 2026`, or the preset name when one is active (`Deze maand`). Never an ISO string.
- **Flyout (popover):**
  - **Left rail — presets** (one click applies and closes): `Deze week · Vorige week · Deze maand · Vorige maand · Dit kwartaal · Dit jaar · Aangepast`.
  - **Right — `DayPicker` with `mode="range"`**, **two months side by side**, `weekStartsOn: 1` (Monday), `locale` from `date-fns` matching the app locale (nl/fr/en).
  - **Footer:** the resolved range as text + day count (*"31 dagen"*), `Annuleren` / `Toepassen`.
- **Behaviour:**
  - Presets apply immediately. A **custom** range applies only when **both** ends are chosen and `Toepassen` is clicked — never fire a query on a half-selected range (that's how you get a request for `from` with a null `to`).
  - Clicking a start date after a complete range starts a new selection.
  - Validate `from ≤ to`; if the user picks them backwards, swap rather than erroring.
  - `Esc` closes, `Tab` order sane, arrow keys navigate days (react-day-picker gives this free).
- **Output contract:** `{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }` — **date-only**, no times, no offsets. Consumers convert to timestamps if their API needs them (Part A).

### Placement & reuse
- Lives at **`src/components/ui/DateRangePicker.tsx`** — a shared UI component, not a timesheets-local widget. Next consumers: timesheet **export**, project timelines, the financial/VAT period selector, calendar range views.
- **Keep `CustomDatePicker`** for single-date use (shift date, invoice date). This is a sibling, not a replacement — don't delete it, and don't fork it into a range variant.
- **Reuse, don't rebuild:** if `react-day-picker`'s styling proves awkward, theme it — do **not** hand-roll a third calendar. The app already has `CalendarModule` (FullCalendar), `CustomDatePicker` (hand-rolled), and `ui/calendar.tsx`; a fourth is not acceptable.

### Styling
- `react-day-picker/style.css` is already imported by `CalendarModule`; **import it once globally** rather than per-component, then override with the app's tokens.
- Range highlight uses the brand colour via `var(--brand-color, #d35400)` — **not** an undefined utility class (see `OCC-10`: `bg-brand-600` doesn't exist and rendered an invisible button).
- Must work in dark mode.

### Wiring into the timesheets filter
- Replace the Period `<Select>` + the two `CustomDatePicker`s with the single `DateRangePicker`.
- It writes `from`/`to` (and `period` when a preset is active) into the **URL params** that already drive the API — filter state stays shareable and refresh-safe.
- Default remains **this month**.

## VERIFY
1. Trigger shows `1 – 31 jul 2026` (or the preset name) — **never** an ISO timestamp.
2. Opening the flyout **highlights the currently active range** in the calendar (this is what Part A's second bug broke).
3. Preset click applies and closes; a custom range needs both ends + `Toepassen`; a half-selected range fires **no** request.
4. Backwards selection swaps rather than erroring; day count is correct.
5. URL updates; refresh and back/forward preserve the range.
6. Works in NL/FR/EN with Monday week start, and in dark mode.
7. The single-date `CustomDatePicker` still works everywhere it's used (shift creation, manual entry).
