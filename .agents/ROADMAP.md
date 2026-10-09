# CoralOS — System Mindmap & Execution Roadmap

> Living document. Updated: 2026-10-09 (planned modules BANK-REC-1, CONSTRUCT-1).
> Gold rule: `/pd` — Protect What Is Already Built.
> Maturity: 🟢 Production | 🟡 Functional | 🟠 Scaffolded | 🔴 Placeholder | ⚫ Missing

---

## Execution Priority (agreed 2026-04-24)

| # | What | Why | Status |
|---|---|---|---|
| **1** | Billing E2E (Stripe checkout → trial → plan sync) | Our revenue. Untested path. | 🟡 |
| **2** | User invite system (invite, roles, seat enforcement) | Unlocks per-seat revenue (€20/€79). | ⚫ |
| **3** | Credit notes + expense hardening | Tenant financial completeness. | 🟡 |
| **4** | Peppol receive polish | Tenant compliance. | 🟡 |
| **5** | Time tracker (min: clock in/out, admin view) | Workforce seat justification. | 🟡 |
| **6** | Calendar + Tasks polish | Retention features. | 🟡 |
| **7** | CRM, Project Management | Conversion differentiators. | 🟠 |
| **8** | Client Portals, File Manager, Email | 2-month buffer. Wow updates. | 🟡/🟠 |

> **Rule**: everything financial (our billing + tenant's finances) must be flawless.
> File manager and client portals are deferred — documents export already works.
> Enterprise tenants have 2 months free; portals/file manager ship as a wow update.

---

## Planned modules — added by Florin 2026-10-09

> "put in the development plan bank reconciliation with expenses and constructions specific - BIM handling and meetstat
> from architect". These are planned, not started. Every rule goes in its layer (kernel → core `lib/records` → doors
> `lib/data`, tenant-scoped) before any screen.

### `BANK-REC-1` — bank reconciliation with expenses (and income) · ⚫

- **In:** the tenant's bank movements.
  - Option 1: a statement file. **CODA** is the Belgian bank standard; **CAMT.053** is ISO 20022.
  - Option 2, later: a PSD2 feed through a Belgian aggregator (e.g. Ponto, Isabel).
- **Match** each movement to what it pays:
  - purchase invoices and receipts (`expenses`, `tickets`) → `payments-out`;
  - sales invoices → `payments-in`.
  - Both payment databases already exist in the kernel.
- **Match keys, in order:**
  1. the structured communication (OGM `+++…+++`, already on our invoices);
  2. IBAN + amount;
  3. amount + date window + counterparty name.
- **Placement:** the matching rule is pure, in core (`lib/records/bank-match`). Import and booking go through doors, on
  the scoped client.
- **Never auto-books without review:** a proposal, a confirmation, then the payment record. Partial payments,
  over-payments, one movement for several invoices, and an "unmatched" queue.
- **Effects:** an invoice's paid / remaining amount follows from its payments, and the accountant export stays
  consistent.
- **Open (Florin):** CODA upload first, or a PSD2 feed? Which banks?

### `CONSTRUCT-1` — construction specifics: the architect's meetstaat and BIM · ⚫

**a) The meetstaat (bill of quantities) from the architect → a quote.**
- **In:** the architect's meetstaat as .xlsx (most common), PDF, sometimes XML. Posts carry the bestek's numbering
  (e.g. Standaardbestek 250 / CCTB), a description, a unit and a quantity.
- **Quantity type:** VH (vermoedelijke hoeveelheid, settled on the measured quantity) or FH / forfait.
- **Out:** a quote in our ONE block model.
  - Chapters → sections, posts → lines, keeping the architect's post numbers.
  - Quantities and units from the meetstaat; prices from the library / bestek (`articles`, `bestek`).
  - Built with `newDocumentLine`, never a second line shape.
- VH lines stay marked, so the invoice can settle them on measured quantities (vorderingsstaat).
- **One import door** for spreadsheet, PDF/AI and meetstaat. Today's SpreadsheetImportModal and PDF import fold into
  it; they are not copied.

**b) BIM.**
- **In:** IFC (the open BIM standard) through the tenant's file door.
- **First:** view the model in the browser with an open-source IFC engine (web-ifc / That Open), no cloud service.
  The tenant's model never leaves its storage.
- **Then:** a quantity takeoff from the IFC (areas, volumes, counts per element type) feeding the meetstaat / quote,
  with a link between a model element and its quote line.
- **Open (Florin):** which formats your architects actually send (xlsx / PDF / XML; IFC version)? BIM depth to
  start: view only, or the quantity takeoff right away?

---

## Module Map

```mermaid
mindmap
  root((CoralOS))
    Infrastructure
      Auth & Sessions 🟢
      Middleware & Routing 🟢
      Prisma["35 models"] 🟢
      Multi-tenant Isolation 🟢
      Billing & Stripe 🟡
      Cron Jobs 🟡
      Gating Engine 🟢
      User Invite System ⚫
    Financials
      Quotations 🟢
      Invoices["Outgoing"] 🟢
      Credit Notes 🟡
      Expense Invoices["Peppol Inbox"] 🟡
      Expense Tickets 🟡
      Peppol Send 🟢
      Peppol Receive 🟡
      OCR Scan 🟡
      PDF Templates 🟢
      Financial Engine 🟢
    Relations
      Contacts 🟢
      Suppliers 🟢
      CRM Pipeline 🟠
      Email Module 🟠
    Projects
      Portfolio CMS 🟢
      Project Management 🟡
      Planning/Gantt 🟠
      Bordereau 🟡
      Purchase Orders 🟡
      File Manager 🟡
    Databases
      Notion Grid 🟢
      Record Detail 🟢
      Formula Engine["60+ fn"] 🟢
      Spreadsheet Block 🟡
      Property Mentions 🟡
    Calendar 🟡
    Tasks 🟡
    HR
      Time Tracker 🟡
      Employees 🟡
      Schedules 🟡
    Websites
      Storefront CMS 🟡
    Public
      Landing/Store 🟢
      Login/Signup 🟢
      Terms & Help 🟢
      Client Portals 🟡
    Admin
      Dashboard 🟢
      Settings 🟡
      Superadmin 🟢
```

---

## Detailed Breakdown

### 🏗️ Infrastructure

| Component | Status | Works | Missing |
|---|---|---|---|
| Auth (NextAuth v5) | 🟢 | Login, signup, JWT, session, pwd reset, email verify | — |
| Middleware | 🟢 | Module gating, locale, subdomain routing, session timeout | — |
| Prisma | 🟢 | 35 models, migrations, Vercel+Neon | — |
| Multi-tenant | 🟢 | Isolation, TenantContext, lockedDbIds | User invite ⚫ |
| Billing/Stripe | 🟡 | SDK wired, checkout/portal/webhook live, prices set, trial engine | E2E test, portal config, overage invoicing |
| Cron | 🟡 | Trial expiry deployed | Peppol counter reset, overage billing |
| Gating | 🟢 | 4-layer enforcement, feature flags, LockedFeature, canAccess() | — |

### 💰 Financials

| Component | Status | Works | Missing |
|---|---|---|---|
| Quotations | 🟢 | Full CRUD, line items, PDF, email, library, PDF import, dedup, portal view | — |
| Invoices (out) | 🟢 | Full CRUD, line items, PDF, email, Peppol send | Recurring invoices ⚫ |
| Credit Notes (in) | 🟡 | Page, DB wired | Testing, PDF template |
| Expense Invoices | 🟡 | Peppol inbox sync, dual-view, parsing | Manual entry; bank reconciliation ⚫ → `BANK-REC-1` |
| Expense Tickets | 🟡 | OCR capture, ticket list | Approval workflow ⚫ |
| Peppol Send | 🟢 | e-invoice.be API, UBL gen, quota enforcement | — |
| Peppol Receive | 🟡 | Inbox poll, doc parsing, dedup, counters | Auto-reconciliation ⚫ |
| PDF Templates | 🟢 | Invoice+quotation, i18n (NL/FR/EN), whitelabel gate, branding | — |
| Financial Engine | 🟢 | Row computation, VAT calc, total sync, grid sync | — |

### 👥 Relations

| Component | Status | Works | Missing |
|---|---|---|---|
| Contacts | 🟢 | DB-backed CRUD, NotionGrid, filtering | Merge/dedup ⚫ |
| Suppliers | 🟢 | Same architecture | — |
| CRM Pipeline | 🟠 | Page + gate + DatabaseClone | Sales stages, automation ⚫ |
| Email | 🟠 | Model + API routes + gate | Send/receive UI, inbox sync ⚫ |

### 📁 Projects

| Component | Status | Works | Missing |
|---|---|---|---|
| Portfolio (CMS) | 🟢 | Public gallery, admin CRUD, images | — |
| Project Mgmt | 🟡 | DB-backed list, bordereau, POs | Budget tracking ⚫ · architect's meetstaat + BIM ⚫ → `CONSTRUCT-1` |
| Planning/Gantt | 🟠 | Page exists | Gantt component ⚫ |
| File Manager | 🟡 | Drive OAuth, upload, list, browser UI | Local storage ⚫ |

### 📊 Databases

| Component | Status | Works | Missing |
|---|---|---|---|
| NotionGrid | 🟢 | Spreadsheet grid, sort, filter, views, inline edit | — |
| Record Detail | 🟢 | Full-page view, journal, properties, blocks | — |
| Formula Engine | 🟢 | 60+ functions, cross-DB lookups, dot notation | — |
| Block Editor | 🟢 | Rich text, toggles, callouts, code, @mentions | — |
| Spreadsheet Block | 🟡 | A1-refs, drag-resize, context menus | Complex nesting edge cases |
| Property Mentions | 🟡 | @prop flyout, InlinePropertyMention | Cross-DB joins polish |

### 📅 Calendar
| Status | Works | Missing |
|---|---|---|
| 🟡 | Local events, Google sync (1 account), portal scheduling | Multi-provider ⚫, recurring ⚫, settings 🔴 |

### ✅ Tasks
| Status | Works | Missing |
|---|---|---|
| 🟡 | DB-backed Kanban/list, PRO gate, workspace-scoped | Dependencies ⚫, automations ⚫, workforce assign ⚫ |

### 👷 HR
| Status | Works | Missing |
|---|---|---|
| 🟡 | Employee list, time tracker (clock, schedule, timeoff, teams — Prisma-backed) | Progressive camelCase migration in components, payroll ⚫, contracts ⚫ |

### 🌐 Websites
| Status | Works | Missing |
|---|---|---|
| 🟡 | Storefront CMS (hero, badges, features, pricing), preview | Multi-site ⚫, custom domains ⚫ |

### 🏠 Public
| Component | Status |
|---|---|
| Store/Landing | 🟢 |
| Login/Signup | 🟢 |
| Terms & Help | 🟢 |
| Client Portals | 🟡 — creation, pwd-protected, tasks, docs, media, chat |

### ⚙️ Admin/Settings
| Component | Status |
|---|---|
| Dashboard | 🟢 |
| Company Info | 🟢 (705 lines, VAT lookup) |
| UI/Layout | 🟡 |
| Billing | 🟡 (Stripe E2E untested) |
| Templates | 🟢 |
| Superadmin | 🟢 |
| Module settings (cal, hr, lib, etc.) | 🔴 placeholders |

---

## API Routes (45 total)

**Auth** (7): nextauth, signup, verify, resend, forgot-pwd, reset-pwd, admin-reset
**Peppol** (5): send, inbox, inbox/count, inbox/[id], onboard
**Stripe** (3): checkout, portal, webhook
**Tenant** (2): profile, cancel
**Calendar** (4): events, accounts, sync, portals
**Portals** (7): CRUD, slug, verify-pwd, tasks, messages, updates, documents, media
**Drive** (5): init, auth, callback, list, upload
**Email** (2): accounts, send
**Other** (5): bookings, leads, scan, extract-pdf, storefront-cms, company/lookup
**Cron** (1): trial-check
**Emergency** (1): emergency-access

---

*This file is a living document. Update after each major feature ship.*
*Gold rule: /pd — measure before commit, smallest change, verify after deploy.*
