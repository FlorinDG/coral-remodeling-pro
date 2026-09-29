# CORAL — CODER DIRECTIVE — `HR-TS-5` · the detail pane edit mode — Planner 2026-09-29

🛑 **`CORE-3` LANDS FIRST.** Every save on this pane currently throws (`$transaction` rejects the audit op). **Building UI on top of a write path that does not work means nothing below can be verified.**

---

# 1 · 🔴 THE RAW `projectId` TEXT BOX — use the component that exists

```tsx
// TimesheetEntryDetail.tsx:~160
<input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)}
       className="border rounded px-2 py-1 text-xs w-full" placeholder="Project ID" />
```
**It asks a human to type a cuid.** Florin: *"REMOVE the reference to project id… replace it with the select component… do not reinvent the wheel, put the same searchable component."*

- [ ] **Use `SearchableSelect`.** 🟢 **It now self-resolves its portal target** (`CSF-1` B), so it works inside this pane with no `portalContainer` prop.
- [ ] **Source the options the way the shift form does** — `/api/hr/erp-projects`. 🔴 **Read `CreateShiftForm`'s call and match it.** 🛑 **Do not write a new project-fetching hook.** *(`erp-projects` already filters non-admins to projects they have shifts on — that gate must not be bypassed.)*
- [ ] **Empty selection → `null`**, which `handleSave` already sends correctly.
- [ ] 🟨 **The display mode (`:~168`) shows the raw `projectId` too.** **Show the project NAME.** An admin reading a timesheet must never be shown a cuid.

---

# 2 · `billable` — 🔴 READ IN FIVE PLACES, WRITABLE IN NONE

```prisma
billable  Boolean  @default(true)
```
| Reader | What it drives |
|---|---|
| `timesheet-reports/route.ts:179` | `billableHours` — **requires `entry.billable && entry.projectId`** |
| `timesheets/page.tsx:334` | the **Factureerbaar / Intern** summary tile |
| `TimesheetFilterBar.tsx:98` | the billable filter |
| `timesheet-export/route.tsx:133` | the **`Facturabel`** column in the export |
| `TimesheetEntryDetail.tsx:169` | displayed, read-only |

🔴 **No writer exists anywhere in `src`.** **Every entry is `true` forever**, so the Intern figure can only ever be non-zero via the `projectId` half of that condition. **A reporting dimension with no input is a number that looks meaningful and is not.**

- [ ] **A toggle in edit mode**, saved through `hrUpdate` with the other fields.
- [ ] 🔴 **`sanitize()` does not strip `billable`** and the server will persist it — **but confirm it, because `PROTECTED_FIELDS` is the only guard** and a field silently dropped would look identical to a UI bug.
- [ ] 🟨 **Changing `billable` is a money decision.** It must go through the same audit path as the hours (`CORE-3` makes that work) — **and the approved-entry unlock guard must apply to it.** 🛑 **Do not let `billable` become a way to edit an approved entry's value without the unlock.** *(`route.ts:653`'s `isJustApproval` allowlist is `['approvalStatus','approvedBy','approvedAt','editedAfterApproval']` — **`billable` is correctly NOT in it**, so a billable change will set `source = 'Aangepast'` and trip the guard. **That is right. Leave it.**)*

---

# 3 · `source` — 🔴 THREE VALUES, TWO LANGUAGES, TWO CASINGS

Florin: *"I see 'aangepast' and it tells me nothing of value."* **He is right, and the field is worse than unclear.**

```prisma
source  String  @default("clocked")
```
| Value | Written by | Meaning |
|---|---|---|
| `clocked` | Prisma default | clocked in and out on the device, live |
| `late_entry` | `LateEntryForm:102`, `actions/timesheets.ts:271` | submitted after the fact, through approval |
| `Aangepast` | `route.ts:653`, server-side | **an admin edited this entry** |

🔴 **Three problems, and the third is the one that matters:**
1. **Mixed language** — a Dutch past participle among English identifiers. **It is stored, not displayed**, so it must be a stable code. **`Aangepast` is a label wearing a code's clothes.**
2. **Mixed casing** — `clocked` · `late_entry` · `Aangepast`.
3. 🔴 **It is a free `String` with no enum**, so nothing prevents a fourth spelling. **`ManualEntryModal` creates entries and never sets `source`, so a hand-typed entry is recorded as `clocked` — which is false.** An entry an admin typed is indistinguishable from one a worker stood on site and clocked.

## WHAT `source` IS FOR — state it, then make the UI say it
> **`source` answers: how did this record come to exist, and how much should you trust it as evidence?**
> **`clocked`** = the device recorded it live · **`late_entry`** = the worker asserted it afterwards · **`Aangepast`** = an admin changed it after the fact.
> 🔴 **On a werkbon the client signs, that distinction is the difference between a measurement and a claim.**

- [ ] **Display a localised label with a one-line explanation** (tooltip or helper text), not the raw code.
- [ ] 🔴 **`Aangepast` does not tell you WHAT changed or WHO changed it.** The audit log holds both. **Link the detail pane's source field to this entry's audit entries** — the pane already fetches them (`:29`, `/api/hr/audit-logs?entityId=…`) **and currently displays them nowhere.** 🟢 **That is the answer to "it tells me nothing of value": the value exists and is not shown.**
- [ ] 🟨 **`ManualEntryModal` must set `source`** to its own value — an admin-created entry is not `clocked`. 🛑 **Florin decides the value** (`manual`? `admin_entry`?). **Ask; do not invent one.**
- [ ] 🟨 **Normalising the vocabulary to an enum is a migration and NOT this pass.** **Record it.** *(Additive only, nullable first, backfill, verify, tighten — and `Aangepast` rows exist in production.)* 🛑 **Do not rename `Aangepast` in the database now.**

---

# 4 · SAVE / CANCEL — the pane lies about what it saved

Florin: *"they get corrected not on save button click, but on exit with the little cross."*

**Mechanism:** `handleSave` throws (`CORE-3`), `setError` renders the red text, `editing` stays `true`. Clicking **X** sets `editing = false`, and the display re-renders **from the `entry` prop — which never changed.**

🔴 **So whether the values Florin saw are in the database is unknown from the UI**, and the UI showing a value the record does not hold is the more serious possibility.

- [ ] 🛑 **VERIFY IN NEON FIRST.** Take an entry Florin recently corrected; read `clockInTime`/`clockOutTime`. **Report before changing anything.** *(Carried in `CORE-3` §4 — do not duplicate the work, just do not skip it.)*
- [ ] 🔴 **X must DISCARD.** Reset `clockInTime` / `clockOutTime` / `projectId` / `billable` to the props on cancel. **Today they persist in component state**, so re-opening the editor shows unsaved edits as though they were saved.
- [ ] **Give it a label.** A bare `<X/>` beside Save is not obviously *Cancel* — **and Florin read it as the thing that committed his change.**
- [ ] 🟨 **The time inputs use `toISOString().substring(11,16)` (`:21-22`) — that is UTC.** In Belgium that is the wall clock **minus one or two hours.** 🔴 **`handleSave` then re-combines with `new Date(\`${date}T${time}:00\`)`, which parses as LOCAL** — the same asymmetry that produced the +2h shift bug. **Verify a real correction round-trips to the minute** before calling this done. 🛑 **If it does not, STOP and report** — do not patch an offset.

---

# VERIFY
1. 🛑 **`CORE-3` landed first**, and a save on this pane succeeds.
2. **The project field is a `SearchableSelect`.** 🔴 `grep -n "Project ID" src/components/time-tracker/components/timesheets/` → nothing.
3. **Display mode shows the project NAME, not a cuid.**
4. **`billable` toggles, saves, survives a reload, and moves the Factureerbaar / Intern tile.**
5. **Changing `billable` on an APPROVED entry demands the unlock.**
6. **`source` shows a localised label, and the audit entries for that entry are visible.**
7. 🔴 **Enter 09:51 / 13:15, Save, reload: the database holds 09:51 and 13:15.** **Not 07:51.**
8. **Edit, change a value, click X, reopen: the original values are shown.**
9. `test:compile` · `test:lint` · suite — exit 0.

## PROHIBITIONS
- 🛑 **Do not build on this pane before `CORE-3`.**
- 🛑 **Do not write a new project-options fetch.**
- 🛑 **Do not rename `Aangepast` in the database.**
- 🛑 **Do not invent the `ManualEntryModal` source value — ask Florin.**
- 🛑 **Do not add `billable` to the `isJustApproval` allowlist.**
- 🛑 **Do not patch a timezone offset. Report the asymmetry.**
