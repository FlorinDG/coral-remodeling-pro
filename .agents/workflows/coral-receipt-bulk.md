# CORAL — BULK RECEIPT / PURCHASE-INVOICE PROCESSING (Planner spec 2026-07-12)

> ## 🔴 ESCALATED — TOP PRIORITY (Florin 2026-07-12): "295 scanned receipts to add, plus more to scan — without automation I won't finish this year."
> Real backlog of 295+ digitized receipts; one-at-a-time through the modal is not viable. Build **RCPT-L1-MULTI** (multi-file/bulk drop → staging zone) + **RCPT-L2-QUEUE** (quota-aware OCR pipeline) FIRST — that alone lets Florin drop all 295 at once and process them into the review zone. **RCPT-L3-GATE** (auto-confirm) then decides how many he reviews by hand vs. bulk-approves.
> **PREREQUISITE before the batch — set `scanQuota` to unlimited.** 295 ≫ the default 30/month cap → he'd hit the wall at receipt #31. Superadmin → Tenants → Coral → Monthly Quota = **-1** (no code, no deploy). Ship the core scan fixes WITH the batch for reliability at scale: **SCAN-DATA-PERSIST**, **SCAN-RECEIPT-TOTAL-NOT-NETTO**, **SCAN-MOBILE-CAMERA-FALLBACK**.
> **NOTE:** OCR + DB writes run on Florin's tenant (his OCR keys, his production data) — Planner can't run the batch; it must be the built feature, run by Florin. Planner CAN prep the 295 files (inventory, de-dup, split multi-receipt PDFs) if they're in a workspace folder.

**Goal (Florin):** upload receipts/supplier invoices **in bulk**, OCR-process them into a **staging zone where they're processed but NOT yet approved**, **auto-confirm** the ones OCR can validate on its own, and route everything OCR **can't autonomously confirm to manual approval**. Implemented as a **status on the expense record + a dedicated database view**.

**What exists today (build on, don't reinvent):** `db-expenses` ("Purchase Invoices") is a dynamic NotionGrid DB → we can add a status property + a saved view. `/api/scan` does OCR for ONE file (Mindee/Veryfi, AI extraction) and is gated by `scanQuota`. `TicketCaptureModal` captures ONE doc → reviews in-modal → saves as final (no staging, no status). Attachments already go to Blob (`t_{tenant}/expense/{id}/`). Duplicate detection is specced separately (**FIN-10**) — reuse it. **Gap:** no bulk intake, no staging status, no approval gate, no review view.

---

## PART 1 — SCENARIOS (run before scoping)
- **S1 Bad OCR silently posts.** A misread total/VAT lands straight in the ledger and corrupts the VAT return. *Mitigation: nothing posts to financials until `Approved`; only human-approved records count.*
- **S2 Confident-but-wrong.** OCR is "confident" yet the supplier is new/mismatched or it's a duplicate. *Mitigation: auto-confirm requires ALL gates (fields + reconciliation + known supplier + not-duplicate + confidence), not just the engine's confidence score.*
- **S3 Quota blowout.** A 60-file drop burns the scan quota mid-batch. *Mitigation: throttle/queue; on quota exhaustion the remainder stay `Queued` with a clear message, nothing lost.*
- **S4 Duplicate re-upload.** Same receipt dropped twice (or already in the ledger). *Mitigation: FIN-10 dedupe → flag `Needs Review: possible duplicate`, never auto-confirm.*
- **S5 Junk/unreadable file.** Encrypted PDF, photo of a wall, non-invoice. *Mitigation: `Failed` status with the reason; never blocks the batch.*
- **S6 Lost work.** Browser closed mid-batch. *Mitigation: records are created server-first at intake (status `Processing`), OCR is async — closing the tab doesn't lose them; they're already in the zone.*

---

## PART 2 — ARCHITECTURE (status + zone + view)
**Status property** on `db-expenses` — a `select` `reviewStatus` (NL-primary labels, i18n): `In verwerking` (Processing) · `In wachtrij` (Queued) · `Na te kijken` (Needs Review) · `Klaar` (Ready — OCR-validated, awaiting human OK) · `Goedgekeurd` (Approved — posted) · `Mislukt` (Failed). Plus a `reviewReason` (text/select) explaining WHY a record needs review (missing field / totals mismatch / unknown supplier / possible duplicate / low confidence / OCR failed), and `ocrConfidence` (number) for transparency.

**The zone = a dedicated saved view** on `db-expenses`: "**Inbox / Te verwerken**" filtered to `reviewStatus != Goedgekeurd` (everything not yet approved), sorted **Needs Review first, then Ready**, showing the reason tag, the extracted fields (inline-editable), and the source-file thumbnail. Approved records drop out of the inbox and appear in the normal Purchase-Invoices ledger view.

**Financial isolation:** only `Goedgekeurd` records count toward expense totals, the VAT return, and the dashboard. Everything in the zone is excluded until approved (so a half-processed batch never skews the books).

---

## PART 3 — CODER SUBTASKS (per layer; one commit each; verify = acceptance)

**L1 · Bulk intake**
- `RCPT-L1-MULTI` — the AI Document Import modal accepts **multiple files** (multi-select + multi-drop; later: a folder). For each file: server-first create an `db-expenses` record with `reviewStatus = In verwerking`, attach the file to Blob, return fast. Verify: dropping 10 files creates 10 records in the zone immediately, each with its file attached.

**L2 · OCR pipeline (async, quota-aware)**
- `RCPT-L2-QUEUE` — process the batch through the existing `/api/scan` per file, **throttled/queued** to respect `scanQuota`. On success populate the extracted fields (supplier, date, doc number, ex-VAT, VAT, incl, supplier VAT/KBO, line items). On quota exhaustion, remaining files → `In wachtrij` with a clear message (resume when quota resets or is raised). On OCR error (encrypted/load/non-invoice) → `Mislukt` + `reviewReason`. Verify: a batch larger than remaining quota processes up to the limit, parks the rest as Queued, none lost.

**L3 · Autonomous-confirmation gate (the core "can OCR confirm it?" logic)**
- `RCPT-L3-GATE` — after OCR, set `reviewStatus = Klaar` (auto-confirmable) **ONLY when ALL pass**: (a) required fields present — supplier, date, total incl, VAT amount, supplier VAT/KBO number; (b) **amounts reconcile** — ex-VAT + VAT == incl (within rounding) AND VAT ≈ ex-VAT × rate; (c) supplier **matched** to an existing supplier (or a high-confidence new-supplier); (d) **not a duplicate** (FIN-10); (e) `ocrConfidence` ≥ threshold. Any gate fails → `Na te kijken` + a specific `reviewReason`. Verify: a clean known-supplier invoice → Klaar; a totals-mismatch or unknown-supplier or duplicate → Na te kijken with the right reason.

**L4 · The review zone (status + view + bulk actions)**
- `RCPT-L4-STATUS` — add `reviewStatus` / `reviewReason` / `ocrConfidence` properties to `db-expenses` (system-schema addition; migrate existing records to `Goedgekeurd` so the ledger is unchanged).
- `RCPT-L4-VIEW` — create the "Inbox / Te verwerken" saved view (filter/sort per Part 2) with inline-editable fields + source thumbnail + reason tag.
- `RCPT-L4-BULK` — bulk actions in the view: select many → **Approve** (for `Klaar` rows, one click / bulk-approve-all-Ready), **Reject/Delete**, **Re-scan**. `Na te kijken` rows: user corrects fields inline, then Approve (approval blocked until required fields valid + amounts reconcile). Verify: bulk-approve all Ready in one action; a Needs-Review row can't be approved until fixed.

**L5 · Approval → posting + audit**
- `RCPT-L5-POST` — Approve sets `reviewStatus = Goedgekeurd`, records approver + timestamp, and the record now counts in financials/VAT/dashboard. Un-approving/rejecting removes it from the books. Verify: only Approved records appear in expense totals + the VAT return; approving one updates the dashboard.

---

## PART 4 — DECISIONS
- **DECIDED (Florin 2026-07-12): NO auto-post. Every record gets one human look before it posts — even `Klaar`.** OCR never approves itself; `Klaar` only means "pre-validated, safe to approve fast." Approval is always a human action (bulk-approve-all-Ready is one click, but the human must take it). Nothing reaches the books without a person confirming. This governs `RCPT-L3-GATE` (Klaar is a staging state, never Approved) and `RCPT-L5-POST` (posting requires the human approve action).

### Still open
- **`ocrConfidence` threshold** + which engine signal (Mindee/Veryfi confidence vs the AI extraction's own certainty).
- **Reconciliation tolerance** (rounding cents) for the amounts-match gate.
- **Status labels** — confirm NL wording above.
- **Scan-quota UX** — surface "X of Y scans used, batch will consume N" before running a big batch.

---

## PART 4b — 🟥 RCPT-L4-HANDOFF — the import completes but never tells the user (Florin live, 2026-07-29)
**Symptom:** *"it uploads successfully, as it appears, but does not go to the next step."*

**The pipeline is FINE — verified end to end.** `AiDocumentImportModal.tsx:38-68` creates the stub (`reviewStatus: 'In verwerking'`, `source: 'src-scan'`), uploads the file, calls `/api/scan`, and the scan **already sets the gate outcome** — `reviewStatus = 'Klaar'` or `'Na te kijken'` with a specific `reviewReason` (`api/scan/route.ts:480-507`). RCPT-L1/L2/L3 are implemented. **Do not rebuild any of that.**

**What's missing is only the client handoff:**
1. **No completion prop.** The modal exposes `onClose` only; the page renders it with `onClose` alone (`financials/expenses/invoices/page.tsx:248-251`). The parent cannot know a job finished.
2. **The store is never told.** `createPageServerFirst` writes server-side; the Zustand store that drives the grid is not updated, so the new record is invisible until a full reload.
3. **No navigation** to `Inbox / Te verwerken`, where the record now lives.
4. **The per-file status throws away the useful information.** It shows a generic `Done` when the scan already returned `Klaar` / `Na te kijken` + reason.

### FIX
- [ ] **RCPT-L4b-1 · `onComplete` handoff** 🟥 — add `onComplete(summary)` to the modal; the parent refreshes the store and switches to the **Inbox / Te verwerken** view. Summary shape: `{ total, ready, needsReview, failed }`.
- [ ] **RCPT-L4b-2 · Live store update** 🟥 — after each job, insert/refresh the created page in the store so the grid updates **as documents complete**, not on reload. (Server-first create + no client sync is the same gap that made column visibility "not stick" — see `pd.md` FORCING FUNCTIONS #1.)
- [ ] **RCPT-L4b-3 · Show the real outcome per file** 🟧 — replace `Done` with the scan's own verdict: **`Klaar`** (green) or **`Na te kijken — <reviewReason>`** (amber, e.g. *"Bedragen komen niet overeen"*, *"Ontbrekende velden"*), `Mislukt` + error (red). The data is already in the scan response; it's the difference between "something happened" and "this one needs your eyes".
- [ ] **RCPT-L4b-4 · A closing action, not an auto-close** 🟧 — when all jobs finish, show a one-line summary and a primary button **"Bekijk in Inbox (N)"** which closes the modal and lands on the filtered Inbox view. **Do not auto-close** — the per-file outcomes are the point of the screen (`pd.md`: the system surfaces, the user decides).
- [ ] **RCPT-L4b-5 · Localise** 🟨 — all of the above strings in `en/nl/fr` per the LOCALISATION DIRECTIVE. The modal is currently hardcoded English (`AI Document Import`, `Drop multiple invoices or receipts`, `Click or drag files here`, `Done`).
- **Verify:** drop one PDF → it appears in the grid within seconds without a reload → its per-file row shows `Klaar` or `Na te kijken` with the reason → "Bekijk in Inbox (1)" lands on the record → the same holds for a 5-file drop, sequentially.

---

## PART 5 — EMAIL-TO-INBOX INTAKE (the Billit "mail a receipt" feature) — Planner spec 2026-07-25
**Florin:** "Billit lets you *mail* a receipt — the system scans it and puts it in a waiting chamber for approval. It used to work for invoices too, but Peppol changed that."

**The insight:** email intake is just a **new intake mouth** on the pipeline that already exists. A mailed attachment → OCR (RCPT-L2) → confirmation gate (RCPT-L3) → the **same "Inbox / Te verwerken" review zone** (RCPT-L4) → human approve → post (RCPT-L5). No new downstream. This is `RCPT-L1-EMAIL`, a sibling of `RCPT-L1-MULTI`.

**Why receipts and not invoices anymore (the Peppol point):** structured invoices now arrive over the **Peppol** network (machine-readable, already routed — see Peppol inbound work). Email intake is therefore aimed at what Peppol does NOT cover: **kassabonnen / receipts** and **PDF invoices from small suppliers not yet on Peppol**. The scan engine's TICKET-vs-INVOICE classification already sorts these, so accept both — just don't position it as the invoice channel.

### FLOW
Supplier/Florin/crew forwards or mails a document to the tenant's private intake address → email provider POSTs a webhook → we resolve the address to exactly one tenant → for **each attachment** (pdf/jpg/png/heic): server-first create a `db-expenses` record `reviewStatus = In verwerking`, `source = email`, store the file to Blob (`t_{tenant}/expense/{id}/`), stamp email provenance (from-address, subject, received-at, provider messageId) → enqueue through the existing OCR pipeline → gate → lands in the waiting chamber. Multiple attachments in one mail = multiple records. Email body (if any) captured as the record note.

### CODER SUBTASKS
- **`RCPT-L1-EMAIL-ADDR`** — per-tenant **unguessable inbound address**. Generate a random token address, e.g. `bonnetjes.<token>@in.coralos.app` (token = random, NOT the tenant slug — slug is guessable and would let anyone inject documents into a known tenant's books). Store `inboxToken` on the tenant, surface it in **Settings → Expenses/Scan** with copy-button + a "regenerate" action (rotating invalidates the old address). Verify: two tenants get distinct tokens; regenerating changes the address.
- **`RCPT-L1-EMAIL-HOOK`** — inbound webhook `POST /api/inbox/receipt` (mirror the existing `api/stripe/webhook` signature-verify pattern): (a) **verify the provider signature/secret** — reject unsigned; (b) resolve the recipient token → `tenantId`; **unknown/invalid token → drop + log, NEVER fall back to a default tenant** (standing tenant-isolation rule; an unresolved address must not write anywhere); (c) for each attachment create the record as above under the resolved `tenantId`; (d) idempotency: skip if the provider `messageId` was already ingested (same mail delivered twice). Verify: a signed test mail with 2 attachments to tenant A's address creates 2 records on tenant A only; a mail to a bogus token creates nothing.
- **`RCPT-L1-EMAIL-SENDER`** — sender handling. Default: **accept any sender** but if the from-address isn't a known tenant user / configured supplier, tag `reviewReason = onbekende afzender (unknown sender)` so the human sees it in the zone — never auto-confirm an unknown-sender mail regardless of OCR. Optional per-tenant **allowlist toggle** (Settings): when on, only accept mail from listed addresses, silently drop the rest. Verify: unknown-sender mail lands in the zone flagged; with allowlist on, an off-list mail is dropped.
- **`RCPT-L1-EMAIL-DEDUP`** — reuse the FIN-10 / strict dedup helper on the ingested content (date+number+supplier for invoices; date+amount+shop for tickets) so a receipt mailed *and* also bulk-dropped doesn't double-post → `Na te kijken: mogelijk duplicaat`. Plus the messageId guard above for the transport layer.
- **`RCPT-L1-EMAIL-ACK`** *(optional, phase 2b)* — auto-reply to the sender: "Received N document(s), now in your review inbox." Sending mail is a side-effect + costs a send; make it a Settings toggle, default OFF.

### PROVENANCE (add to the status schema in RCPT-L4-STATUS)
Add a `source` property to `db-expenses` (`manual | scan | email | peppol`) and email-meta fields (`sourceEmailFrom`, `sourceEmailSubject`, `sourceReceivedAt`, `sourceMessageId`). Lets the zone show a ✉ badge + "from x@… on <date>" and supports the dedup/idempotency guards.

### DECISIONS (Florin)
- **Address scheme** — random token address per tenant (recommended, above), vs tenant-slug address (guessable, rejected). Confirm.
- **Inbound email provider** — outbound is already **Resend** (`billing@coral-group.be`, `src/lib/trial.ts`), and **Resend now supports Inbound email** → use it: same vendor, same verified domain, one API key, a webhook that mirrors the Stripe pattern. Just add MX on a subdomain (`in.coral-group.be` / `in.coralos.app`). Fallbacks if Resend Inbound falls short: Postmark Inbound or Cloudflare Email Routing→Worker. This is the one true infra prerequisite — the rest is code. (NB: an in-app IMAP/SMTP client also exists — a "forward to a watched folder" poll is a possible alt path, but a dedicated inbound address is cleaner and is what Billit does.)
- **Sender allowlist** — default accept-any-and-flag (recommended) vs strict allowlist. Confirm default.
- **Ack email** — send a "received" reply, yes/no (default no).
