# CORAL — MODULE ENTITLEMENT — trial-in-place, not a paywall — Planner 2026-09-16

**Florin, 2026-09-16:**
> *"On this we will be smarter, and in-app discreet and smart promo will do a better job. Offering it under an opt-in with lovely sparkles, make it available, and ask for money when grace period ends, when tenant is already embedded in a process that includes the module we sell."*

**Direction recorded. Not scheduled** — per-module pricing is parked until there is a stable tenant base. This file exists so `R1` does not make it harder, and so the decisions are written before anyone builds toward them.

---

## THE MODEL

| | |
|---|---|
| **Not entitled, not trialled** | Module **does not exist** for that tier — no nav, no route, no locked screen, no upsell. |
| **Offered** | A discreet, opt-in invitation. The tenant chooses; nothing is switched on for them. |
| **Trialling** | Fully functional. Real data, real work. |
| **Grace ending** | Told clearly, in advance, with a price. |
| **Lapsed** | See `E3` — **this is the decision that must be made before anything is built.** |

**Replaces:** `LockedFeature` on 7 surfaces (`admin/tasks`, `admin/crm`, `library/articles`, `library/bestek`, `admin/files`, `admin/email`, `m/files`) and the `upgradePlan` / `moduleUpgrade` / `settings_upgrade_to` strings in four locales.

---

## WHAT THIS COSTS THAT A PAYWALL DOES NOT

### 🔴 E1 · Entitlement stops being a boolean
`Tenant.activeModules` is a list — a module is on or off. **This model needs a state machine per module**: `unavailable · offered · trialling · grace · lapsed`, each with dates.
- [ ] A trial has a **start and an end**. Grace has an end. Those are stored, not inferred.
- [ ] **`R1` must not bake "entitlement is a boolean" into the reconciled list.** A module's requirement is a *question asked of the tenant's state*, not a membership test. **This is the one thing that affects `R1` today** — and it costs nothing if designed in, a migration if not.

### 🔴 E2 · Provisioning becomes on-demand, not signup-only
A tenant opting into Tasks mid-life needs `db-tasks` **created then**. Today provisioning happens at tenant creation and covers 8 bases.
- [ ] **Strengthens `A5`:** provisioning must be a **callable server capability**, invokable at any point, idempotent, and never client-side. That is already the `R1` direction — this makes it load-bearing rather than tidy.

### 🔴 E3 · 🛑 WHAT HAPPENS TO THE DATA WHEN A TRIAL LAPSES — decide before building
The tenant has done **real work** in the module. That is the point of the strategy, and it is also the whole problem.
- **Delete it** — unacceptable. It is their data.
- **Hide it** — their data is held hostage behind a payment. **Legally and reputationally the worst option.**
- **Read-only + exportable** — **Planner recommendation.** They keep and can retrieve everything; they cannot create new work. Honest, defensible, and it preserves the incentive to pay.
- [ ] **Export must work while lapsed.** Under the GDPR the tenant has a right of access to their personal data regardless of commercial status — *(not legal advice; worth confirming with a lawyer before launch)*. **Engineering-wise the conclusion is the same: the export path must not be gated by entitlement.**
- [ ] The **export lock** (`LOCK-1…5`) and this read-only state are different freezes with different reasons. **They must not be implemented as one flag** — that is defect shape #1, and the error messages would lie about why.

### 🟧 E4 · Modules are not independent, and Tasks is the clearest case
*"Embedded in a process"* is the strategy's strength **and** its risk. Tasks are referenced by projects, and project completion is computed from task status (`store.ts:1703-1715`). Articles feed quotations; quotations feed invoices.
- [ ] **A lapsing module must not break a module the tenant still pays for.** Project progress cannot silently stop working because Tasks lapsed.
- [ ] **Map the dependencies before the first module is sold separately.** A module that cannot lapse cleanly should not be sold separately at all.

### 🟨 E5 · Make the lapse honest — it protects the strategy, not just the tenant
The approach is sound: let value land, then ask. **It stops being sound if the tenant feels trapped rather than persuaded.**
- [ ] **Announce the end of the trial well before it arrives**, with the price, more than once.
- [ ] **Never let a trial lapse silently mid-process.** Work stopping without warning is how a paying customer becomes a bad review.
- [ ] **No dark patterns** — no auto-charge without explicit consent, no export buried, no cancellation maze. **A builder who feels cornered by software tells every other builder on site.** In a market this word-of-mouth, that is a commercial argument, not only an ethical one.
- [ ] *"Discreet"* is the right instinct. **One invitation, dismissible, not renewed weekly.**

---

## WHAT `R1` OWES THIS, AND NOTHING MORE
1. **Entitlement resolvable at navigation-build time**, so a module can be genuinely absent rather than blocked at render.
2. **Entitlement expressed as tenant state, not a boolean membership test** (`E1`).
3. **Provisioning callable on demand, server-side, idempotent** (`E2`).

**Everything else here is deferred.** `R1` must leave the door open; it must not walk through it.
