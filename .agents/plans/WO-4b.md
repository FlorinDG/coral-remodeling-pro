# PLAN — WO-4b · the signed work order PDF: generated at signing, reviewed by an admin, then sent

Planner 2026-10-04. Decided by Florin: the PDF is generated at signing and stored once (walkdown §11a); sending is
NOT automatic — an admin reviews first, like hours approval (2026-10-03); file name = localised "Werkbon" + work
order number + date (2026-10-03); printed: shift description + crew notes, never admin notes (§14).

## Canonical shape (kernel → core → seraph)
- **Renderer** (done, WO-4a): `renderSignedWorkOrderPdf(input)` — pure, no global patches (M4).
- **Core** `lib/data/werkbon.ts` (new): `buildWerkbonInput(db, anchorShiftId)` from the FROZEN signing evidence
  (the AuditLog `sign` row — never live rows that may have changed since); `generateWerkbon` → storage + one
  `ShiftAttachment` on the anchor shift + AuditLog `werkbon-pdf` (key, number, file name); `approveWerkbon`;
  `sendWerkbon` (Resend, the stored bytes, never re-rendered).
- **State as facts, no migration:** pdf / approved / sent are append-only AuditLog rows on the anchor shift
  (`werkbon-pdf`, `werkbon-approve`, `werkbon-sent`) — the same pattern as the signing lock. The review queue is
  "signed, has a pdf, not sent". A failed generation leaves "signed without pdf" → regenerated from the evidence.
- **Seraph:** every read/write on the scoped client (session for the admin; systemScope for regeneration).

## Steps
1. **M1 — generate at signing.** After the signing transaction commits (signing never fails because a PDF did):
   number, render, store, attach, audit row. The crew phone sees "signed"; the PDF appears on the work order's files.
2. **M2 — the review queue** in the ERP: list, open the PDF, approve, send; flagged when no recipient email.
3. **M3 — send (manual)**: a separate button after approval; recipient pre-filled (order giver → project client →
   typed), copy to the tenant; the stored PDF attached; `werkbon-sent` row; a failed send stays in the queue.

## Decisions (Florin 2026-10-04)
- **Number:** `WB-YYYY-NNNN` per tenant and year, assigned AT SIGNING inside the serializable signing transaction and
  frozen in the evidence.
- **Language:** the order giver's language (client record `language`), Dutch when unset.
- **Queue:** ERP Timesheets, a new tab "Werkbonnen": signed, not yet sent.
- **Sending is a separate, purely MANUAL act** — approving never sends. Recipient email pre-filled: the shift's order
  giver (contactPage) → else the project's client → else typed; the tenant gets a copy.
- **New concept — END CLIENT vs ORDER GIVER:** our client may be a main contractor; the work order goes to the ORDER
  GIVER, who presents it to their own client (we have no say over their rates and terms). Roadmap: END-CLIENT-1.
