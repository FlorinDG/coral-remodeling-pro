# CORAL — CODER DIRECTIVE — `EXPDLG-1` · the accountant export gets a settings dialog — Planner 2026-09-18

**Florin, 2026-09-18:**
> *"The include must be a setting to tick. Normal behaviour is that already exported get filtered out, but there must always be a way to include them. So the export must really receive a settings dialog."*

**Decision recorded. Default = exclude already-exported; opt-in to include.** Today the ZIP filters on date only, so a re-run silently hands the accountant documents they already have. Nobody chose that — it was the absence of a choice.

Sits behind promotion. Follows `LOCK-1…6` and `SEL-1`.

---

## THE SHAPE — one dialog, opened by `📦 Boekhouder export`

The button stops firing immediately. It opens a dialog that **states what is about to happen before it happens.**

### Controls
- [ ] **Period** — the existing preset + custom range, moved into the dialog. **Both dates required.**
- [ ] **☐ Include documents already sent to the accountant** — **unchecked by default.**
  Label it in the user's terms, not `accountantExportedAt`. nl: *"Documenten die al naar de boekhouder zijn verzonden opnieuw opnemen"*.
- [ ] Nothing else for now. **Do not add options nobody asked for** — every one becomes a thing to maintain and a thing to misread.

### 🔴 The dialog must state the counts BEFORE the export runs
```
Periode 01/01/2026 → 31/03/2026
   42 documenten worden geëxporteerd
   12 al naar de boekhouder verzonden — uitgesloten
    3 zonder datum — niet opgenomen
```
- [ ] 🔴 **European date format, DD/MM/YYYY — never `en-US`.** Florin, 2026-09-18: *"Use European date format please, it is hard for me to read."* See `coral-locale-dates.md`; if `LOC-1`'s formatter exists by then, **use it** rather than formatting here.
- [ ] **This is the point of the dialog.** A ZIP whose contents you cannot predict is one you check by opening it, and an accountant export is exactly the file nobody re-checks. `TASK-M14`'s rule, applied to money: **if you cannot predict the result, you cannot trust it.**
- [ ] The counts come from the **server**, on the same query that will build the ZIP — **never from the client store.** That was `LOCK-3`, and a preview built from a different source than the export is the same defect with a friendlier face.
- [ ] Counts update when the period or the tick changes.

## BEHAVIOUR
- [ ] **Default (unticked):** documents with `accountantExportedAt === true` are **excluded from the ZIP content**, not merely from stamping.
- [ ] **Ticked:** they are included in the ZIP — and **still not re-stamped.** The existing idempotent filter at `route.ts:408/427/448/467` is correct and stays.
- [ ] **A re-export changes no data.** Including already-sent documents produces a file and nothing else. **Say so in the dialog** when the box is ticked: *"No records will be marked as sent — they already are."*
- [ ] Undated documents stay excluded (drafts, `R2`), **and are counted in the dialog** rather than vanishing.
- [ ] Everything else is unchanged: all-or-nothing (`BLOB-4`), abort-and-name on an unreadable document, stamp only after the ZIP exists, actor audit (`LOCK-6`).

## 🟧 ALSO — client and server disagree about the period
```js
client  NotionGrid:651   if (!from && !to)            → "Selecteer een periode"
server  route.ts:106     if (!startDate || !endDate)  → 400
```
**Set only one date and the client lets it through; the server returns a bare 400.** To the user that reads as *"the export ignored my period"*.
- [ ] **One rule, stated once.** The dialog's export button is **disabled** until both dates are set, with the reason visible. The server keeps its check — it is the authority — but the user must never be able to reach it in that state.

## VERIFY
1. Open the dialog on a period with known contents → **the counts match what the ZIP then contains.** Exactly.
2. Default run → already-sent documents are **absent** from the ZIP.
3. Tick the box → they are **present**, and **`accountantExportedAt` values are unchanged afterwards** — confirm in the database, not in the UI.
4. Run twice in a row, default settings → the second ZIP is **empty or near-empty**, and the dialog says so before you run it.
5. Set only one date → **the export button is disabled**, with a visible reason. No 400 reachable from the UI.
6. A period containing an undated draft → the dialog reports it as excluded; the ZIP does not contain it.
7. An unreadable document → the whole export still **aborts and names it** (`BLOB-4` unchanged).
8. Owner and ACCOUNTANT see identical dialogs and identical results (`LOCK-6`).
9. `npm run test:compile` · full suite green.

## PROHIBITIONS
- **No count computed client-side.** Preview and export read the same server query.
- **No re-stamping** when including already-sent documents.
- **No silent exclusion** — anything left out is counted and named in the dialog.
- **No extra options** beyond period and the include tick.
- **No change to `BLOB-4` strictness, the stamp-after-ZIP ordering, or the `LOCK-6` actor audit.**
- **The plain CSV export is untouched** — it is a data export, it stamps nothing, and it is not in scope.
