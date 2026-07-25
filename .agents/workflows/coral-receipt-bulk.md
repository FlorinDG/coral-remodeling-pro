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
- **`ocrConfidence` threshold** + which engine signal (Mindee/Veryfi confidence vs the AI extraction's own certainty).
- **Reconciliation tolerance** (rounding cents) for the amounts-match gate.
- **Status labels** — confirm NL wording above.
- **Intake channels** — multi-file/drag now; later a dedicated **email-to-inbox** address for suppliers/forwarding (phase 2)?
- **Scan-quota UX** — surface "X of Y scans used, batch will consume N" before running a big batch.
