# CORAL — PROTEST A PURCHASE INVOICE (transactional mail) — Planner spec 2026-07-27

**Florin:** *"we take supplier language and create an option/button to send a mail to protest an invoice. That will attach the PDF, prefill a standard text and open the transactional mail modal."*

**Why it earns its place:** in Belgian commercial practice a purchase invoice that is not protested **promptly and in writing** is treated as accepted — silence is consent between merchants. So a dispute is only as good as the dated, written trace of it. Today protesting means leaving the ERP, writing a mail by hand, finding the PDF, and keeping the evidence somewhere else. This makes it one button and leaves the audit trail **on the invoice record**.
> ⚠️ **VERIFY before any user-facing legal wording:** the exact statutory basis, deadline expectations, and required form for protest under current Belgian law must be checked (and ideally reviewed by Florin's accountant/lawyer) before the templates ship. Do NOT assert legal deadlines in the UI until confirmed. The feature works regardless — this only affects the copy.

---

## FLOW
Purchase-invoice record (`db-expenses`) → **"Protest / Betwisten"** action → reason picker → template resolves in the **supplier's language** → **existing transactional-mail modal opens, prefilled**, with the **original invoice PDF attached** → Florin edits freely → sends → the protest is **stamped on the record**.

**Never auto-send.** Same principle as the receipt inbox: a human reads every outgoing protest. The button prepares, the person sends.

---

## BUILD ITEMS

- [ ] **PROT-1 · ACTION + REASON PICKER** 🟧 — a **Protest** action on the purchase-invoice record detail (and as a row action in the expenses grid). Opens a small dialog:
  - **Reason** (select, drives the template paragraph): `bedrag onjuist` (wrong amount) · `btw onjuist` (wrong VAT / reverse-charge missing) · `niet geleverd` (goods/works not delivered) · `hoeveelheid onjuist` (wrong quantity) · `prijs wijkt af van bestelling` (price differs from order/PO) · `dubbele factuur` (duplicate) · `niet besteld` (not ordered) · `beschadigd/gebrekkig` (damaged/defective) · `andere` (free text).
  - **Free-text detail** (always available, appended to the template).
  - **Optional: disputed amount** — **informational only** (states which part is contested). It does **NOT** trigger partial payment: payment is suspended in full pending a credit note (see decisions).
- [ ] **PROT-2 · SUPPLIER LANGUAGE RESOLUTION** 🟧 — resolve in this order: **supplier record's language property** → tenant default → `nl`. Support **NL / FR / EN** (add **DE** only if a supplier needs it). If the supplier has no language set, **default to NL and show which language was chosen in the modal**, so a wrong pick is visible before sending, not after. Belgian suppliers are commonly NL or FR and getting this wrong is a needless friction point.
- [ ] **PROT-3 · TEMPLATES** 🟧 — one template per language (**NL / FR / EN**), in `messages/*.json` (not hardcoded), composed of: salutation → statement of protest with **invoice number, invoice date, amount, supplier name** → the reason paragraph (from PROT-1) → free-text detail → what is expected (**a credit note AND a corrected invoice** — see below) → **payment suspended in full pending those documents** → sign-off with **tenant company details**.
  **Ask for BOTH, never "or" (Florin, 2026-07-27).** Accounting point, not phrasing: the **credit note cancels the wrong invoice** in the ledger; the **corrected invoice** is the one actually paid. A corrected invoice alone leaves the original uncancelled on both sides' books. Keep the conjunction as **and** in all three languages, and keep the **"please"** — request, not instruction.
  **Register: firm but commercial** (decided) — factual, unambiguous, no threats, no statutory citations, no legalese. It should read like a professional supplier conversation that happens to be a written record, not a lawyer's letter. Escalation language belongs in a later step, not the first protest.
  **Every reason × every language must produce a complete, natural paragraph** — no untranslated fallbacks, no English leaking into an NL/FR mail. Have Florin review the NL and FR strings before ship; machine-flavoured Dutch or French undermines the exact professionalism this mail exists to project.
  Placeholders resolve from the record; **never** leave an unfilled `{placeholder}` in a sendable body (guard against the `PORTAL-WELCOME-PLACEHOLDER` bug class).
- [ ] **PROT-4 · ATTACH THE PDF** 🟧 — attach the **original invoice document** (the stored purchase-invoice PDF / scan / Peppol-rendered PDF) to the outgoing mail. Serve via the authenticated `/api/files/<key>` route — **never a bare blob key or public URL** (same trap as `RECEIPT-BONNETJE-LINK`). If the record has **no** stored document, allow sending without it but warn — a protest is stronger with the invoice attached.
- [ ] **PROT-5 · REUSE THE TRANSACTIONAL MAIL MODAL** 🟥 — open the **existing** send modal prefilled (to = supplier email, subject, body, attachment). Do **not** build a second mail composer. Recipient resolution: supplier's invoice/contact email; if missing, open with an empty To and flag it. **CC Florin (the sending tenant owner) by default** — his own copy is an evidence trail independent of the ERP — with the CC field **editable** so the accountant or a colleague can be added per case. Honour the `SEND-MODAL-EMAIL-FIRST` ordering already queued. Sending goes through the existing Resend path.
- [ ] **PROT-6 · STAMP THE RECORD (the audit trail — the real value)** 🟧 — on send, write to the invoice record: `protestStatus` (`geprotesteerd`), `protestedAt`, `protestReason`, `protestedBy`, `disputedAmount` (if partial), and a link/id to the sent mail. Surface a **"Geprotesteerd" badge** in the expenses grid and on the record. **Additive properties only** (`pd.md`). Also: **exclude protested invoices from payment runs / payment suggestions** by default — protesting and then paying it anyway defeats the purpose.
- [ ] **PROT-7 · RESOLUTION** 🟨 — close the loop. Because the ask is for **two** documents, track them **separately**: `creditNoteReceived` and `correctedInvoiceReceived` are independent flags (they arrive at different times), plus `withdrawn / accepted after all`. **A protest is only fully resolved when BOTH have arrived** — a credit note alone leaves nothing to pay against; a corrected invoice alone leaves the original uncancelled. Show a half-resolved state rather than closing early. If either document arrives via Peppol, offer to link it to the protested invoice. Without this, protests accumulate with no ending.
- [ ] **PROT-8 · FOLLOW-UP REMINDER** 🟨 — if a protest has no resolution after **N days** (setting, default 14), surface it in the notifications/digest. Rides the automations work (`coral-automations-study.md` — this is a natural `AUTO-` rule).

---

## TENANT + RBAC (standing rules)
- Supplier, invoice, document and email-template reads all scoped `WHERE tenantId = <session>`; tenant from session, never a param.
- Attachments served through the authenticated file route with a tenant check — a protest mail must never carry another tenant's document.
- **Who may protest:** owner/admin (and optionally a bookkeeper role). A protest is a commercial statement on the company's behalf — not a workforce action.
- Sending email is a side-effectful action: the modal is the confirmation step; never send without an explicit click.

## ✅ DECISIONS RESOLVED (Florin, 2026-07-27)
- **Languages: NL + FR + EN.** No DE.
- **Payment stance: suspend the WHOLE invoice by default.** Florin's reasoning, which the templates must reflect: *a dispute should result in a credit note that justifies the partial payment* — deciding unilaterally what portion is "really" owed and paying that is presumptuous and carries legal exposure in a financial dispute. ⇒ The protest states payment is suspended **in full pending a credit note AND a corrected invoice**. **Do not** build "pay the undisputed remainder" behaviour. The `disputedAmount` field (PROT-1) stays as **information only** — it tells the supplier what is contested; it never drives a partial payment.
- **Reason list: as specced, no changes.** The requirement is that each reason **produces properly localized text** — every reason × every language must yield a complete, natural paragraph. No untranslated fallbacks, no English leaking into an NL/FR mail. Translations should read as written by a Belgian professional, not machine-translated: have Florin review the NL and FR strings before ship.
- **CC: Florin himself** on every protest by default (own copy = the evidence trail in his own mailbox, independent of the ERP). Not the accountant by default. Make it an editable CC field in the modal so it can be added case by case.
- **Tone: firm but commercial.** Not a lawyer's letter. Clear and factual about what is wrong and what is expected (a credit note **and** a corrected invoice), while preserving a working supplier relationship. Avoid threats, statutory citations and legalese in the default body — those belong in an escalation, not a first protest. Still precise on the facts (invoice number, date, amount, reason) because the mail is the written record.
