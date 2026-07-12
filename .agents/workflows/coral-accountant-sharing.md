# CORAL — ACCOUNTANT SHARING of Peppol invoices (Planner spec 2026-07-06)

**Goal:** share the invoices that go out over Peppol with the tenant's accountant, for bookkeeping.
**What already exists (build on, don't reinvent):** `ROLES.ACCOUNTANT` (read-only financial access, does NOT count against seat limits); each invoice already stores `peppolDocumentId` + `peppolState`; the Peppol send path produces UBL XML + the branded PDF. So the data to share is already captured.

**Non-negotiables:** the accountant is EXTERNAL — read-only, tenant-scoped, audited. They see invoices and nothing else. Every share/export/delivery is logged. GDPR: the accountant is a separate controller/processor; this is a data-sharing relationship, not just a UI toggle.

---

## PART 1 — SCENARIOS (run before scoping)
- **S1 Cross-tenant leak.** Accountant of Tenant A sees Tenant B's invoices via an unscoped query/export. *Mitigation: every accountant read/export hard-scoped to their tenant(s), derived from session, never client input.*
- **S2 Over-scope.** Accountant reaches non-financial modules (CRM, HR, projects). *Mitigation: `ACCOUNTANT` role gates to financials read-only; verify the invoice/export views honor it and nothing else is reachable.*
- **S3 Misdelivery (if auto-delivering).** A copy sent to the wrong Peppol ID / wrong email leaks a client invoice. *Mitigation: accountant's Peppol ID/email validated + confirmed in tenant settings; never inferred.*
- **S4 Export exfiltration.** A bulk "export all invoices" endpoint pulls PII with no limit/audit. *Mitigation: tenant-scoped, period-bounded, rate-limited, fully audit-logged.*
- **S5 Stale access.** Accountant relationship ends but access persists. *Mitigation: revocable access; removing the accountant kills their access + any auto-delivery immediately.*
- **S6 GDPR basis.** Sharing client PII with a third party without a basis. *Mitigation: (Florin/legal) accountant data-sharing/processor agreement; document the processing; retention on shared copies.*

---

## PART 2 — RECOMMENDED ARCHITECTURE (two paths, A first)
**Path A — In-app accountant access (base).** The `ACCOUNTANT` role gets a dedicated, read-only, tenant-scoped **Peppol Invoices** view: per invoice → PDF, UBL/XML, `peppolState` (sent/delivered/failed/pending), recipient Peppol ID, timestamp. Individual download + **bulk export by period** (ZIP of UBL+PDF, and/or a flat CSV index) for import into their accounting software.

**Path B — Auto-deliver to accountant (friction-killer, after A).** When an invoice is sent via Peppol, ALSO deliver a copy to the accountant automatically — either (b1) over **Peppol** to the accountant's own Peppol access point (their software receives it natively), or (b2) by **email** with UBL+PDF attached. Configured per tenant (accountant Peppol ID / email). Zero manual work for the accountant.

Recommend: ship **A** (access + export) first — immediate value, lowest risk. Then **B** for hands-off delivery.

---

## PART 3 — CODER SUBTASKS (per layer; one commit each; verify = acceptance)
**L1 · Access + scoping**
- `ACC-L1-VIEW` — a read-only **Peppol Invoices** view for the `ACCOUNTANT` role: list of invoices with `peppolState != null`, tenant-scoped, columns = number, date, client, amount, Peppol status, recipient ID, sent-at. Verify: accountant sees only their tenant's Peppol invoices, nothing non-financial.
- `ACC-L1-DETAIL` — per-invoice: view/download the **PDF** and the **UBL/XML**, plus Peppol dispatch metadata. Verify: both artifacts download, match what was sent.

**L2 · Export**
- `ACC-L2-BULK` — period-bounded bulk export (date range) → ZIP of UBL+PDF + a CSV index (number, date, client, ex-VAT, VAT, incl, Peppol status). Tenant-scoped, rate-limited. Verify: export of a month returns exactly that tenant's Peppol invoices for the range.
- `ACC-L2-FORMAT` — export format the accountant's software can ingest (**DECISION: which format/software** — raw UBL is universal; some want a specific import layout). Verify: a test import into the target software succeeds.

**L3 · Auto-deliver (Path B)**
- `ACC-L3-CONFIG` — tenant settings: accountant contact + delivery mode (none / Peppol / email) + Peppol ID or email, validated. Verify: bad Peppol ID/email rejected; mode togglable.
- `ACC-L3-SEND` — on a successful Peppol send, if configured, deliver a copy to the accountant (Peppol CC or email UBL+PDF). Idempotent (no duplicate deliveries), failure-tolerant (retry/queue, never blocks the primary send). Verify: accountant receives each sent invoice once; a failed accountant delivery doesn't break the client send.

**L4 · Security / audit / compliance**
- `ACC-L4-AUDIT` — immutable log of every accountant view/download/export + every auto-delivery (who, when, which invoices). Verify: reconstructable.
- `ACC-L4-REVOKE` — removing/disabling the accountant instantly revokes access AND stops auto-delivery. Verify: no access or delivery after revoke.
- `ACC-L4-DPA` — (Florin/legal) accountant data-sharing/processor agreement + privacy-policy note + retention on shared copies. Verify: agreement on file.

---

## PART 4 — OPEN DECISIONS (for the planning sheet)
- **Mechanism:** in-app access+export (A) vs auto-deliver (B) vs both. (Recommend both, A first.)
- **Auto-deliver channel:** Peppol to accountant's access point (b1) vs email UBL+PDF (b2). Depends on whether the accountant has a Peppol ID.
- **Export format:** raw UBL+PDF+CSV vs a specific accounting-software import layout — **which software does the accountant use?**
- **Cadence:** real-time per-invoice vs periodic (monthly) digest.
- **Scope of "invoices through Peppol":** sales invoices only, or also credit notes and manual-dispatch (non-API) Peppol invoices?
