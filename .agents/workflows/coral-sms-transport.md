# CORAL — SMS TRANSPORT — driven by 2FA, not by reminders — Planner 2026-09-12

**Florin:** *"Can we replace email with transactional SMS with something like Surge or Twilio? If too much work now, we stick to email, but 2FA SMS is something useful."*

---

## THE REFRAME — these are two problems sharing one transport, and the harder one must drive

**Reminders** are convenience. If one arrives late, nothing breaks.
**2FA** is security. It has hard requirements reminders do not: guaranteed delivery, latency under a minute, rate limiting, replay protection, and defence against **SMS pumping fraud** — where an attacker farms premium-rate numbers through your send endpoint and bills you for it.

**Building SMS for reminders and getting 2FA "for free" is backwards.** 2FA's requirements are strictly harder, so **2FA picks the provider and shapes the module**; reminders then ride it for nothing.

**So the answer to "replace email with SMS" is: not yet, and not for that reason.**

---

## IMMEDIATE ANSWER — keep email for reminders

- [ ] **`TASK-M15` stays the email digest.** Resend already works, it costs nothing extra, it ships this week, and a builder's day starts at a screen with email on it.
- [ ] SMS is **not** a reminder project. It is a platform capability, specced below and sequenced on its own merits.

---

## PROVIDER — what I can and cannot tell you

**Surge** ([surge.app](https://surge.app/), YC F24, founded 2024) is real and developer-focused. **Its headline advantage is 24–48h US carrier registration (10DLC) instead of weeks** — and **that is a US problem, not a Belgian one.** SDKs: Python, TypeScript, Ruby, Elixir. Supports 2FA and appointment reminders as named use cases.

⚠️ **I have no data on its EU or Belgian deliverability**, which is the only thing that matters for you. **Do not choose on the US registration story** — it solves a problem you do not have.

**Twilio** is the conservative default for EU coverage and has the deepest documentation, at higher unit cost.

### 💶 THE COST ANCHOR — and why it should NOT decide this
Published rates to Belgium (2026): **Plivo ~€0.043 · smstools ~€0.06 · BudgetSMS ~€0.066** per message.

**Do the arithmetic before optimising it:**
| Use | Volume | Monthly cost at €0.05 |
|---|---|---|
| 2FA, Florin only | ~10/month | **€0.50** |
| 2FA, Florin + 5 crew | ~60/month | **€3** |
| Daily reminder digest | ~30/month | **€1.50** |

**At your scale the per-message price is noise.** A €0.02 difference is under a euro a month. **So do not choose on price** — choose on deliverability, sender ID and GDPR, and treat cost as a constraint only if reminders ever fan out to tenants.

**Candidates with real EU presence** (Twilio aside): **Sinch** — strong European footprint, multi-channel · **Plivo** — cheapest of those quoted · **smstools.be** — **a Belgian provider**, worth a look precisely because local routes and BE alphanumeric sender ID are the two things that actually matter here · **BudgetSMS** — simple HTTP API.

⚠️ **"Sendly"** — Florin named it; the Planner could not find it in any European SMS provider comparison. **Verify the name before evaluating.** Do not add it to a shortlist on the strength of a half-remembered name.

**What actually decides it for Belgium** — evaluate on these, not on developer experience or price:
1. **BE/EU route quality and delivery rates** — ask for them, or test with a trial on your own number and your crew's.
2. **Alphanumeric sender ID** support in BE — so a message reads *CORAL*, not a random shortcode. This matters for looking professional.
3. **GDPR / EU data residency** — you are an EU business messaging EU citizens. Where do message logs live?
4. **Price per SMS to BE**, and whether there is a monthly floor.
5. **Fraud controls** — geo-allowlisting and rate limits on the account, not just in our code.

---

## THE WORK — `SMS-1…4`, unsequenced, Phase 5 at the earliest

### SMS-1 · A TRANSPORT MODULE, MODELLED ON `lib/storage` 🟧
- [ ] `lib/messaging/` — one provider-agnostic interface, exactly as `StorageProvider` abstracts Vercel Blob:
  ```ts
  export interface MessagingProvider {
      sendSms(to: string, body: string, opts?: { reason: 'otp' | 'reminder' | 'alert' }): Promise<{ id: string }>;
  }
  ```
- [ ] **Nothing outside `lib/messaging` imports the provider SDK** — the `BLOB-3` rule, applied before the mistake rather than after. This is what makes switching providers a one-file change if BE deliverability disappoints.
- [ ] Failures **throw with a named error**; no silent drop. ERROR-SURFACING DIRECTIVE.
- [ ] Tenant-scoped and rate-limited **per tenant**, not globally.

### SMS-2 · 2FA — the requirement that shapes everything 🟧 **FLORIN DECISION on scope**
- [ ] Decide **who** gets 2FA: Florin only · admins · all tenant users · workforce. **Workforce is the case to think hardest about** — crew on site, phones with poor signal, and a locked-out worker cannot clock in.
- [ ] Mandatory or opt-in. **Recommendation: opt-in first**, mandatory only once it is proven on real phones.
- [ ] **A fallback that does not depend on SMS is mandatory** — recovery codes at minimum. A tenant locked out of your ERP because a message did not arrive is a worse failure than the one 2FA prevents.
- [ ] Rate limit sends per user and per number; cap attempts; expire codes in minutes.
- [ ] **SMS pumping defence:** geo-allowlist to BE/EU, alert on unusual volume. This is the line item that turns into a real bill if ignored.

### SMS-3 · REMINDERS AS A SECOND CONSUMER 🟨 — *after SMS-1/2 exist*
- [ ] The reminder digest gains SMS as a **channel choice**, per user, alongside email. Same module, no second integration.
- [ ] **Per-tenant opt-in and a cost ceiling.** Once tenants arrive, an unbounded SMS reminder feature is an unbounded bill on your account.

### SMS-4 · CONSENT AND RECORD-KEEPING 🟨
- [ ] EU: transactional SMS to a user who provided their number for that purpose is fine; **marketing is not**, and the line matters. Record consent, provide opt-out, keep it out of the marketing path entirely.

---

## PLANNER RECOMMENDATION
1. **Now:** email digest for reminders (`TASK-M15`). Ships this week.
2. **Before choosing a provider:** run the five-point BE evaluation above. A trial to your own phone and one crew phone answers most of it in an afternoon.
3. **Then:** `SMS-1` + `SMS-2` as one project, with 2FA as the driver.
4. **Reminders over SMS last**, because by then it is a config change rather than an integration.

**The one thing to avoid:** wiring a provider SDK directly into a reminder job because it is quick. That is how `@vercel/blob` ended up in three files and cost us a week. **The abstraction goes in first, even for the first caller.**

## Sources
- [Surge — the easiest SMS API for developers](https://surge.app/) · [docs.surge.app](https://docs.surge.app/) · [Surge (YC F24) launch](https://fondo.com/blog/surge-launches)
- [Belgium SMS API pricing comparison — sent.dm](https://www.sent.dm/resources/belgium-sms-pricing)
- [BudgetSMS — Belgium gateway pricing](https://www.budgetsms.net/sms-gateway-pricing/be/belgium/)
- [smstools — Belgium SMS gateway](https://www.smstools.be/en/)
- [Sweego — European SMS price comparison](https://www.sweego.io/pricing/european-sms-price-comparison)
