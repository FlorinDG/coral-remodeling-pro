# CoralOS — System Mindmap & Execution Roadmap

> Living document. Updated: 2026-04-24.
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
| Expense Invoices | 🟡 | Peppol inbox sync, dual-view, parsing | Manual entry, reconciliation ⚫ |
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
| Project Mgmt | 🟡 | DB-backed list, bordereau, POs | Budget tracking ⚫ |
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
