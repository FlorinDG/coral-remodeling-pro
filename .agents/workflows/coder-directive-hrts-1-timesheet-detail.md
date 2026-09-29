# CORAL — CODER DIRECTIVE — `HR-TS-1…4` · the werkbon and its sign-off — Planner 2026-09-29 (rev. 2)

**Revision 2 supersedes revision 1.** Florin: *approve does not fire* · *both documents are needed — the end client signs off my hours before I submit them to my order giver* · *render the thumbnails* · *projects reference attachments, they do not appropriate them.*

🔴 **This is not a tidying pass. `HR-TS-2` is a document Florin sends to the party who pays him, and it currently prints a false date.**

---

# `HR-TS-1` · APPROVE DOES NOT FIRE — 🔴 and nothing tells you why

```ts
// page.tsx:187 — the entire error path
} catch (err) {
    console.error('Failed to update status:', err);
}
```
**`hrFetch` throws a real message** (`hr-api.ts:16-19` parses `err.error` off the response). **`handleApproval` swallows it into the console.** The optimistic `setEntries` on the next line never runs, so **the status silently does not change and the UI gives no reason.**

🔴 **The Planner cannot name the failing cause from code alone.** The PATCH clock-entry path (`route.ts:631-679`) is well-formed; the plausible throws are the 403 edit guard, the tenant pre-check at `:617`, and `buildAuditLogOperation` inside the transaction — **and all three are indistinguishable from the outside because the message is discarded.**

## 1a · SURFACE THE ERROR FIRST — this is step one and it is not optional
- [ ] **`handleApproval` shows the thrown message to the user** — a toast or inline row error carrying `err.message`, not a bare `console.error`.
- [ ] **Same for `handleBulkAction`** (`:124`): it `alert`s `t('bulkActionFailed')` and **discards the cause.** Include the message.
- [ ] 🟢 **Then Florin clicks once and reports the actual error.** 🛑 **Do not guess a fix before that message exists.** *(A payroll approval that fails silently is the defect; the underlying cause is the second defect.)*
- [ ] 🔴 **Report the message back before changing the server.**

## 1b · THREE THINGS THAT ARE WRONG REGARDLESS — fix in the same pass
```tsx
// :212  <tr className="… group cursor-pointer" onClick={() => setExpandedRowId(…)}>
// :269  <div className="… opacity-0 group-hover:opacity-100 …">
// :270  {entry.approvalStatus !== 'approved' && entry.clockOutTime && (
// :271   <Button size="sm" variant="ghost" …>
```
- [ ] 🔴 **Remove `opacity-0 group-hover:opacity-100`.** On a touch device there is no hover, **so the controls never appear at all.**
- [ ] **`variant="outline"`, not `ghost`.** They must read as buttons.
- [ ] 🔴 **`onClick={(e) => e.stopPropagation()}` on the actions `<td>`**, as the checkbox cell at `:206` already does. **Today an Approve click also toggles the detail pane.**
- [ ] 🟨 **`entry.clockOutTime` gates Approve but not Deny.** **Keep the gate — render Approve DISABLED with a title, never absent.** 🔴 **Florin is clocking his own hours right now, so running entries are exactly what he is looking at: an absent control is indistinguishable from a broken one.**
- [ ] **`'Hide Detail'` (`:277`) is hardcoded English.** Localise.

## 1c · 🔴 `approvedBy` IS NEVER WRITTEN
`:254` renders `{entry.approvedBy && …}`. **`handleApproval` sends only `{ approvalStatus }`.** The server's own allowlist anticipates the rest:
```ts
// route.ts:653
['approvalStatus', 'approvedBy', 'approvedAt', 'editedAfterApproval']
```
- [ ] **Send `approvedBy` and `approvedAt`** — or 🟢 **better, set them SERVER-SIDE** from `ctx.userId` when `approvalStatus` transitions. *(`pd.md` 5a: a component must not decide its own privilege — and it must not assert who approved. The server knows.)* **A client-supplied `approvedBy` is a claim; a server-stamped one is a fact.**
- [ ] **Same for the bulk path.** 🔴 **On a payroll document, "who approved these hours" must be answerable from the record, not only from the audit log.**

---

# `HR-TS-2` · THE WERKBON — the sign-off document

**Florin: *"I need the form where the end client signs off on my hours before I submit them to my order giver."*** 🟢 **That form exists and already has both signature blocks** (`[id]/page.tsx:214-228`): *Handtekening Medewerker* and *Handtekening Opdrachtgever*, as printed rules on an A4 with a working print stylesheet. **Wet signature on paper works today — it is only unreachable.**

## 2a · REACH IT — 🛑 do NOT build an API route
```tsx
// TimesheetEntryDetail.tsx:124
window.open(`/api/hr/werkbon?shiftId=${entry.shiftId}`, '_blank')
```
**Two independent errors:** `werkbon` is not in `ENTITY_MAP`, **and** the page keys on **clock entry id**, not shift id — so it would find nothing even if the route existed.
- [ ] **Link to `/admin/hr/timesheets/${entry.id}`** via `next-intl`'s locale-aware navigation. **`entry.id`.**
- [ ] 🔴 **Drop the `entry.shiftId &&` gate.** The werkbon is the **entry's** document. **An entry clocked without a shift still has hours, a description, photos and a client who must sign.** Florin's own current use is exactly this case.
- [ ] 🛑 **Never add `'werkbon'` to `ENTITY_MAP`** — it is not a Prisma model.

## 2b · 🔴 THE DOCUMENT PRINTS A FALSE STATEMENT
```tsx
// :226 — under the CLIENT's blank signature line
<p>Gevalideerd op {format(new Date(), 'dd/MM/yyyy')}</p>     // "Validated on <today>"
```
**It asserts the client validated the work today — printed above an unsigned line, before anyone has signed.** 🔴 **This document goes to the party who pays Florin. A pre-printed validation date is a claim the record cannot support.**
- [ ] **Replace with a blank `Datum:` rule for the signer to fill in**, beside the signature line. 🛑 **Never print a date the signer did not give.**
- [ ] **The header timestamp at `:141` is `new Date()` too** — that one is legitimate as *printed on*, but **label it** (`Afgedrukt op`), so it cannot be read as the validation date.

## 2c · THE OTHER DEFECTS ON THE PAGE
- [ ] 🔴 **`Export PDF` (`:122`) has NO `onClick`. It is a dead button on a document Florin sends out.** Either wire it (`window.print()` to a PDF target is acceptable and needs no dependency) **or remove it.** 🛑 **Do not leave it.**
- [ ] **Everything is hardcoded Dutch and `locale: nl` is hardcoded in every `format` call.** Use the locale-aware helpers — **`src/lib/format/date.ts` (`DEFAULT_LOCALE = 'nl-BE'`, `resolveLocale`)** — and translation keys. *(Florin's standing rule: localise, do not hardcode. The end client may not be Dutch-speaking.)*
- [ ] 🟨 **`ID: {entry.id.slice(-8).toUpperCase()}`** is a cuid fragment, not a document number. **It is what the order giver will quote back.** 🛑 **Do not invent a numbering scheme here** — report it as a question for Florin.
- [ ] 🟨 **The page fetches every clock entry and every employee to render one** (its own comment admits it). **Report; do not fix here.**
- [ ] 🔴 **`entry.project` is declared in the interface and NEVER POPULATED** — the fetch loads only `clock-entries` and `employees`. **So "Project / Locatie" always prints `Algemene Werken` / `N/A`.** On a sign-off document, **the client cannot tell which site the hours belong to.** **Populate it.**

---

# `HR-TS-3` · THUMBNAILS — render both. Florin: *"render it"*

```prisma
ClockEntry.photos     Json?     // rendered on the A4 page, never in the detail pane
ShiftAttachment { shiftId, name, url, type, size }   // rendered nowhere at all
```
**Both are live and both are needed** — the entry carries what the worker shot on the spot, the shift carries what was attached to the planned work. 🟨 **Not one concept after all: one is evidence of the moment, the other is material for the job.** *(Recorded because rev 1 called this defect shape #1. It is not — `pd.md` 4z: two things sharing a word are not one concept.)*

- [ ] **A thumbnail grid in `TimesheetEntryDetail`**, beside the existing Locations / Attribution columns, **showing both sources, visually distinguished** — the entry's own photos, and the parent shift's attachments.
- [ ] 🔴 **ONE URL RESOLVER, exported, used by BOTH surfaces:**
  ```ts
  url.startsWith('t_') ? `/api/files/${url}` : url     // today only at [id]/page.tsx:208
  ```
  🛑 **Do not write a second copy.** Lift it into one helper; the A4 page calls the same one. *(Two copies of a resolution rule is how `INC-1` began.)*
- [ ] 🔴 **`photos` is `Json?` — it may be `null`, an object, or a string.** The A4 page already defends with `Array.isArray(rawEntry.photos) ? … : []`. **Use the same guard; never assume an array.**
- [ ] **Non-images get a file-type chip, not a broken `<img>`** — `ShiftAttachment.type` exists for this.
- [ ] **Click opens full size in a new tab.** 🛑 **No lightbox dependency.**
- [ ] **`size` is `Int?` — nullable. Render nothing, not `0 KB`.**
- [ ] **The A4 page renders the shift's attachments too**, through the same helper — **the client signs for the evidence they can see.**

---

# `HR-TS-4` · PROJECT FILE LIBRARY — 🛑 DESIGN ONLY, NO CODE THIS PASS

**Florin, verbatim:** *"the photo belongs to the moment, indeed, but the project must be able to reference and pull that into the project library… doesn't have to move the file, just be able to access it when the werkbon gets a project assigned. And if project changes… the new project has to be able to reference the attachment. So projects do not appropriate themselves of the attachments, they just gather them under a common umbrella for reference and management."*

## 🟢 THE RULE THIS SETTLES
> ### A project's file library is DERIVED, never owned.
> **The file belongs to the moment that produced it. The project is an attribute of that moment, and attributes change.**
> A project's library is **a query** — *the attachments of every entry and shift currently attributed to this project* — **not a table of rows pointing at files.**

**Why this is the only correct shape, and not merely the convenient one:**
- 🔴 **Re-attribution is automatic.** Change the entry's project and the file follows in the same instant. **A join table would leave the file filed under the old project, and nothing would ever detect it.** *(`pd.md` 4x: hours are the fact, the project is a changeable attribute — **the same holds for a photo.**)*
- 🟢 **No migration, no backfill, no new model.** Nothing can drift out of sync because there is no second copy to drift.
- 🔴 **It makes the wrong state unrepresentable** — a file cannot be in two project libraries, or in a library whose project no longer owns the work. *(`pd.md` 4w, question five.)*

- [ ] 🛑 **`useProjectAttachments` is a 42-line scaffold in which EVERY function is a no-op** and `attachments` is a `useState` never set. **Do not extend it. Do not delete it** — `EditShiftDialog` imports its `ProjectAttachment` type. **It is replaced by `FILES-0`, not patched.**
- [ ] 🛑 **`ProjectMedia` is NOT the destination.** `portalId` is **required**, `projectId` optional; its only writer is `api/portals/media/route.ts`; `scope-rules.ts` classifies it `{ through: 'portal' }`. **It is the client portal gallery.** 🔴 **Writing werkbon photos into it would publish them to the client as a side effect of filing.** *(`coral-portal-two-party-record.md`: client visibility is always a deliberate act.)*

## THE TWO QUESTIONS THAT REMAIN FOR FLORIN
1. **Can a project reference a file that came from nowhere** — an uploaded plan, a permit? **If yes, the library is a union: derived rows plus owned rows**, and only the owned ones need storage.
2. **Which of the derived files does the client see in the portal?** 🔴 **Derivation must not become publication.**

---

# VERIFY
1. 🔴 **Click Approve on a real entry. If it fails, the MESSAGE IS ON SCREEN.** Report it verbatim.
2. **Approve and Deny are visible without hovering**, on desktop **and on a phone**, and look like buttons.
3. **Clicking Approve approves and does NOT toggle the detail pane.**
4. **A running entry:** Approve disabled **with a reason**; Deny enabled.
5. **After approving, `approvedBy` is populated** and the row shows it.
6. **"Bekijk werkbon" opens the A4 page** — for an entry **with** a shift and one **without**.
7. 🔴 **Print the werkbon. No date appears under the client signature line.** The project name is real, not `Algemene Werken`.
8. **`Export PDF` either works or is gone.**
9. **Thumbnails render from both sources**, through **one** resolver. `grep -rn "startsWith('t_')" src/` → **one site.**
10. **An entry with `photos: null` renders an empty state, not a crash.**
11. `test:compile` · `test:lint` · suite — exit 0.

## PROHIBITIONS
- 🛑 **Do not add `werkbon` to `ENTITY_MAP`.**
- 🛑 **Do not print any date the signer did not provide.**
- 🛑 **Do not write a second `t_` resolver.**
- 🛑 **Do not touch `useProjectAttachments` or `ProjectMedia`.**
- 🛑 **Do not create a project-to-file join table.** `HR-TS-4` is derived by design.
- 🛑 **Do not guess at the approve failure.** Surface the message, report it, then fix.
