# CORAL — CODER DIRECTIVE — `HR-TS-7` · entry provenance — Planner 2026-09-29

> **Florin:** *"there has to be a distinction, the timesheet must record it as input by admin in a notes property. Should be visible in an export, too, when the worker exports their performance sheet."*

**The question this answers:** *did a person stand on a site and clock this, or did someone type it in afterwards?* 🔴 **On a werkbon a client signs, that is the difference between a measurement and a claim.**

---

# 0 · 🛑 TWO THINGS FLORIN ASKED FOR DO NOT EXIST YET — read before planning

| Florin said | Reality |
|---|---|
| *"in a notes property"* | 🔴 **`ClockEntry` has NO `notes` field.** Only `taskDescription`. |
| *"when the worker exports their performance sheet"* | 🔴 **`pages/Performance.tsx` has NO export of any kind.** No download, no CSV, no PDF. |

**Neither is a blocker — both are named below.** 🛑 **But do not silently substitute something for them.**

---

# 1 · THE VOCABULARY — `source` answers HOW the record came to be

```prisma
source  String  @default("clocked")     // free String, no enum
```
| Value | Written by | Meaning |
|---|---|---|
| `clocked` | Prisma default | device recorded it live |
| `late_entry` | `LateEntryForm:102`, `actions/timesheets.ts:271` | worker asserted it afterwards |
| `Aangepast` | `route.ts:653`, server-side | an admin edited it after the fact |
| 🆕 `admin_entry` | **`ManualEntryModal` — MISSING** | an admin created it from nothing |

- [ ] **`ManualEntryModal` sets `source: 'admin_entry'`.** 🔴 **Today it sets nothing, so a hand-typed entry records as `clocked` — a false claim that someone stood on site.**
- [ ] **English, snake_case, matching `late_entry`.** 🛑 **`Aangepast` is a display label in a code's clothes — do NOT copy that mistake, and do NOT rename it here** (production rows carry it; normalising to an enum is a migration and is `HR-TS-5` §3's recorded follow-up).
- [ ] 🔴 **`admin_entry` and `Aangepast` are DIFFERENT facts.** Created from nothing vs. altered afterwards. **Both must survive: an admin-created entry later edited is `admin_entry` created, `Aangepast` edited.** 🛑 **Do not let the PATCH intercept at `route.ts:653` overwrite `admin_entry` on the first edit** — check what it does today and report.

---

# 2 · 🔴 `createdBy` EXISTS AND IS NEVER WRITTEN

```prisma
createdBy  String?     // on ClockEntry. No writer anywhere in src.
```
**`ManualEntryModal` posts `userId` = the WORKER.** The admin who typed it leaves **no trace on the record at all.**

- [ ] 🔴 **Stamp `createdBy` SERVER-SIDE from `ctx.userId`** on every `clock-entries` POST. *(`pd.md` 5a — the server knows who is acting; a client-supplied author is a claim.)*
- [ ] 🟢 **This is the load-bearing half of Florin's request.** `source` says *how*; **`createdBy` says *who*, and it is the one an auditor asks for.**
- [ ] **`PROTECTED_FIELDS` must reject a client-supplied `createdBy`.** It currently does not list it. **Add it.**

## 2b · 🔴 AND THE MODAL SELF-APPROVES
```ts
// ManualEntryModal.tsx:64
approvalStatus: 'approved',
```
**An admin types hours for a worker and they are approved in the same request — no review, no approver recorded** (`approvedBy` is not set either, per `HR-TS-1` §1c).
- [ ] 🟨 **Report this to Florin; do NOT change it in this pass.** It may be deliberate — an admin entering hours *is* the approval. 🔴 **But if so, `approvedBy` and `approvedAt` must be stamped, or the record says approved by nobody.**

---

# 3 · THE `notes` FIELD — 🔴 a migration, and NOT into `taskDescription`

- [ ] 🛑 **DO NOT write provenance into `taskDescription`.** That field is **the worker's description of the work, and it is printed on the werkbon the client signs** (`[id]/page.tsx:196`). **Appending admin metadata would put internal bookkeeping on a document that leaves the company.**
- [ ] **Add `notes String?` to `ClockEntry`** — additive, nullable, no backfill, no default. *(Migration rules: additive only, nullable first. 🛑 **Never `prisma db push`, never `migrate dev` against production, never `--accept-data-loss`. Neon snapshot first.**)*
- [ ] 🔴 **FLORIN RUNS THE MIGRATION.** The coder writes it and stops.
- [ ] **`ManualEntryModal` gets a free-text notes box**, and the server prepends nothing — 🟢 **the provenance lives in `source` + `createdBy`, which are structured and queryable. `notes` is for what the admin wants to say**, e.g. *"phoned in from the site, no signal."*
- [ ] 🛑 **Do not derive the notes text in code.** A generated sentence in a human field is unqueryable and unreliable. **Structure carries the fact; notes carry the explanation.**
- [ ] **Show `notes` in `TimesheetEntryDetail`**, editable, alongside `HR-TS-5`'s fields.

---

# 4 · THE EXPORT — add provenance, and 🔴 fix what is already wrong in it

```ts
// timesheet-export/route.tsx:124-135 — current columns
'ID' 'Medewerker' 'Project' 'Datum' 'In' 'Uit' 'Uren (Decimaal)'
'Pauze Afgetrokken' 'Status' 'Facturabel' 'Kosten per uur' 'Totale kosten'
```

## 4a · 🔴 THE EXPORT PRINTS EVERY TIME TWO HOURS EARLY
```ts
'Datum': entry.clockInTime.toISOString().split('T')[0],
'In':    entry.clockInTime.toISOString().split('T')[1].slice(0,5),
'Uit':   entry.clockOutTime ? entry.clockOutTime.toISOString().split('T')[1].slice(0,5) : '',
```
**`toISOString()` is UTC.** 🔴 **This is `HR-TS-6`'s defect in the file that leaves the building — and here NOTHING cancels it.** An entry clocked 09:51 exports as **07:51**, and `Datum` is the **previous day** for anything before 02:00 local.
- [ ] 🔴 **Fix it in the same pass as `HR-TS-6`, with the same local formatting.** 🛑 **No offset arithmetic.**
- [ ] **Report whether any export already sent to the accountant is affected.** 🛑 **Report only.**

## 4b · THE NEW COLUMNS
- [ ] **`Herkomst`** (source) — 🔴 **a LOCALISED label, not the raw code.** The accountant must not read `admin_entry`. **`Aangepast` must not appear as-is either.**
- [ ] **`Ingevoerd door`** (createdBy) — resolved to a **name**, not a cuid. **Blank for device-clocked entries** — 🟢 *an empty cell correctly means "nobody typed this".*
- [ ] **`Notities`** (notes).
- [ ] 🟨 **`Kosten per uur` / `Totale kosten` are EMPLOYER cost, not wage.** A team leader exporting their team sees their team's cost rates *(the `getAccessibleUserIds` gate at `:53` is working correctly — this is a question, not a hole)*. **Ask Florin whether cost columns belong in a non-admin export.**

## 4c · THE WORKER'S PERFORMANCE SHEET — 🔴 IT HAS NO EXPORT
`src/components/time-tracker/pages/Performance.tsx` **has no download of any kind.**
- [ ] 🔴 **Do NOT build one in this pass.** **Report it** — Florin asked for provenance to appear in an export that does not yet exist.
- [ ] 🟢 **`/api/hr/timesheet-export` already scopes non-admins correctly** via `getAccessibleUserIds`, **so a worker-facing export is a button and a filter, not a new route.** 🛑 **Confirm that before anyone assumes it.**
- [ ] **Recorded as `WH-EXPORT-1`, for Florin to schedule.**

---

# VERIFY
1. **Create an entry through `ManualEntryModal`.** In the database: `source = 'admin_entry'`, `createdBy` = **the admin's** id, `userId` = **the worker's**.
2. **Clock in normally: `source = 'clocked'`, `createdBy` empty.**
3. **Edit the admin-created entry. Report what `source` becomes** — 🔴 **if `admin_entry` is lost, say so; do not silently accept it.**
4. **A client-supplied `createdBy` in the POST body is ignored.**
5. 🔴 **Export an entry clocked at 09:51. The CSV reads `09:51`.** **Not `07:51`.**
6. **An entry clocked 00:30 local exports with the correct `Datum`.**
7. **`Herkomst` shows a localised label in all four locales; `Ingevoerd door` shows a name or is blank.**
8. **The migration is written and NOT run.** 🔴 **Report the file; Florin runs it.**
9. `test:compile` · `test:lint` · suite — exit 0.

---

# 5 · SELF-APPROVAL IS INTENDED — 🔴 AND MUST BE VISIBLE ON EVERY READER

> **Florin:** *"it is normal, but it just needs to be visible on all readers."*

🟢 **`ManualEntryModal`'s `approvalStatus: 'approved'` STAYS.** An admin entering hours **is** the approval. **What must change is that no reader can currently tell.**

## 5a · 🟢 SELF-APPROVED IS DERIVED, NOT STORED
**Do not add a field.** Once `HR-TS-7` §2 stamps `createdBy` and `HR-TS-1` §1c stamps `approvedBy` server-side, the fact is already in the record:

```
self-approved  ⟺  approvedBy === createdBy
```
🔴 **A separate boolean could drift out of agreement with the two ids. This cannot.** *(`pd.md` 5d — derive, never own. `pd.md` 4w q5 — it makes the contradictory state unrepresentable.)*
- [ ] **One exported helper**, used by every reader. 🛑 **Never re-implement the comparison at a call site.**
- [ ] 🛑 **No migration, no new column, no `isSelfApproved` flag.**
- [ ] 🔴 **Both stamps are PREREQUISITES.** Without `createdBy`, every entry looks self-approved-by-nobody. **`HR-TS-7` §2 and `HR-TS-1` §1c land before this.**

## 5b · THE READERS — measured, all of them

| Reader | Today | Required |
|---|---|---|
| `timesheets/page.tsx:254` | 🔴 `by {approvedBy.slice(0,6)}` — **a cuid fragment. "by cmuf8n" tells nobody anything.** | **the approver's NAME**, and a *self-approved* marker |
| `TimesheetEntryDetail.tsx:188` | 🔴 `{entry.approvalStatus \|\| 'Pending'}` — **the raw English code, untranslated, no who, no when** | localised status · approver name · `approvedAt` · self-approved |
| `timesheet-export/route.tsx:132` | `'Status': approvalStatus \|\| 'pending'` — raw code | localised label **+ `Goedgekeurd door` column** |
| **the werkbon** `[id]/page.tsx:37` | 🔴 **declares `approvalStatus` in its interface and RENDERS IT NOWHERE** | 🟨 **ASK FLORIN — see 5c** |
| `timesheet-reports/route.ts` | aggregates `approvedHours` | 🟨 **report what share is self-approved** |

- [ ] 🔴 **`approvedBy` is a cuid everywhere it is shown. Resolve it to a name at every reader** — the same treatment as `Ingevoerd door` in §4b. 🛑 **Never print a cuid fragment to a human.**
- [ ] **`approvedAt` is stored and displayed nowhere.** **Show it** — *approved by X on date Y* is the whole answer.
- [ ] **Localise the status labels.** `page.tsx` already has `statusGoedgekeurd` / `statusGeweigerd` / `statusTeBeoordelen` — 🟢 **the detail pane and the export must use the SAME keys, not new ones.**
- [ ] **`useClockEntries.ts:19-20` already carries `approvedBy` / `approvedAt`.** 🟢 **No hook change needed. Confirm the API returns them.**

## 5c · 🟨 THE WERKBON — a question, not a task
**The werkbon is signed by the END CLIENT before Florin submits to his order giver.** Internal approval state is **the tenant's own bookkeeping**, and the client is not a party to it.
- [ ] 🔴 **Do NOT put approval status on the werkbon without Florin's word.** *(`coral-portal-two-party-record.md`: what the tenant writes is the tenant's; client visibility is always a deliberate act.)*
- [ ] **Ask: should the werkbon show approval state at all** — and if so, on the internal copy only?
- [ ] 🛑 **Meanwhile: remove `approvalStatus` from that page's interface, or render it.** **A declared-and-unused field is how a reader gets added by accident later.**

## 5d · VISIBLE MEANS DISTINGUISHABLE
- [ ] 🔴 **A self-approved entry must not look identical to one a second person reviewed.** A distinct marker — *"self-approved by X"* vs *"approved by X"* — **not merely a name in both cases.**
- [ ] 🟢 **This is the point of the whole item.** Florin asked for a *distinction*: **an admin typing hours and approving them in one motion is a different quality of evidence from hours a worker clocked and someone else reviewed.**
- [ ] **Localise both phrasings.** 🛑 **Do not build the sentence by concatenating a translated word with a name** — word order differs across nl / fr / en / ro. **Use an interpolated key.**

# VERIFY — 5
10. **An entry from `ManualEntryModal` reads *self-approved by \<admin name\>* on the timesheet row, in the detail pane, and in the export.**
11. **An entry a worker clocked and an admin approved reads *approved by \<admin name\>*** — 🔴 **visibly different from 10.**
12. **No cuid appears in any approval display.** `grep -rn "approvedBy.slice" src/` → **nothing.**
13. **`approvedAt` is shown wherever the approver is shown.**
14. **All four locales render both phrasings with correct word order.**
15. **The werkbon is unchanged pending Florin** — and its unused `approvalStatus` declaration is resolved either way.

## PROHIBITIONS
- 🛑 **Do not run the migration.**
- 🛑 **Do not write provenance into `taskDescription`.**
- 🛑 **Do not generate `notes` text in code.**
- 🛑 **Do not rename `Aangepast` in the database.**
- 🛑 **Do not build the worker's export. Report it.**
- 🛑 **No timezone offset arithmetic anywhere.**
- 🛑 **Do not remove `ManualEntryModal`'s self-approval — it is intended.**
- 🛑 **Do not add an `isSelfApproved` column. It is derived.**
- 🛑 **Do not put approval state on the werkbon without Florin's word.**
