# CORAL — CODER QUEUE
**Current as of 2026-09-29.** This file is always the live queue — superseded items are removed, not renamed.
🛑 **The filename never carries a date.** `PLANNER-HANDOVER.md` §7 points here permanently.

**Work top to bottom. Each item is a separate commit set. Report after each.**
🟢 Florin has authorised direct promotion to `main` for now.

---

## 1 · `HR-TS-6` — 🔴 SHIPS ALONE, FIRST, TODAY
📄 `coder-directive-hrts-6-utc-edit-display.md`

**The timesheet edit pane displays every time two hours early** (`toISOString()` = UTC, while the display mode 90 lines below is correct). Florin has been "correcting" hours that were already right. Two lines. **Also a wrong-day bug on the date base for entries before 02:00 local.**
🛑 **Fix the READ. Do not touch `handleSave`. No offset arithmetic.**

---

## 2 · `HR-TS-1` — approve/deny + the werkbon link
📄 `coder-directive-hrts-1-timesheet-detail.md` §1, §2

- Controls are `opacity-0` hover-only → **invisible on touch**. Make them visible, `variant="outline"`, `stopPropagation` on the actions cell.
- **`approvedBy` is never written** → stamp server-side from `ctx.userId`.
- **Werkbon button points at a non-existent API route with the wrong key** → link to `/admin/hr/timesheets/${entry.id}`. 🛑 **Never add `werkbon` to `ENTITY_MAP`.**
- 🔴 **§2b is BLOCKING: remove `Gevalideerd op {today}`** from under the client's unsigned signature line. **That page becomes a legally-operative frozen PDF (see `WB-*`) and must not pre-print a validation date.**
- 🔴 **`entry.project` is never populated** → the werkbon always prints `Algemene Werken`. Fix.
- **`Export PDF` has no `onClick`** → wire it or remove it.
- 🟢 **Per Florin: the werkbon does NOT show internal approval status.** Remove `approvalStatus` from that page's interface.
- Fix `timesheet-export`'s UTC columns **in this pass** (same defect as item 1, and it leaves the building).

---

## 3 · `HR-TS-3` — thumbnails
📄 `coder-directive-hrts-1-timesheet-detail.md` §3

Render **both** `ClockEntry.photos` and `ShiftAttachment` in the detail pane. 🔴 **One exported `t_` URL resolver used by both surfaces — not two.** Guard `photos` (`Json?`, may be null/object/string).
🟢 **No longer cosmetic: these are the evidence a client signs for.**

---

## 4 · `HR-TS-5` — the detail pane edit mode
📄 `coder-directive-hrts-5-detail-edit.md` — **after item 1 lands**

- Raw `projectId` text box → **`SearchableSelect`** (reuse the shift form's `erp-projects` source). Display mode shows the **name**, not a cuid.
- **`billable`** — read in 5 places, written in none. Make it editable. 🛑 Not in the `isJustApproval` allowlist.
- **`source`** — show a localised label + **surface the audit log the pane already fetches and never displays.**
- **X must discard**, and be labelled.

---

## 5 · `HR-TS-7` — provenance
📄 `coder-directive-hrts-7-entry-provenance.md`

- `ManualEntryModal` sets **`source: 'admin_entry'`** (today it records as `clocked` — a false claim someone stood on site).
- **`createdBy` stamped server-side**; add it to `PROTECTED_FIELDS`.
- 🔴 **§3 IS AMENDED — see the walkdown §10d.** **Provenance is structured (`source` + `createdBy`) and NEVER written into notes.** The `notes` field is **client-facing** because it prints on the signed werkbon. **Name it for its audience and label it client-visible at the point of typing.**
- **Self-approval stays** (Florin: intended) but must be **visible on every reader**: `approvedBy === createdBy`, derived, **no new column**. 🛑 No cuids in any approval display.
- Export gains `Herkomst` · `Ingevoerd door` · `Notities`.
- 🛑 **Migration written, NOT run. Florin runs it.**

---

## 6 · `TD-4` — the snake_case allowlist, 36 → 0
📄 `coder-directive-td-4-convert.md` *(written 2026-09-28, never handed over)*

Independent of everything above. Batches `TD-4.0` → `TD-4.2`, then `TD-5`.
🛑 Skip `CreateShiftForm` / `EditShiftDialog` / `ShiftViewDialog` — `WH-7` and `WH-UI-1` delete them.

---

## 7 · `WH-UI-1` §9 — WorkHub mobile
📄 `coder-directive-wh-ui-1-workhub-home.md` §9

- 🔴 **`h-16` with `paddingBottom: env(safe-area-inset-bottom)` on the same element** — the inset is subtracted from the height, leaving ~30px. Make it additive.
- Nav → `var(--persian-green)` (currently `emerald-*` beside a persian-green button).
- Shift entries: left status rail, grey / `--tawny` / `--persian-green`, **computed from date+time, never from clock-in status.** 🛑 **No `` new Date(`${date}T${time}`) `` — that is the +2h parse.**
- Elapsed time on the clocked-into row, from the same `useTimer`/`formattedTime` as the button.
- ⚠️ **Touches `WorkHubShell` — do not run in parallel with the 42 remaining `text-xs` items.**

---

# 🛑 STANDING RULES
- **No migration is ever run by the coder.** Write it, report the file, stop.
- **No timezone offset arithmetic. Anywhere.** Report asymmetries.
- **Never `prisma db push` / `migrate dev` against production / `--accept-data-loss`.**
- **Fix the definition, not the instance.**
- **A write is removed only in the commit that converts its last reader.**
- `test:compile` · `test:lint` · suite — exit 0 on every commit.

---

# 📋 NOT FOR THE CODER — design of record, do not build
📄 `coral-walkdown-werkbon-record.md`

**The werkbon becomes a signed, frozen, self-evidencing document** — one signature covering a crew, recorded membership, a frozen PDF with photos embedded, a route-level transitive freeze, and a cron send to the order giver. **All questions answered; phasing `WB-A` … `WB-E` awaits Florin's word.**
🔴 **`WB-D` (the freeze) must not land after `WB-C` (signing).**
