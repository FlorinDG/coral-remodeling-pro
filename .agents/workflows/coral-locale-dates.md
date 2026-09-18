# CORAL — DATES, WEEK START AND LOCALE — one primitive, not 55 opinions — Planner 2026-09-18

**Florin, 2026-09-18:** *"Use European date format please, it is hard for me to read it, I get discombobulated."* → *"The app starts week on Sunday and is US format."*

**Confirmed. Both are real, both are localised to one module, and the cause is the same.**

---

## MEASURED

### Date display — 55 `toLocaleDateString` call sites, four different behaviours
| Argument | Sites | Renders |
|---|---|---|
| **none** | 15 | **Whatever the machine's locale is.** On a server component that is the *server's* locale — Vercel, not Belgium. |
| `undefined` | 4 | same as none |
| **`'en-US'`** | **5** | **MM/DD/YYYY — deliberately American** |
| `'en-GB'` | 12 | DD/MM/YYYY ✅ |
| `'nl-BE'` / dynamic | 6 | ✅ |

**~24 of 55 sites can render a date Florin cannot read at a glance** — and the "none" cases are worse than the explicit ones, because they change depending on where the code runs.

### Week start — the ERP agrees with itself; one module does not
```
✅ Monday   CalendarModule:298 firstDay={1} · :442 weekStartsOn={1}
✅ Monday   CalendarView:161 firstDay={1}
✅ Monday   DateRangePicker:44 · journal:47 · hr/page:55
❌ Mixed    time-tracker/schedule/* — raw getDay() at :183 :297 :217, and a
            (getDay()+6)%7 Monday shift at ScheduleCalendar:125
```
**The scheduling module is inconsistent with itself, let alone with the app.**

## THE CAUSE — and it is architectural, not sloppiness
`src/components/time-tracker/` has **its own `i18n/` folder, its own `contexts/`, its own `lib/`.** **It was ported from a separate codebase and never adopted the app's conventions.** Every US default it arrived with is still there.

**On the architecture map it is an L2 module that did not inherit its L0/L1 primitives** — the same shape as three blob readers and five write doors, in the presentation layer. *(Map entry to be marked `△`.)*

## 🔴 WHY THIS IS MORE THAN AN IRRITATION
- **Belgium: `09/12/2026` is 9 December. `en-US` renders 12 September the same way.** On a **timesheet**, a **shift**, or an **invoice due date**, that is not ambiguity — it is a wrong answer that looks right.
- **A crew schedule starting Sunday is wrong for a Belgian working week**, and it silently misaligns every week-based total.
- **The 15 locale-less sites render differently in different places** — so two screens can disagree about the same date and both be "correct".

---

## THE WORK

### `LOC-1` · ONE FORMATTER, IN THE KERNEL 🟥
- [ ] **`src/lib/format/date.ts`** — the only date formatter in the application.
  ```ts
  export const WEEK_STARTS_ON = 1;                 // Monday. ISO 8601. Not configurable yet.
  export function formatDate(d, locale): string;   // DD/MM/YYYY
  export function formatDateTime(d, locale): string;
  export function formatDateLong(d, locale): string;
  ```
- [ ] **Locale comes from the app's locale, never from the machine.** 🛑 **`toLocaleDateString()` with no argument is prohibited** — it is the one that changes behaviour between server and browser.
- [ ] **Storage stays ISO `yyyy-MM-dd`.** This is display only. **Do not touch stored values, query parameters, or the API.**
- [ ] `WEEK_STARTS_ON` is imported — **never a literal `1` and never a bare `getDay()`** for week logic.

### `LOC-2` · MIGRATE THE CALL SITES 🟧
- [ ] All 55 `toLocaleDateString` sites → `formatDate`. **Start with the 5 explicit `en-US`** — those are unambiguously wrong.
- [ ] Then the 19 locale-less/undefined sites.
- [ ] `en-GB` and `nl-BE` sites migrate too: **correct output from an inconsistent mechanism is still inconsistent.**
- [ ] **Grep gate:** `grep -rn "toLocaleDateString" src` → **only inside `lib/format/date.ts`.**

### `LOC-3` · WEEK START IN THE SCHEDULING MODULE 🟥
- [ ] `time-tracker/schedule/*` adopts `WEEK_STARTS_ON`. `ScheduleCalendar`, `ScheduleMatrixView`, `ScheduleManagement`, `CreateShiftForm`, `EditShiftDialog`, `Performance`.
- [ ] **Check week-based aggregates**, not just headers. A Sunday-start week that *displays* Monday-first but *totals* Sunday-first is the worse bug, because nothing looks wrong.
- [ ] 🛑 **Report any figure that changes** when the week start moves. **Do not silently correct historical totals** — Florin decides what happens to them.

### `LOC-4` · THE PDF TEMPLATES — check first, they are client-facing 🟥
`InvoicePDFTemplate:157` and `QuotationPDFTemplate:98` use `localeFmt`. **Verify what `localeFmt` resolves to when the document language is not set.** If it can fall through to a machine locale, **a client has received an invoice with an American date.**
- [ ] Verify before migrating. **Report the finding either way.**

## VERIFY
1. Every visible date reads **DD/MM/YYYY**.
2. Every calendar, scheduler and week picker starts **Monday**.
3. Same date, same rendering — **admin grid, mobile, PDF, portal, email.**
4. `grep -rn "toLocaleDateString" src` → one file.
5. `grep -rn "en-US" src` → **zero**.
6. A shift on Sunday falls in the **correct** week; week totals unchanged in value, only in grouping.
7. An invoice PDF with no explicit language still renders a European date.
8. `npm run test:compile` · full suite green.

## PROHIBITIONS
- **No `toLocaleDateString` outside the formatter.**
- **No `en-US` anywhere.**
- **No change to stored date values or API parameters** — ISO stays ISO.
- **No silent correction of historical week-based figures.**
- **No user-configurable date format yet** — one correct default first. *(Add it when a tenant outside Belgium exists, not before.)*
