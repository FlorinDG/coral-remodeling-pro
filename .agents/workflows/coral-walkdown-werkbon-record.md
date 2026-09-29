# CORAL — WALKDOWN — THE WERKBON IS A RECORD, NOT A RENDERING — Planner 2026-09-29

> **Florin:** *"a werkbon signed by client bypasses approval altogether. It is signed by who pays. It is effectively FROZEN to ALL EDITS. It is the base for invoicing, and the submit button should actually lock the file, and ideally send a transactional mail to the client, to the order giver with the copy of it. Since there is a cascade of invoicing, the end client will get their invoice and proof from their direct collaborator, we are third party in this sense."*

🛑 **NOT A DIRECTIVE. Nothing here is coded until the questions in §6 are answered.**

---

# 1 · THE ONE SENTENCE THAT CHANGES EVERYTHING

## Today the werkbon is a **view** of a `ClockEntry`.
`[id]/page.tsx` fetches the entry and draws A4. **It has no identity, no state, no lifecycle.** Refresh it and it is rebuilt from whatever the entry says *now*.

## Florin is describing a **record**: it is signed, frozen, sent, and invoiced against.
🔴 **You cannot freeze a view.** A view shows the current value of its source; freezing it means freezing the source, and the source is a clock entry that other things legitimately still write to.

> ### The werkbon must become a document with its own row, its own id, and its own lifecycle.
> **The signature does not belong to the clock entry. It belongs to the document the client actually looked at.**

**This is the same shape as the quote.** A quote is not a view of a price list — it is a row that was *sent*, *seen* and *accepted*, and it keeps what it said at that moment even if the price list moves. 🟢 **The werkbon is that, for hours.**

---

# 2 · TWO AUTHORITIES, AND THE SIGNATURE IS THE SUPERIOR ONE

**Florin: *"bypasses approval altogether… signed by who pays."***

| | Internal approval | Client signature |
|---|---|---|
| Who | a tenant admin | **the party who pays** |
| Answers | *do we accept these hours internally* | **is this owed** |
| Reversible | yes, with the unlock | 🔴 **NO** |

- **These are different facts with different sources, and they must not be collapsed.** *(`pd.md` 4z — each concept defined, then frozen. Two authorities sharing the word "approved" is exactly the trap.)*
- 🔴 **`approvalStatus` must NOT be set to `'approved'` by a signature.** That would make an external act indistinguishable from an internal one, and **the audit could never separate them again.**
- 🟢 **"Bypasses" means the signature makes internal approval IRRELEVANT for invoicing — not that it fills the field in.** An unapproved, signed werkbon is invoiceable. An approved, unsigned one is not.

---

# 3 · FROZEN MEANS SOMETHING STRONGER THAN WHAT EXISTS

The codebase has **three** freeze mechanisms already, and **none of them is strong enough**:

| Mechanism | Strength |
|---|---|
| `approvalStatus = 'approved'` | 🔴 **soft** — `verifyUnlockCookie` (`route.ts:642`) exists precisely to allow editing approved entries |
| `editedAfterApproval` | 🟨 **records** a violation; does not prevent one |
| `accountantExportedAt` | 🟢 **hard** — `timesheet-rates/undo` refuses outright. **This is the precedent to follow.** |

- [ ] 🔴 **A signed werkbon has NO unlock path.** *"Frozen to ALL EDITS"* is Florin's phrase and it is the right one: **the unlock cookie must not apply.** 🛑 **If an admin could unlock it, the client's signature would certify a document that can still change — and that is a document you cannot put behind an invoice.**
- [ ] **What the freeze covers is a real question** — see §6 Q3. **The hours, certainly. The project attribution? The photos?** 🔴 **If a photo can be added after signing, the client signed for evidence they never saw.**
- [ ] 🟢 **Correction after signing is a CREDIT, not an edit** — a second werkbon that supersedes the first, both preserved. **The same way an invoice is corrected.** 🛑 **Never by mutating a signed document.**

---

# 4 · THE CASCADE — Florin is the third party

```
  end client  ←──invoice+proof──  order giver  ←──invoice──  FLORIN (tenant)
       │                                │
       └────── signs the werkbon? ──────┘          ← 🔴 Q1: WHICH ONE?
```
**Florin invoices the ORDER GIVER. The end client is invoiced by the order giver, not by Florin.**

- 🟢 **The schema already carries this distinction:** `enum PortalAudience { CUSTOMER, CONTRACTOR }`. **The two-party split is not new work — it is already modelled and unused here.**
- 🔴 **Florin's sentence is ambiguous on the one point that decides the design:** *"signed by who pays"* (= the order giver, who pays Florin) versus *"to the client, to the order giver"* (= two distinct recipients). **Q1 in §6.**
- 🔴 **A werkbon copy to the end client is EVIDENCE, not a commercial document.** 🛑 **It must carry no rate, no cost, no total.** 🟢 **The current A4 shows hours only and no money — that is correct and must stay correct.** *(`timesheet-export`'s `Kosten per uur` is employer cost; **it must never reach this document.**)*

---

# 5 · WHAT ALREADY EXISTS — 🟢 build on it, do not invent

| Need | Existing | Note |
|---|---|---|
| Client signature | **`acceptQuotation`** — `clientSignature` (base64), `signatureMethod: 'draw'\|'type'\|'upload'`, `consentName` | 🔴 **The canonical client-signing shape. REUSE IT.** 🛑 Do not invent a second. |
| Transactional mail | `src/lib/email.ts`, `src/emails/*.tsx`, Resend wired | `InvoiceEmail`, `QuotationEmail` are the templates to pattern from |
| Hard freeze | `accountantExportedAt` + the `undo` refusal | the strength to copy |
| Two audiences | `PortalAudience { CUSTOMER, CONTRACTOR }` | already there |
| Signature storage | `HrDocumentAcknowledgment.signatureData` | 🟨 internal only — **a different concept** (employee acknowledging a policy). **Do not reuse.** |
| A4 + print | `[id]/page.tsx` | 🟢 **the rendering is done and good.** It becomes the document's *view*. |

🔴 **Signing happens on a phone, on a site, by someone with no ERP account.** That is a **public tokenised link**, like the quote link — **not a portal login**. 🛑 **Do not require the client to have a portal account.**

---

# 6 · 🔴 THE QUESTIONS — Florin answers before anything is specified

**Q1 · WHO SIGNS?** The order giver (who pays Florin), the end client (on whose site the work happened), or either depending on the job? 🔴 **This decides whether the werkbon has one signatory or two, and whether "who pays" and "who is present" are the same party.**

**Q2 · WHAT IS ITS SCOPE?** Today the page is one clock entry. **Is a werkbon one entry, one worker's day, a whole crew's day, or a date range on one project?** 🔴 **If a client signs for a day's work by three people, a werkbon keyed on one entry cannot represent it** — and this decides the whole model.

**Q3 · WHAT DOES THE FREEZE COVER?** 🟢 **ANSWERED — see §9. Everything on the document.**

**Q4 · WHAT IF THEY WON'T SIGN?** A client who refuses, or is absent. **Is there an unsigned path to invoicing** — internal approval as the fallback authority — **or is the work uninvoiceable until signed?**

**Q5 · DOES SENDING EQUAL LOCKING?** Florin said *"the submit button should actually lock the file"* **and** *"ideally send"*. 🔴 **If the mail fails, is the document still locked?** 🟢 **Recommended: lock and send are separate facts** — `lockedAt` and `sentAt` — **because a mail failure must never leave a signed document editable.** *(This is `CORE-3`'s lesson: the record and its side effect must not be able to disagree.)*

**Q6 · WHERE DOES INVOICING READ IT?** *"the base for invoicing"* — does an invoice line reference a werkbon id, and **can one werkbon be invoiced twice?** 🔴 **If the answer is no, the werkbon needs an `invoicedAt` the way it needs a `lockedAt`.**

---

# 7 · WHAT THIS MEANS FOR WORK ALREADY QUEUED

- 🟢 **`HR-TS-2` (link the button to the A4 page) STILL SHIPS AS-IS.** The rendering is right and Florin needs it working today. **It becomes the record's view later.**
- 🔴 **`HR-TS-2` §2b is now MORE urgent, not less.** The page prints `Gevalideerd op {today}` under an unsigned line. **On a document that will become the legal basis for invoicing, a pre-printed validation date is indefensible.** **Remove it now, before anything is built on this page.**
- 🟨 **`HR-TS-7` §5c is answered.** **The werkbon does NOT show internal approval status.** 🟢 **The client's signature is the authority on this document; internal approval is the tenant's own bookkeeping and is not the client's business.** **Remove `approvalStatus` from that page's interface.**
- 🔴 **`HR-TS-5`'s edit pane must eventually respect the werkbon lock.** **Record it now so it is not forgotten** — an entry under a signed werkbon is not editable from the timesheet either.
- 🟨 **`HR-TS-3`'s thumbnails feed this.** **What the client signs for includes the photos they saw.** **Q3 decides whether they are frozen with it.**

---

# 8 · THE SHAPE, IF THE ANSWERS ALLOW IT — sketch only

```
Werkbon
  id · tenantId · documentNumber          ← 🔴 a real number, not entry.id.slice(-8)
  scope            → per Q2
  snapshot   Json                          ← 🔴 WHAT THE CLIENT SAW, frozen at signing
  signature: clientSignature · signatureMethod · consentName · signedAt
  signatory  → per Q1 (CUSTOMER | CONTRACTOR)
  lockedAt · sentAt · invoicedAt           ← three separate facts, per Q5/Q6
```
🔴 **`snapshot` is the load-bearing field.** **A signature certifies what was on the page, not what the row says later.** **Without it, "frozen" is only a promise the application makes; with it, the document is self-evidencing.** 🟢 **This is also what makes `pd.md` 4x survivable: the entry's project may still change, and the signed werkbon still says what the client agreed to.**

🛑 **Do not build any of §8 until §6 is answered.**

---

# 9 · 🟢 Q3 ANSWERED — AND IT RAISES THE HARDER HALF

> **Florin:** *"that is why the document is important, with notes, with attachments, with photos, all present in the A4 formatted form in the doc or attached, so when the signature lands, all gets blocked to every edit, and the copy is sent to the order giver."*

**Q3 is settled: the freeze covers EVERYTHING the document carries** — hours, notes, description, project, attachments, photos. 🟢 **And the document must be SELF-CONTAINED: what the client signed is complete on its face, in the A4 or attached to it.**

## 9a · 🔴 FREEZING A REFERENCE IS NOT FREEZING THE EVIDENCE

**This is the part a `snapshot` of the row does not solve.**

```
snapshot.photos = ["t_abc123", "t_def456"]      ← frozen: the LIST cannot change
/api/files/t_abc123                             ← 🔴 NOT frozen: the BYTES can
```
**A snapshot of the entry freezes *which* files were referenced. It does not stop the file at that URL being replaced, deleted, or expiring.** 🔴 **A year later, in a dispute, the werkbon says "photo 1" and photo 1 is gone — or is a different photo.** **The signature then certifies nothing.**

> ### The signed artefact must be the evidence, not a pointer to it.

- [ ] 🔴 **Render to a FROZEN PDF at signing time, with the photos embedded** — not linked. **That single file is what is stored, what is mailed, and what is produced in a dispute.** 🟢 **It is self-evidencing: no database, no file server, no application needed to read it.**
- [ ] **Store that PDF immutably** and hash it. 🟢 **A hash on the record makes tampering detectable, which is the whole point of freezing.**
- [ ] 🛑 **Do NOT rely on "the app won't let you edit it."** **That is a promise the application makes about itself.** *(`CORE-3` is this month's reminder: the log asserted a change the record never took. A guarantee that lives only in code is not a guarantee.)*
- [ ] 🟨 **The live A4 page stays** — it becomes the *working* view before signing. **After signing, the page must serve the frozen PDF, not re-render from current data.** 🔴 **Otherwise the two disagree and nobody can tell which the client saw.**

## 9b · WHAT THE FREEZE MUST REACH — every writer, not just the pane
**"Blocked to every edit" means every path, and there are more than the timesheet:**
```
TimesheetEntryDetail          hours · project · billable · notes
PATCH /api/hr/clock-entries   the generic CRUD route
shift-attachments             add/delete a file on the parent shift
ClockEntry.photos             whatever writes the photo array
timesheet-rates               cost rate changes
the WorkHub clock itself      a late clock-out landing on a signed day
```
- [ ] 🔴 **Enforce at the ROUTE, not in the components.** *(`pd.md` 5a — a component must not decide its own privilege. **And a lock enforced in the UI is not a lock.**)*
- [ ] 🟢 **`accountantExportedAt`'s refusal in `timesheet-rates/undo` is the pattern**: the write path checks and refuses.
- [ ] 🛑 **A signed werkbon must also block DELETION of the entry and of its attachments** — `ShiftAttachment` cascades on shift delete. **Deleting the shift must not silently gut a signed document.**

## 9c · THE COPY TO THE ORDER GIVER — 🟢 Q1 narrows
**Florin: *"the copy is sent to the order giver."*** 🟢 **The order giver is a RECIPIENT, confirmed.**
- 🔴 **Still open: is the order giver also the SIGNATORY?** *"signed by who pays"* says yes; *"the copy is sent to the order giver"* implies they receive rather than sign. **Q1 stands.**
- [ ] **The mail carries the frozen PDF as an attachment** — 🛑 **not a link.** *(A link expires, requires the app to be up, and can be changed. An attachment is a copy they hold.)* **`InvoiceEmail` / `QuotationEmail` are the templates to pattern from.**
- [ ] 🔴 **No rates, no costs, no totals on the copy** — §4 stands. **Hours and evidence only.**

## 9d · WHAT THIS SETTLES ELSEWHERE
- 🟢 **`HR-TS-3` is now load-bearing, not cosmetic.** **The thumbnails ARE the evidence that gets frozen.** **Both sources — `ClockEntry.photos` and `ShiftAttachment` — must render, or the client signs for material they never saw.**
- 🟢 **`HR-TS-7`'s `notes` field is on the document.** 🔴 **So it is CLIENT-VISIBLE.** **This changes its nature: it is not an internal scratchpad.** 🛑 **Florin must know that an admin note on a signed werkbon leaves the company.** **Q7 below.**
- 🔴 **`HR-TS-2` §2b — removing `Gevalideerd op {today}` — is now BLOCKING.** **That line will be baked into a frozen, mailed, legally-operative PDF.**

## 9e · 🔴 ONE NEW QUESTION
**Q7 · IS `notes` CLIENT-VISIBLE?** Florin asked for notes *on the document*, and for provenance (*"input by admin"*) *in* notes. 🔴 **Those two wants now conflict: internal provenance on a client-facing signed document.** **Recommended: `source` and `createdBy` are structured and stay internal; `notes` is what the admin chooses to say TO the client.** **But Florin decides, because it is his document.**

---

# 10 · 🟢 FLORIN'S ANSWERS — Q1, Q2, Q4, Q7 SETTLED

## 10a · 🔴 THE PLANNER WAS WRONG ON INVOICEABILITY
> **Florin:** *"correct on first, incorrect on second. Second assumption is still defendable in front of the client."*

**An approved-but-unsigned werkbon IS invoiceable.** I said it was not. **Internal approval is a valid authority in its own right** — a tenant vouching for its own workers' hours is defendable. **The signature is not the gate; it is the stronger evidence.**

```
invoiceable  ⟺  signed  OR  internally approved
```
| | strength in a dispute |
|---|---|
| **signed** | 🟢 **the paying party attested it.** Ends the argument. |
| **approved only** | 🟨 **the tenant attests it.** Defendable, contestable. |

- 🟢 **Q4 is answered by the same sentence.** A client who won't sign, or isn't there, **does not block invoicing** — internal approval carries it.
- 🔴 **So the two authorities are PEERS for invoicing and RANKED for evidence.** 🛑 **Neither may overwrite the other.** *(§2 stands: a signature must never set `approvalStatus`. The document must always be able to say which authority it rests on.)*
- [ ] **Every werkbon states its basis on its face** — *attested by the client* or *approved internally*. 🔴 **An invoice built on the weaker basis must be recognisable as such WITHOUT opening the record.**

## 10b · 🟢 Q1 — THE ORDER GIVER RECEIVES, DOES NOT SIGN
**Signatory = the client, on site. Recipient of the copy = the order giver.** 🟢 **One signature block on the document, not two.**
- [ ] 🔴 **The order giver is a recipient with no ERP account.** **Their address is a property of the job or the order giver record — resolve where it comes from before specifying the send.**
- [ ] **`PortalAudience { CUSTOMER, CONTRACTOR }` maps cleanly:** the signer is `CUSTOMER`, the copied party is `CONTRACTOR`. 🟢 **Already modelled.**

## 10c · 🔴 Q2 — ONE SIGNATURE, MANY ENTRIES. **This is the biggest structural consequence.**
> **Florin:** *"if a crew is present… the names of all crew members are on the document, and one signature validates the lot."*

## 🔴 THE WERKBON IS NOT 1:1 WITH A CLOCK ENTRY.
**Today `[id]/page.tsx` is keyed on one entry. That model cannot carry a crew.** The werkbon **covers a SET of clock entries** — several workers, one job, one signature.

- [ ] **The werkbon needs an explicit MEMBERSHIP** — which entries it covers. 🔴 **Recorded, not inferred.** 🛑 **Do NOT define it as a live query (*"all entries on project X on date Y"*).** **A query re-evaluates: a late entry added afterwards would silently join a signed document.** *(This is the one place the derived-view rule of `pd.md` 5d does NOT apply — **a signed document's contents are fixed at signing, which is the opposite of derived.**)*
- [ ] 🔴 **The freeze is TRANSITIVE.** Signing locks **every** constituent entry and **all** their attachments and photos. **§9b's route-level refusal must check membership, not a flag on one row.**
- [ ] 🔴 **An entry may appear on at most ONE signed werkbon.** **Two clients cannot each attest the same hours.** **Enforce it.**
- [ ] **The document lists every crew member by name** — 🟢 **this is `HR-TS-1`/`HR-TS-7`'s name-resolution work paying off. No cuids.**

### 10c-i · 🟨 THE HANDWRITTEN NAMES ARE A DIFFERENT KIND OF FACT
> *"The crew member looking for signature will also add manually the names. In a note, no problem."*

🔴 **A name the system knows (a clock entry exists) and a name a crew member wrote on site are not the same claim.** The first is backed by a record; the second is an assertion made in the field — **and it is exactly the case where someone worked without clocking in.**
- [ ] 🟢 **Render them in the same list, visibly distinguished** — system-known names carry hours; hand-added names carry only a name. 🛑 **Do not merge them into one undifferentiated list**, and **do not silently create clock entries from them.**
- [ ] 🟨 **A hand-written name is a signal that someone's hours are missing.** **Report it to Florin as a follow-up** — not a blocker.

## 10d · 🟢 Q7 — THE NOTE IS CLIENT-FACING BY FUNCTION
> *"a note on the document is not internal by the function, it is explicitly meant to be visible to the client, and will also be stored as internal. Mitigate that how you see best."*

### THE MITIGATION: **two fields, named so the mistake cannot be made.**
🔴 **The danger is not storage — it is a future admin typing an internal remark into a field that prints on a signed document sent to the order giver.** **One field cannot be both, because its name is the only warning anyone gets.**

| Field | Nature | Printed |
|---|---|---|
| **`notes`** — 🔴 **name it for its audience**, e.g. `clientNote` / *"Note on the werkbon"* | what the admin chooses to say **to the client** | 🟢 **YES** |
| `source` · `createdBy` · the audit log | **structured provenance** — how the record came to be, who typed it | 🛑 **NEVER** |

- [ ] 🟢 **"Stored as internal" is already satisfied**: the client-facing note lives on the tenant's record and is fully visible, searchable and exportable internally. **Client-visible does not mean not-ours.**
- [ ] 🔴 **This RETRACTS `HR-TS-7` §3's instruction** to put *"input by admin"* provenance into `notes`. **Provenance is structured (`source` + `createdBy`) and stays off the document.** 🛑 **Never generate provenance text into a client-facing field.** *(The original reasoning holds and gets stronger: `taskDescription` was rejected for printing on the werkbon — `notes` now prints there too.)*
- [ ] **The edit UI must label it as client-visible, at the point of typing.** 🛑 **Not in documentation. On the field.**
- [ ] 🟨 **If Florin later wants a genuinely private remark, that is a THIRD field** and it must never be added to the print template. **Do not build it now.**

---

# 11 · 🟢 THE REMAINDER — ANSWERED

## 11a · Q5 — 🟢 **"A failed send is not a failure if the doc is signed."**
> *"Stored locally and locked. Sent when possible."*

**The signature is the event. The send is a consequence that may lag.**
- [ ] 🔴 **`lockedAt` is written in the same transaction as the signature. `sentAt` is written later, or never.** 🛑 **The send must NEVER be able to block, delay or undo the lock.** *(`CORE-3`: a record and its side effect must not be able to disagree — **and here the side effect is explicitly allowed to be late.**)*
- [ ] 🟢 **The retry needs no new infrastructure.** `vercel.json` already declares crons and `src/app/api/cron/*` holds four jobs (`reminders`, `invoice-overdue`, `trial-check`, `trial-notifications`). **A sweep over locked-and-unsent werkbons is a fifth, patterned on those.**
- [ ] 🔴 **The frozen PDF is generated AT SIGNING, not at send time.** **If it were built when the mail goes out, a late send would render from data that moved.** **Generate once, store, mail the stored bytes.**
- [ ] **Surface unsent documents to Florin.** 🛑 **"Sent when possible" must not become "silently never sent."** **A signed werkbon that has not reached the order giver after N attempts is something a human must see.**

## 11b · Q6 — 🟢 **RECORD IT, DO NOT BUILD IT**
> *"Werkbon cannot be invoiced twice, but this is not a choice you must make now — these are all admin tasks, invoicing is a manual process."*
- [ ] **Add `invoicedAt` to the model so the fact has somewhere to live.** 🛑 **Build no enforcement, no automation, no invoice linkage.** *(Standing principle: **automation is good, but the user remains the ultimate authority.** Invoicing is Florin's judgement, and the record exists to inform it, not to gate it.)*

## 11c · MEMBERSHIP — 🟢 **proposed by shift assignment, amended on site**
> *"Membership is proposed by shift assignment. Crew member can also add other members from a dropdown, the same the shift modal uses, with check boxes. Notes re-enforce this."*

- [ ] **The shift's assigned workers are the PROPOSAL.** **What is signed is what was recorded at signing** — §10c stands: **recorded, never re-queried.**
- [ ] 🟢 **Reuse the shift modal's worker picker.** **`WorkerOption`, frozen by `CSF-1` into `src/components/time-tracker/types/`, with `SearchableSelect` now self-portalling.** 🛑 **Do not build a second worker picker.** 🟢 **`CSF-1` is what makes this a reuse rather than a rebuild.**
- [ ] 🟨 **This REFINES §10c-i.** Added crew are **chosen from known workers, not typed free-hand** — so the *person* is a system fact; only their *hours* are missing. **Still render them distinctly** (named, no hours), **but the earlier concern about unverifiable handwritten names is largely retired.**
- [ ] 🔴 **Adding a crew member to the werkbon does NOT create a clock entry.** **Their hours remain absent and visibly so.** 🛑 **Never manufacture hours from a signature.** **Report these to Florin — a named worker with no hours is missing payroll.**

## 11d · THE ORDER GIVER'S ADDRESS — 🟢 project first, contact as the fallback
> *"Comes from project when fixed, and if no project is assigned to the shift, no problem, add a relation to contacts. At shift creation I choose the contact, and the mail is inserted."*

```
recipient  =  project's contact   ??   shift's contact
```
- [ ] 🟢 **`Contact` already exists** (`schema.prisma:513`) with `email`, `firstName`/`lastName`, **and `language`.** 🟢 **`Contact.language` is the locale for the transactional mail — no guessing, no tenant default.**
- [ ] **`ScheduledShift` has NO contact relation.** **Add `contactId String?` + relation** — 🔴 **additive, nullable, no backfill. FLORIN RUNS THE MIGRATION.**
- [ ] **The contact picker goes in the shift creation modal**, beside the project field. 🛑 **`SearchableSelect` again — no new component.**
- [ ] 🔴 **RESOLVE THE ADDRESS AT SIGNING AND STORE IT ON THE WERKBON.** 🛑 **Do not resolve it at send time.** **A contact's email may change between signing and a lagging send, and the document must record who it was addressed to.** 🟢 **Same reasoning as the frozen PDF: what the document asserts is fixed at signing.**
- [ ] 🟨 **Neither path yields an address → the werkbon still signs and locks.** 🛑 **A missing email must never block a signature.** **It surfaces as unsent, per 11a.**

---

# 12 · STATUS — 🟢 SPECIFIABLE, NOT YET SPECIFIED

**Every blocking question is answered.** This walkdown is now the design of record. 🛑 **It is still not a directive** — it is several passes of work and it must be phased, with `HR-TS-6`/`1`/`2` shipping first because Florin needs the timesheet working today.

**Phasing, when Florin calls for it:**
| | |
|---|---|
| **`WB-A`** | `ScheduledShift.contactId` — migration written, Florin runs it; contact picker in the shift modal |
| **`WB-B`** | the `Werkbon` record + recorded membership + the crew picker. **No signing yet.** |
| **`WB-C`** | signing (reusing `acceptQuotation`'s `clientSignature` shape) + the frozen PDF + `lockedAt` |
| **`WB-D`** | 🔴 **the route-level transitive freeze.** *(Could equally come before `WB-C` — a lock with nothing to lock is safe; signing without the lock is not.)* |
| **`WB-E`** | the cron send + unsent visibility |

🔴 **`WB-D` must not land after `WB-C` in production.** **A signed document that is still editable is worse than no signature at all**, because it looks authoritative and is not.
