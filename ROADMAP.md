# CoralOS — Strategic Roadmap & Architecture
> Last updated: 2026-04-15 — Decisions locked ✅

---

## 1. Three-Tier Architecture

CoralOS is a **monorepo** housing three logical tiers:

```
coral-website/
├── index.html, css/, js/       ← Tier 1: Static storefront
├── coral-remodeling-pro/       ← Tier 2: SaaS platform (Next.js)
│   ├── src/app/[locale]/admin/ ← Protected admin modules
│   ├── src/app/[locale]/       ← Public (invoice, quote, portal views)
│   ├── src/app/api/            ← API routes (Peppol, actions, etc.)
│   └── scripts/                ← Tier 3: Internal tools (E2E tests)
└── _temp_timetracker/          ← Prototype (to be folded into HR)
```

> [!TIP]
> **Decision: Monorepo stays.** All current and future ERP modules fit inside `coral-remodeling-pro/src/app/[locale]/admin/`. No split until scaling pain (10+ active tenants, build > 3 min).

---

## 2. Subscription Tiers — LOCKED ✅

### Pricing
| | **FREE** | **PRO** — €29/mo | **ENTERPRISE** — €79/mo |
|---|----------|-------------------|-------------------------|
| **Strategy** | Acquisition funnel | Core revenue | Full ERP |

> [!IMPORTANT]
> €29/€79 is at the bottom edge for Belgian SMEs but strategic for customer acquisition. Revisit after 50+ paying tenants.

---

### Peppol E-Invoicing Volumes

| | FREE | PRO | ENTERPRISE |
|---|------|-----|------------|
| **Sent invoices/mo** | 5 | 20 | ∞ Unlimited |
| **Received invoices/mo** | 10 | 30 | ∞ Unlimited |
| **Overage** | Pay-per-volume | Pay-per-volume | N/A |

**Overage model**: Batches of 10 (sent or received, undifferentiated), priced to nudge toward PRO.

| Overage | Price | Effective per-invoice |
|---------|-------|-----------------------|
| 10-pack | €4.90 | €0.49/invoice |
| PRO equivalent | €29/mo for 20+30 = 50 | €0.58/invoice |

> [!NOTE]
> The per-volume price (€0.49) is deliberately close to but cheaper than PRO's per-invoice cost. But PRO includes ALL other modules (library, calendar, email, etc.), making upgrade compelling at ~€29/mo vs buying 6+ packs (€29.40).

**When FREE limit is reached**: 
1. Show usage meter in dashboard ("4/5 sent this month")
2. At limit → banner: "Limiet bereikt. Koop een 10-pack (€4.90) of upgrade naar PRO (€29/mo)"
3. Block send button → show upgrade modal with both options
4. Stripe Checkout for either: one-time pack or subscription

---

### Module Access Per Tier

| Module | FREE | PRO | ENTERPRISE |
|--------|------|-----|------------|
| **Dashboard** | ✅ | ✅ | ✅ |
| **CRM** | ✅ Basic | ✅ Full | ✅ Full |
| **Contacts** | ✅ (50 max) | ✅ (500) | ✅ Unlimited |
| **Suppliers** | ✅ (10 max) | ✅ (100) | ✅ Unlimited |
| | | | |
| **Invoicing** | ✅ Basic (create, PDF) | ✅ Full | ✅ Full |
| **Credit Notes** | ✅ Basic | ✅ Full | ✅ Full |
| **Quotations** | ✅ Basic (create, PDF, send, online sign) | ✅ Full | ✅ Full |
| **Peppol E-Invoicing** | ✅ (5 sent/10 recv) | ✅ (20/30 + overage) | ✅ Unlimited |
| | | | |
| **Databases** | ✅ (3 max) | ✅ (20) | ✅ Unlimited |
| **Spreadsheet** | ❌ | ✅ | ✅ |
| **Calendar** | ❌ | ✅ | ✅ |
| **Email** | ❌ | ✅ (1 account) | ✅ (5 accounts) |
| **Files (Drive)** | ❌ | ✅ (5GB) | ✅ (50GB) |
| **Client Portals** | ❌ | ✅ (3) | ✅ Unlimited |
| | | | |
| **HR — Employees** | ❌ | ❌ | ✅ |
| **HR — Time Tracker** | ❌ | ❌ | ✅ |
| **Project Management** | ❌ | ❌ | ✅ |
| **Library — Articles** | ❌ | ✅ | ✅ |
| **Library — Batiprix** | ❌ | ❌ | ✅ (module) |
| **Tasks** | ❌ | ✅ | ✅ |
| **Content (CMS)** | ❌ | ✅ | ✅ |
| | | | |
| **PDF Import (quotations)** | ❌ | ✅ | ✅ |
| **Article Library (save items)** | ❌ | ✅ | ✅ |
| **Custom Branding** | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ✅ |
| **White-label** | ❌ | ❌ | ✅ |

---

### Quotation Engine — Tier Breakdown

| Feature | FREE | PRO | ENTERPRISE |
|---------|------|-----|------------|
| Create quotation | ✅ | ✅ | ✅ |
| Save PDF | ✅ | ✅ | ✅ |
| Send via email | ✅ | ✅ | ✅ |
| Online signature (draw/type/upload) | ✅ | ✅ | ✅ |
| Import existing PDF | ❌ | ✅ | ✅ |
| Save articles to Library | ❌ | ✅ | ✅ |
| Batiprix integration | ❌ | ❌ | ✅ |
| Custom templates | ❌ | ✅ | ✅ |

> [!NOTE]
> Send + online signature are already fully implemented (3 modes: draw, type, upload). This is a strong FREE tier differentiator — most competitors lock this behind paid plans.

---

## 3. ERP Module Inventory

All modules live under `coral-remodeling-pro/src/app/[locale]/admin/`:

| Module | Route | Maturity | Tier |
|--------|-------|----------|------|
| Dashboard | `/dashboard` | 🟢 Stable | All |
| CRM | `/crm` | 🟡 Functional | All |
| Contacts | `/contacts` | 🟢 Stable | All |
| Suppliers | `/suppliers` | 🟢 Stable | All |
| Financials — Income | `/financials/income` | 🟢 Stable | All |
| Financials — Expenses | `/financials/expenses` | 🟡 Functional | All |
| Quotations | `/quotations` | 🟢 Stable | All |
| Calendar | `/calendar` | 🟡 Functional | PRO+ |
| Email | `/email` | 🟡 Functional | PRO+ |
| Files | `/files` | 🟡 Functional | PRO+ |
| Databases | `/database` | 🟢 Stable | All (capped) |
| Spreadsheet | `/spreadsheet` | 🟡 Functional | PRO+ |
| Library | `/library` | 🔴 Early | PRO+ |
| Tasks | `/tasks` | 🟡 Functional | PRO+ |
| Content (CMS) | `/content` | 🟢 Stable | PRO+ |
| Portals | `/portals` | 🟢 Stable | PRO+ |
| Services | `/services` | 🟢 Stable | PRO+ |
| HR — Employees | `/hr/employees` | 🟡 Functional | ENT |
| HR — Time Tracker | `/hr/time-tracker` | 🔴 Early | ENT |
| Projects | `/projects` | 🟢 Stable | ENT |
| Project Management | `/projects-management` | 🟡 Functional | ENT |
| Settings | `/settings` | 🟢 Stable | All |

### Future ERP Modules (can all fit in monorepo)
| Module | Route | Priority | Tier |
|--------|-------|----------|------|
| Inventory / Stock | `/admin/inventory` | 🟡 Medium | ENT |
| Purchase Orders | `/admin/purchasing` | 🟡 Medium | ENT |
| Accounting / Ledger | `/admin/accounting` | 🟢 High | PRO+ |
| Payroll | `/admin/payroll` | 🔴 Low | ENT |
| Reporting / BI | `/admin/reports` | 🟡 Medium | PRO+ |
| Batiprix Library | `/admin/library/batiprix` | 🟡 Medium | ENT |

---

## 4. Development Roadmap

### Phase 1: Foundation ✅ DONE
- [x] Multi-tenant auth + onboarding
- [x] Company profile + settings (12 categories)
- [x] Invoice engine (multi-block, VAT, PDF, email)
- [x] Quotation engine (create, PDF, send, online sign — 3 modes)
- [x] Credit notes
- [x] Contact + Supplier management
- [x] Notion-style databases
- [x] Multi-language (NL/FR/EN)
- [x] Document numbering patterns
- [x] Peppol e-invoicing (E2E verified, 10/10)

### Phase 2: Billing & Gating 🔴 CURRENT PRIORITY
- [ ] **Stripe integration** (subscriptions + one-time packs)
  - Monthly subscriptions: FREE → PRO (€29) → ENTERPRISE (€79)
  - One-time: 10-pack volume (€4.90)
  - Webhook handler for subscription state changes
- [ ] **Usage metering** (invoice counts, contact counts, database counts)
  - Track in DB: `invoicesSentThisMonth`, `invoicesReceivedThisMonth`
  - Reset counters monthly (cron or Stripe billing cycle)
- [ ] **Module gating middleware**
  - Check `planType` + `activeModules` in middleware
  - Lock icon in sidebar for unavailable modules
  - Upgrade modal with plan comparison
- [ ] **Limit enforcement**
  - Soft limit warning at 80% usage
  - Hard block at 100% with upgrade/buy-pack CTA
  - Graceful degradation (never delete data, just block new creation)
- [ ] **Upgrade flow UI**
  - Settings → Subscription page
  - Stripe Customer Portal for self-service management
  - 14-day PRO trial on signup

### Phase 3: Polish & Revenue Growth
- [ ] Dashboard analytics (revenue charts, pipeline, overdue)
- [ ] Peppol production mode (contact e-invoice.be → SMP registration)
- [ ] Recurring invoices (auto-generate monthly)
- [ ] Receipt scanning (PDF → invoice via e-invoice.be OCR)
- [ ] Article Library (save/reuse quotation line items)
- [ ] PDF import for quotations (PRO feature)
- [ ] Accounting basics (ledger, VAT declaration export)

### Phase 4: Enterprise Differentiation
- [ ] Batiprix library integration
- [ ] Inventory / stock management
- [ ] Purchase order flow
- [ ] Advanced project management (Gantt, bordereau templates)
- [ ] Multi-user roles (employee, manager, admin)
- [ ] Reporting / BI dashboards
- [ ] API access + webhooks for integrations
- [ ] White-label (custom domains)
- [ ] **Tooli.be integration** (AI construction chatbot by Buildwise/Embuild — no public API yet; explore partnership or deep-link for tenants with membership)

---

## 5. Infrastructure

| Component | Current | Target |
|-----------|---------|--------|
| Hosting | Vercel (Hobby) | Vercel Pro |
| Database | Neon PostgreSQL (Free) | Neon Pro |
| Auth | NextAuth (Credentials + Google) | Same |
| Email | Resend (coral-group.be) | Same |
| Files | Google Drive API | Same |
| E-Invoicing | e-invoice.be (test mode) | Production mode |
| Payments | **None** | **Stripe** |
| Monitoring | Console logs | Vercel Analytics + Sentry |

---

## 6. Key Decisions Log

| # | Decision | Status | Date |
|---|----------|--------|------|
| 1 | Monorepo architecture | ✅ Locked | 2026-04-15 |
| 2 | Pricing: €29 PRO / €79 ENTERPRISE | ✅ Locked | 2026-04-15 |
| 3 | Peppol: all tiers with volume caps | ✅ Locked | 2026-04-15 |
| 4 | Overage: 10-packs at €4.90 | ✅ Locked | 2026-04-15 |
| 5 | Quotations basic in FREE | ✅ Locked | 2026-04-15 |
| 6 | Library is PRO, Batiprix is ENT | ✅ Locked | 2026-04-15 |
| 7 | Stripe billing = immediate priority | ✅ Locked | 2026-04-15 |
| 8 | All ERP modules fit in monorepo | ✅ Locked | 2026-04-15 |

---

*This document is the single source of truth for CoralOS strategic direction. Update as decisions are made.*
