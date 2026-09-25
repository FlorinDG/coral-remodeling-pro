# CORAL — PRODUCT IDEAS — captured, not scheduled

Ideas worth keeping. **Nothing here is on the roadmap.** Each entry records the idea, what already exists, what it would need, and the honest objection — so a future decision starts from evidence rather than enthusiasm.

---

## 💡 MULTILINGUAL DOCUMENT HANDLING FOR BELGIAN SMEs
*Captured 2026-09-19 — from a side conversation about translation clients.*

> *"Multilingual document handling for Belgian SMEs is a CoralOS feature waiting to happen. The translation clients are the same buyers, and they'd be telling you exactly what the module needs to do while paying you."*

### Why the adjacency is real
Belgium is the one market where this is not a nice-to-have. A contractor in Brussels quotes a Walloon client in **French**, a Flemish client in **Dutch**, sometimes a corporate client in **English**, and a German-speaking community client in **German**. **Every document leaving the business has a language decision attached to it**, and getting it wrong reads as careless to the recipient.

Most SME tools treat language as a UI setting. **The document's language and the user's language are different facts** — a Dutch-speaking contractor sends French invoices all day.

### 🟢 WHAT ALREADY EXISTS — more than expected
- **`src/lib/document-i18n.ts`** — 242 lines, **NL / FR / EN**, covering document titles, headers, table columns, payment terms. Already used by PDF *and* email templates.
- **`docLanguage` is a per-record property** (`ClientInvoiceEngine:341`), not a global setting. **The separation of document language from user language is already modelled.**
- **The UI catalogue is four locales at exact parity** (846 keys, en/nl/fr/ro, enforced by `tests/i18n.test.ts`).
- PDF templates take `language` as a prop; the quote portal and invoice portal are locale-routed.

**So the foundation is laid.** The module is not a build from zero — it is an extension of something that already works.

### What a module would add
- [ ] **German (DE)** — the fourth official language. Currently absent from `DocumentLanguage`.
- [ ] **Per-client default language**, so it is never chosen twice. Set it on the contact once.
- [ ] **Line-item content** — today only the *chrome* is translated. Article names, descriptions and bestek posten are typed in one language. **That is the real work**, and it is where the article library and Batiprix modules already hold structured, reusable text.
- [ ] Correspondence templates — reminders, dunning, acceptance, delivery notes — in the client's language.
- [ ] **Terms & conditions per language**, which is where the legal exposure sits.

### 🔴 THE HONEST OBJECTIONS
1. **Translation is a service; CoralOS is a product.** Clients paying for translation want *their* documents translated. That is delivery work, not a module. **The insight is that they are good informants, not that they are the same business.**
2. **Line-item translation needs a source of truth**, and machine translation of a legally binding quotation is a liability. Either a human approves it, or it is an aid with a visible caveat — **never a silent substitution**.
3. **It is L2/L3 work sitting on L1**, so it inherits the same queue as everything else — and `document-i18n` is exactly the kind of thing that grows a second copy if built in a hurry.
4. **Scope pull.** Building because a paying client asked is the most seductive way to lose a roadmap. *(Cf. Batiprix, HR, Peppol — all real, all queued.)*

### What makes it worth keeping
**The feedback loop is genuinely unusual: paying customers who tell you the requirements.** That is better than any research, and it costs nothing to collect **while the work is being done anyway.**

- [ ] **Cheap next step, zero code:** on the next few translation jobs, write down *what the document actually needed* — which fields, which languages, who decided, what went wrong. **Three jobs' worth of notes is a specification.**
- [ ] Revisit after `R1`. **Adding `DE` to `document-i18n` is an afternoon** and would be a fair test of appetite.

---

## 🎯 GO-TO-MARKET — QUOTING-AS-A-SERVICE, DELIVERED INSIDE THE CLIENT'S OWN TENANT
*Captured 2026-09-19. **This is a strategy, not a feature** — but it changes what the roadmap must deliver first.*

> **Florin:** *"Creating quotes for SMEs who can't, for some reason, and I want to offer it as a service. Doc processing is part of it. For each client I create a free-tier tenant, they can see what's going on, they can login, I work in their own env, so all records stay perfectly traceable, and their business gets proper support. I see it as a way to acquire a customer base and generate traction for CoralOS."*

### Why this is strong
1. **It solves the SaaS cold start.** The hardest moment for any ERP is the empty tenant: no data, no habit, no reason to return. Here **the tenant arrives already full of their own real work**, produced by someone who knows what they are doing.
2. **No migration at handover.** When the client takes over, there is nothing to move. Their quotes, clients, articles and history are already where they will keep working. **Switching cost is created by delivery, not by lock-in** — which is the honest kind.
3. **Requirements come from paid work.** Every awkward quote is a specification, collected while being paid to collect it.
4. **Service revenue funds the product** without outside money.
5. **🔴 It gives the FREE tier the purpose it currently lacks.** Finding `F1` showed **nobody ever lands on FREE** — every signup becomes a 3-month PRO trial. Under this model, **these clients are exactly the FREE cohort**, and the tier stops being theoretical.

### 🔴 WHAT IT PROMOTES FROM "SOMEDAY" TO "PREREQUISITE"
| Was | Becomes |
|---|---|
| **`impersonateTenant`** — noted in the stress test as *"the one legitimate door"*, needing audit, visible indicator and expiry | **The primary daily workflow.** Florin working inside client tenants is not an edge case any more — it is the business. **The door now carries the company.** |
| **Provisioning a real FREE tenant** (`G1`, `F1`, `F2`) | **The onboarding step for every client.** Today: signup forces a PRO trial, and `syncPlanToTenant` provisions **no databases** for the PRO modules it enables. **The flow this strategy needs does not exist yet.** |
| **`R1` tenancy** | **Non-negotiable, and sooner.** Multiple real tenants holding other companies' commercial data, with one operator moving between them all day. |
| **Trial expiry** (`F3` — sets `INACTIVE`, nothing enforces it) | Must actually work, or "free tier" means "full PRO forever". |

### What must be decided before the first client
- [ ] 🛑 **Data processing agreement.** Working inside a client's tenant makes Florin a **processor** of their data — and of *their clients'* personal data. **A DPA per client is required, and it is cheap now and awkward later.** *(Not legal advice; worth a lawyer's template once, reused.)*
- [ ] **What the client sees of Florin's actions.** Traceability is a selling point — **make it visible.** *"Florin prepared this quote on 19/09"*, not an invisible hand. This is `impersonateTenant`'s audit log, surfaced as a feature rather than a control.
- [ ] **The handover moment.** When they take over: access revoked, ownership transferred, and **they keep everything**. Write it down before the first client, not at the first exit.
- [ ] **Conflict of interest.** Florin runs a remodeling business. **Quoting for a firm that competes in the same market is a real problem** — for them and for him. Decide the rule now: which trades, which regions, what is declined.
- [ ] **Pricing that does not trap you.** Per quote, retainer, or per tenant. **Service revenue is linear; the product is the leveraged part.** The goal is clients who graduate to self-serve, not clients who need you forever.

### 🔴 THE OBJECTION WORTH TAKING SERIOUSLY
**The service consumes exactly the resource the product needs: Florin's hours.** Every quote written by hand is an hour not spent on `R1`. The strategy works **only if the service is deliberately capped** — a small number of clients, chosen for what they teach — and **only if the product absorbs the repetitive parts as it goes.**

**The tell that it is working:** each new client takes **less** of your time than the last, because the product learned something. **The tell that it is not:** client five takes as long as client one. **Measure it from the first one.**

### Cheap first move
- [ ] **One client. One real quote, produced inside a tenant provisioned for them.** Every gap above will surface in that single run — and it costs one afternoon instead of a quarter.

### 🔵 THE THIRD ENVIRONMENT — "work done, business not migrated" (Florin, 2026-09-19)
> *"A client wants work done but will not migrate his business to Coral. So basically a free tenant env without the financials. And here we can be subversive and manipulative: do not remove the menu options. It is free tier. Just gate them under a page that opens with explanations about the financial module, and an enable button, that takes the user through a guided form/UI with explanation and prerequisites (Peppol notably)."*

**This is a real and common case:** the client wants quotes written, not a new accounting system. Forcing the financials on them loses the client; hiding them forever loses the upgrade.

#### 🟢 IT IS NOT A CONTRADICTION OF THE "ABSENT, NOT LOCKED" RULE — it names a THIRD state
Florin, 2026-09-16: *"Not in options, not in UI"* for tiers that do not include a module. That still holds. **This is a different situation**, and the distinction is what keeps both rules coherent:

| State | Behaviour |
|---|---|
| **Not entitled** — the tier does not include it | **Absent.** No nav, no route, no locked screen. *(2026-09-16 rule, unchanged.)* |
| **Entitled but not enabled** — the tier includes it, the tenant has not switched it on | **Visible, and it opens an explanation + guided enablement.** |
| **Enabled** | Works. |

**The menu item is honest here because the module genuinely is theirs** — it is off, not withheld.

#### Why the guided page is the *anti*-manipulative version
Florin calls it *"subversive and manipulative"*. **It is the opposite**, and that is why it will work. **Peppol has real prerequisites** — registration, a verified VAT number, a sender identity. **A teaser that hides the requirements and drops the user into a broken flow is the manipulative design.** Stating plainly *"here is what this does, here is what you need, here is how long it takes"* is both more honest and more likely to convert, because the people who proceed are the ones who can finish.

- [ ] **The page explains the module** — invoicing, purchase invoices, accountant export, Peppol e-invoicing — **in the language of a builder, not a product page.**
- [ ] **Prerequisites listed before the button**, with what the tenant must obtain themselves (Peppol registration, VAT number, bank details for structured communication).
- [ ] **A guided form**, one step at a time, that can be **paused and resumed** — nobody completes Peppol onboarding in one sitting.
- [ ] 🛑 **Dead ends are prohibited.** If a prerequisite is missing, say which and what to do. **Never a button that fails.**
- [ ] **Enabling provisions the databases** — `G1`. Which is the same capability the trial model and custom databases need. **Fourth caller, one capability.**
- [ ] **Dismissible, and it stays dismissed.** One invitation, not a weekly nag *(the "discreet" rule).*

#### 🔴 THE GUIDED FLOW ENDS IN **PENDING**, NOT IN "ENABLED" — Florin, 2026-09-19
> *"The guided UI ends in a pending state, where backend receives the request and contacts the tenant for all required actions."*

**Right, and it is the honest design.** Peppol onboarding **cannot** be completed self-serve — it needs external registration, a verified VAT number and a sender identity, some of it outside the software entirely. **A flow that pretends otherwise ends at a button that fails**, which is the dead end already prohibited above.

So the end of the form is **a request, not a switch.**

| State | What it means |
|---|---|
| `not-enabled` | The module is theirs, switched off. The explanation page is the door. |
| **`requested`** | **The tenant has read the prerequisites and asked. A human takes it from here.** |
| `in-progress` | Registration under way; the tenant has outstanding actions, and can see which. |
| `enabled` | Working. |
| `declined` / `stalled` | Closed with a reason, and re-openable. |

- [ ] **This is the same state machine as `E1`** in `coral-module-entitlement-model.md` (`unavailable · offered · trialling · grace · lapsed`). **One mechanism, not two.** Module state is a per-tenant fact with dates, not a boolean — **that conclusion now has three independent reasons behind it.**
- [ ] **The request reaches a human reliably** — notification, not a row someone remembers to check. *(And when `R5` exists, a job that surfaces requests older than N days.)*
- [ ] 🛑 **The tenant is never left guessing.** The pending screen states: what was requested, what is waiting on **them**, what is waiting on **us**, and when they were last contacted. **A request that disappears into a backend is worse than no button.**
- [ ] **Pending blocks nothing else.** They keep working in every module they already have.
- [ ] **Everything the form collected is kept**, so the human conversation starts from what they already answered rather than asking twice.

#### 🟢 Why this is stronger than self-serve here
**A request from someone who read the prerequisites and clicked anyway is the highest-quality lead the business can produce.** They have a VAT number, they understand what Peppol is, and they want invoicing turned on. **The "friction" is qualification** — and it puts Florin in a conversation with a client who is already asking to expand, which is exactly the traction the service model is built to generate.

⚠️ **The honest limit: this is human-gated, so it scales to Florin's calendar and no further.** That is a feature now and a bottleneck later. **Decide the threshold in advance** — at N pending requests a week, either the flow becomes self-serve for the parts that genuinely can be, or someone else handles them. **Note it now so it is a decision rather than a surprise.**

#### What it needs that does not exist
- **Per-module enable/disable within an entitled tier.** Today `activeModules` is set by plan, not by the tenant. **This makes the tenant a writer of their own module state** — which is also what the trial opt-in model (`E1`) requires. **Same mechanism, different door.**

---

## 💡 THE ROADMAP AS A CORALOS DATABASE
*Captured 2026-09-18.*

333 items with `layer`, `block`, `status`, `priority`, a relation to specs and a rollup of open items per block. **The first customer for custom databases** (`coral-custom-databases.md`) — real use, real formulas, and a mistake costs nothing.
