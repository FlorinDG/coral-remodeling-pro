# CORAL — APPLICATION AUTOMATIONS STUDY (Planner 2026-07-12) — list first, plan together

**Distinction:**
- **SYSTEM automations** = built into the platform, run automatically (cron/event-driven), not configured per user. The plumbing — they just happen. One correct behavior for everyone.
- **USER automations** = user-defined "when X → do Y" rules. Configurable, optional, per tenant/user. The customization layer (Zapier/Notion-automations style).

**Already built (baseline):** crons — `trial-check` (daily 3am), `invoice-overdue` (daily 4am), `vat-backfill`, `trial-notifications`, `reminders`; Peppol inbound auto-import (`peppol/inbox`); OCR scan pipeline; notification emitters (`actions/notifications.ts`); OGM generation; scan-quota monthly reset; tenant DB auto-provisioning.

---

## PART A — SYSTEM AUTOMATIONS (platform behavior, automatic)

| # | Automation | Trigger | Status | Notes |
|---|-----------|---------|--------|-------|
| S1 | Peppol inbound → create purchase invoice | e-invoice received | ✅ exists | feeds receipt-bulk zone |
| S2 | Peppol outbound send | invoice finalized/sent | ✅ exists | |
| S3 | OCR extraction pipeline | receipt/invoice uploaded | ✅ exists | expand per SCAN-EXTRACT-EXPAND |
| S4 | Overdue-invoice detection + reminder | daily cron | ✅ exists | user-tunable cadence → A-side + U-side |
| S5 | Document numbering (OGM, doc numbers) | on create | ✅ exists | |
| S6 | **Bank ↔ invoice reconciliation** | payment imported (CODA/Ponto) | 🔨 new | auto-match incoming payment to invoice by amount/OGM → mark paid |
| S7 | **Recurring/periodic invoicing** | schedule (monthly retainer) | 🔨 new | generate + send on cadence |
| S8 | **Duplicate detection** (FIN-10) | invoice/receipt created | 🔨 specced | flags dupes, feeds auto-confirm |
| S9 | **Receipt auto-confirm gate** | after OCR | 🔨 specced (RCPT-L3) | validate → auto vs manual |
| S10 | **Project financial roll-up recompute** | linked doc changes | 🔨 new | keep project totals live (ties to PROJECT-TOTALS) |
| S11 | **Clock auto-approval** | in-geofence shift clock | ✅ specced | trusted → payable |
| S12 | **Timesheet aggregation** | clock entries | ✅ partial | |
| S13 | **VAT-return period aggregation** | period close | 🔨 new | assemble the BTW return figures |
| S14 | **Automated DB snapshot/backup** | pre-deploy / daily | 🔨 new | belt for the data-safety posture |
| S15 | **PO ↔ purchase-invoice matching** | invoice arrives | 🔨 new (PO spec) | committed vs actual cost |
| S16 | **Payment-received notification/receipt** | payment matched | 🔨 new | |
| S17 | **Peppol/scan quota tracking + reset** | usage / monthly | ✅ exists | |

## PART B — USER AUTOMATIONS (user-configured rules)

| # | Automation | User sets | Status | Notes |
|---|-----------|-----------|--------|-------|
| U1 | Invoice reminder schedule | cadence + tone per client/global | 🔨 new | on top of S4 |
| U2 | Quote follow-up | "if not accepted in N days → follow-up email" | 🔨 new | recover stale quotes |
| U3 | Recurring invoice templates | client + lines + interval | 🔨 new | pairs with S7 |
| U4 | Expense/PO approval rules | "over €X → foreman/owner approval" | 🔨 new | ties to CLOCK-APPROVAL pattern |
| U5 | Auto-deliver invoices to accountant | on send → Peppol/email copy | 🔨 specced (Path B) | coral-accountant-sharing |
| U6 | Auto-categorize expenses | supplier → category default | 🔨 partial | Billit-style supplier memory |
| U7 | Auto-link incoming invoice → project | rule by supplier/keyword | 🔨 new | cuts manual linking |
| U8 | Scheduled reports/digests | "weekly project summary email" | 🔨 new | leverages Cowork scheduled-tasks |
| U9 | Task auto-assignment | rule → assign to workforce member | 🔨 new | |
| U10 | Shift/deadline reminders | notify worker/client before | 🔨 new | |
| U11 | Notification preferences | which events notify, channel | 🔨 partial | |
| U12 | Portal client notifications | on quote sent / invoice due | 🔨 new | |

---

## Recommended BASIC starter set (for the plan)
The highest-value, lowest-complexity automations that compound with work already specced:
- **S6 bank↔invoice reconciliation** — kills the biggest manual chore (marking paid).
- **S8+S9 duplicate detection + receipt auto-confirm** — already specced; shrinks the 295-receipt review pile.
- **S10 project roll-up recompute** — makes project financials trustworthy live.
- **U2 quote follow-up** — recovers lost revenue, simple rule.
- **U5 accountant auto-deliver** — already specced; removes a recurring hand-off.
- **U8 scheduled digests** — cheap via the existing scheduled-tasks infra; high perceived value.

## Framing decision (for the plan)
- **Do we build a generic USER-AUTOMATION ENGINE** (a "when trigger → condition → action" rule builder, one system that powers U1–U12) — bigger upfront, infinitely extensible, a real product differentiator/paid-tier feature — **or** hand-code each user automation individually (faster per item, doesn't scale)?
- Recommendation: **start with 2–3 hand-coded high-value ones (U2, U5, U8), then extract the pattern into a rule engine** once we see the shape. Don't over-build the engine before we know the real triggers/actions users want.
- SYSTEM automations (Part A) are just prioritized and built directly — no engine needed.

**Next: Florin picks the starter set + rules-engine-now-vs-later, then Planner specs each.**

---

## DECIDED (Florin 2026-07-12): NO engine yet — hand-code the few most useful, in a **Settings → Automations** panel, each individually configurable. (Engine → nice-to-have list #2.)

### Settings → Automations — starter set (each = a toggle + its config, hand-coded, per-tenant)
- [ ] **AUTO-INVOICE-REMINDERS** (U1) 🟨 — on/off + cadence (e.g. remind at +7/+14/+30 days overdue) + tone/template + stop-on-payment. Builds on the existing `invoice-overdue`/`reminders` crons — this adds the tenant-configurable schedule + copy on top. Settings: enabled, day offsets, template, cc self.
- [ ] **AUTO-QUOTE-FOLLOWUP** (U2) 🟨 — "if a quote isn't accepted/viewed within N days → send a follow-up." Settings: enabled, N days, follow-up template, max follow-ups. Recovers stale quotes. (No portal dependency for proposals per DOC-PROPOSAL; quotes only.)
- [ ] **AUTO-ACCOUNTANT-DELIVER** (U5) 🟨 — already designed in `coral-accountant-sharing.md` Path B: on a sent invoice, auto-copy to the accountant (Peppol or email). Settings: enabled, accountant contact + channel. Just surface its config in the Automations panel.
- [ ] **AUTO-SCHEDULED-DIGEST** (U8) 🟨 — recurring summary email (weekly project/financial digest, or "open items"). Settings: enabled, frequency, recipients, contents. Cheapest to build — leans on the existing scheduled-tasks infra; high perceived value.
- **Panel UX:** one "Automations" section in Settings, a card per automation with a clear on/off + inline config + a one-line "what this does". No rule-builder, no triggers/conditions UI — fixed, well-labelled features.
- **Verify:** each toggle persists per tenant; turning one on actually schedules/sends; off = fully inert; copy is i18n'd.

### Also worth building soon (SYSTEM side, not settings toggles — automatic)
S6 bank↔invoice reconciliation · S8/S9 dup-detection + receipt auto-confirm (specced) · S10 project roll-up recompute · S15 PO↔invoice matching. These are platform behavior, prioritized directly — not part of the Settings panel.

> **Continuous-development note:** this study + `coral-nice-to-have.md` are the rolling roadmap. As the app matures, new targets land here; Planner keeps both current so there's always a prioritized "what's next".
