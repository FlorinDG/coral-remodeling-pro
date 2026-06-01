# CoralOS — Promotional Roadmap (FREE tier launch)
> Companion to `LAUNCH_ROADMAP.md` (build/critical path). This doc = go-to-market.
> Last updated: 2026-05-30
> Strategy inputs (locked with Florin): **direct-to-self-employed** · **paid ads enabled** · **bilingual NL + FR** · **hook = "Free + Peppol-ready"** · mandate is **central** to launch.

---

## 0. The single most important fact driving this plan

**The Belgian B2B e-invoicing mandate is already in force.** It started **1 January 2026**. The penalty-free *tolerance period ended 31 March 2026* — so as of today (May 2026) we are **past the grace window**. Every VAT-registered self-employed person invoicing other businesses is *already legally obligated* to send structured invoices via Peppol, and fines apply: **€1,500 first offence → €3,000 → €5,000** for repeat offences. It applies to *everyone at once* — including small businesses under the €25k VAT-exemption threshold and bijberoep/side-hustle self-employed.

This flips the whole message. We are **not** selling "get ready for a deadline." We are selling **"you're already required, and you're probably not compliant yet — fix it free in minutes."** That's urgency + fear + a free remedy. Very strong.

**Second gift for the copy:** the government offers a **120% cost deduction** on e-invoicing software *subscriptions* and implementation advice (for SMEs/self-employed, available through 1 Jan 2028). This is the perfect upsell bridge: FREE gets you compliant now; **PRO is effectively cheaper than free** because you deduct 120% of it. Bake this into every upgrade surface.

> ⚠️ **Compliance honesty gate (do before any ad spend):** Our paid-feature claims and the FREE Peppol *send* path must actually work in **Peppol production mode** before we advertise "Peppol-ready." Today the infra is on e-invoice.be **test mode** (per `ROADMAP.md` §5). Advertising compliance we can't yet deliver is both a trust-killer and a legal exposure. **Production Peppol on the free path is a hard prerequisite for this campaign** — see X1 below. This is the one place where promo depends on a build item.

---

## 1. Positioning

### One-liner (the spine of everything)
- **NL:** "Gratis facturen versturen die voldoen aan de Peppol-verplichting. Klaar in 5 minuten — en je boekhouder krijgt alles met één klik."
- **FR:** "Envoyez gratuitement des factures conformes à l'obligation Peppol. Prêt en 5 minutes — et votre comptable reçoit tout en un clic."

### Why us, in the prospect's words
1. **"It's free."** Most Peppol-compliant tools charge from day one. We don't, for the core obligation.
2. **"It's on my phone."** Built for the zelfstandige who invoices between jobs, not at a desk.
3. **"My accountant stops nagging me."** One-click period export is the retention hook.
4. **"I'm covered legally."** Structured Peppol invoices = mandate satisfied.

### What we deliberately do NOT say
- No jargon dumps (UBL, BIS 3.0, SMP). Prospects don't care; they care about *legal + done + free*.
- No "full ERP." That scares the persona and dilutes the message. ERP is the PRO/ENT story, told later.

---

## 2. Audience & segmentation

Primary: **VAT-registered self-employed in Belgium who invoice other businesses (B2B).**

| Segment | Why they convert | Where to reach |
|---|---|---|
| Bijberoep / side-hustle zelfstandigen | Lowest budget, most fear of fines, no current software | Facebook/Instagram, Reddit r/BESalary, FB groups |
| Hoofdberoep solo (trades, consultants, freelancers) | Invoice regularly, hate admin, want mobile | Instagram/FB, Google Search, LinkedIn (consultants) |
| Just-registered starters | Need first invoice tool, no incumbent to displace | Google Search ("eerste factuur maken"), starter communities, Securex/Acerta/Partena content slipstream |
| Non-compliant procrastinators | Past the deadline, anxious, searching now | Google Search ("Peppol verplicht boete"), retargeting |

Explicitly **out of scope for launch ads:** companies with employees (that's ENTERPRISE), and B2C-only self-employed (mandate doesn't bind their outgoing invoices — though they may still want free invoicing).

---

## 3. Funnel & metrics (define before spend)

```
Ad / content  →  Landing page  →  Signup  →  ACTIVATION (first Peppol invoice sent)  →  Habit (2nd month export)  →  PRO upgrade
```

North-star: **activated free users** = sent ≥1 compliant invoice. Not signups — activations.

| Stage | Metric | Why it matters |
|---|---|---|
| Acquisition | CAC (cost per signup), by channel & language | Kills losing channels fast |
| Activation | % signups who send first invoice within 24h / 7d | The real product-market-fit signal |
| Retention | % who return next month & run an export | Predicts LTV + word of mouth |
| Referral | invites / shares per active user | Cheapest growth; instrument early |
| Revenue | free→PRO conversion %, time-to-upgrade | Validates Goal B economics |

Instrument **before** launch: analytics events for signup, first-invoice-sent, export-run, limit-hit, upgrade-clicked. Without these, ad spend is flying blind. (Ties to `LAUNCH_ROADMAP.md` A6.1.)

---

## 4. Channels (ranked for "direct-to-self-employed + paid ads")

### Tier 1 — lead here
- [ ] **C1 Google Search Ads (NL + FR)** — highest intent. Bid on: "peppol verplicht", "e-facturatie verplicht boete", "gratis facturatie programma", "facture peppol obligatoire", "logiciel facturation gratuit indépendant", "première facture indépendant". These people are searching *right now* because they're scared. Cheapest conversions you'll get.
- [ ] **C2 Meta Ads (Facebook + Instagram, NL + FR)** — best for the bijberoep/starter persona who isn't searching yet but feels the anxiety. Interest + lookalike targeting; video of "invoice sent from phone in 60s."
- [ ] **C3 SEO landing content** — own the mandate questions. One sharp page per fear: "Peppol verplicht: wat als ik geen e-facturen stuur?" / "Boete e-facturatie 2026." Compounds free forever; pairs with C1 quality score.

### Tier 2 — build in parallel, cheap
- [ ] **C4 Communities** — Reddit (r/BESalary, r/belgium), Facebook groups for zelfstandigen/indépendants, starter forums. Be helpful, not spammy: answer mandate questions, mention the free tool when relevant.
- [ ] **C5 Referral loop** — every invoice PDF/email carries a subtle "Made with CoralOS — free Peppol invoicing." Built-in distribution at zero CAC.
- [ ] **C6 Comparison/listicle presence** — get listed in "beste gratis facturatieprogramma's België 2026" roundups; many are updatable.

### Tier 3 — opportunistic / later
- [ ] **C7 Micro-influencers** — Belgian finance/freelance creators on Instagram/TikTok/LinkedIn.
- [ ] **C8 Accountant channel (deferred but note it)** — you chose direct-first, but accountants remain the highest-LTV channel long-term. Plant the seed: the export quality (LAUNCH A4) is your future accountant pitch. Revisit post-launch.

---

## 5. Ad strategy (since budget is available)

### Budgeting discipline
- [ ] **D1 Start small, per-channel test budgets** — e.g. modest daily caps on Google + Meta, split NL/FR, for 2 weeks. Goal is *learning CAC and which message wins*, not volume.
- [ ] **D2 One variable per test** — language, hook, persona, creative. Don't change five things and learn nothing.
- [ ] **D3 Kill/scale rule** — predefine: a channel that can't hit target CAC → activation in the test window gets cut, winners get the budget.

### Creative angles to A/B (all flow from the mandate hook)
- [ ] **D4 Fear/remedy:** "E-facturatie is sinds januari verplicht. Boetes tot €5.000. Word gratis in orde in 5 minuten." / FR equivalent.
- [ ] **D5 Free + deductible:** "Gratis starten. Upgrade naar PRO? 120% fiscaal aftrekbaar." (the tax-deduction judo)
- [ ] **D6 Salary/simplicity:** "Factureer je eigen loon vanaf je telefoon." (the original persona hook, as a secondary test)
- [ ] **D7 Accountant relief:** "Je boekhouder krijgt alles met één klik." (retention message as acquisition test)

### Landing pages
- [ ] **D8 Dedicated NL + FR landing pages per primary hook** — not the homepage. Match ad message → page headline exactly (quality score + conversion). One CTA: start free.
- [ ] **D9 Mandate-explainer page** as the SEO + retargeting anchor (doubles as C3).

---

## 6. Pre-launch (demand capture before product is public)

- [ ] **E1 Waitlist live now** — tie to `LAUNCH_ROADMAP.md` A5.3.1. Even pre-launch, run a thin mandate-explainer page + "get free Peppol invoicing — join the list." Captures the anxiety demand you're already able to reach.
- [ ] **E2 Seed content** — publish the 2–3 SEO mandate pages weeks before launch so they're indexed by go-live.
- [ ] **E3 Warm the communities** — start being the helpful Peppol answer-person in groups before you have anything to sell.
- [ ] **E4 Founding-user cohort** — recruit the closed-beta users (LAUNCH A7) from the waitlist; turn them into testimonials.

---

## 7. Launch sequence

- [ ] **F1 Soft launch** — open to waitlist + communities first. Watch activation rate; fix happy-path friction before paying for traffic.
- [ ] **F2 Paid-ads on** — only once activation rate on organic traffic is healthy AND production Peppol works (X1). Start Google (intent) before Meta (interest).
- [ ] **F3 PR/announcement** — Belgian startup/freelance press, the "free compliant alternative" angle; newsjack the mandate.
- [ ] **F4 Listicle/comparison outreach** — get into the "gratis facturatie 2026" roundups.
- [ ] **F5 Scale winners** — pour budget into the channel/message/language with best CAC→activation.

---

## 8. FREE → PRO conversion (sets up Goal B revenue)

- [ ] **G1 In-product upgrade moments** — at the free cap (5 sent/mo), at locked modules, after a successful export. (Engine exists per LAUNCH B2.)
- [ ] **G2 The 120%-deduction nudge** — every PRO upsell states it's 120% tax-deductible through 2028. Reframes €29 as net-negative cost. Strongest lever you have.
- [ ] **G3 Trial** — reconcile length first (LAUNCH B1.1.1 — code says 3mo, roadmap 14d); whatever you pick, message it consistently.
- [ ] **G4 Lifecycle emails** — onboarding (get to first invoice), habit (monthly export reminder), upgrade (when they hit limits or grow).

---

## 9. Risks & honesty checks

| Risk | Mitigation |
|---|---|
| Advertising "Peppol-ready" before production Peppol works | **X1 is a hard gate** — no compliance ads until the free send path is live in production, verified end-to-end |
| Mandate fine figures / deduction % change | These are date-sensitive (verified 2026-05-30). Re-verify before each campaign; don't hardcode numbers in evergreen ads without a check |
| CAC > LTV on a free product | Free tier monetizes only via PRO conversion — watch G1/G2 closely; if conversion is weak, paid acquisition for free users loses money |
| Bilingual dilutes focus | Run NL and FR as *separate* campaigns/pages/budgets, not one blurred bilingual asset |
| Trust (new unknown brand handling invoices) | Testimonials (E4), transparent security/privacy, "made in Belgium" |

---

## X. Cross-dependency on the build (the one promo→build link)

- [ ] **X1 — Production Peppol on the FREE send path** `[!] BLOCKER for compliance ads`
  - Move e-invoice.be from test → production (LAUNCH `ROADMAP.md` Phase 3 item)
  - Verify a real structured invoice actually transmits over Peppol from a free account, end to end
  - Until this is true, the campaign can run *waitlist/awareness* but **cannot claim "compliant / Peppol-ready."**

---

## Sources (mandate facts, verified 2026-05-30)
- [E-invoicing in Belgium: Complete Guide — Marosa VAT](https://marosavat.com/vat-news/e-invoicing-b2b-belgium-complete-guide-january-2026)
- [Belgium B2B E-Invoicing Mandate 2026: 3-Month Tolerance Period — Tradeshift](https://tradeshift.com/resources/compliance/belgium-b2b-e-invoicing-mandate-2026-tolerance-period/)
- [E-invoicing for self-employed persons in Belgium from 2026 — Partena Professional](https://www.partena-professional.be/en/i-am-self-employed/e-invoicing)
- [Belgium's 2026 E-Invoicing Regulations: Scope, Deadlines, Penalties — Vertex](https://www.vertexinc.com/resources/resource-library/belgiums-2026-e-invoicing-regulations-explained-scope-deadlines-and-penalties)
- [Peppol Verplicht 2026 / Boetes tot €5.000 — e-invoice.be](https://e-invoice.be/blog/peppol-verplicht)
- [Verplichte e-facturatie + 120% aftrek softwarepakketten — VLAIO](https://www.vlaio.be/nl/nieuws/verplichte-e-facturatie-voor-bedrijven-vanaf-2026-opleiding-en-softwarepakketten)
- [Belgium: Electronic Invoicing Jan 2026 + tax deductions — EDICOM](https://edicomgroup.com/blog/belgium-will-make-b2b-electronic-invoice-mandatory)
- [How Belgium's 2026 e-invoicing mandate will reshape your business — EY Belgium](https://www.ey.com/en_be/insights/tax/how-belgiums-2026-e-invoicing-mandate-will-reshape-your-business)
