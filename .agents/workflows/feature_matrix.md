# CoralOS Feature Matrix — Authoritative Tier Map

> Product-owner approved. Update after every product decision.
> Last confirmed: 2026-04-21

---

## Plan Tiers

| Tier | Users | What it is |
|---|---|---|
| `FREE` | 1 (TENANT_FREE) | Single-operator workspace. Core invoicing only. No team features. |
| `PRO` | 3 max (1 owner + 2 employees) | Standard paid. Full module access at base depth. |
| `ENTERPRISE` | Unlimited | Power teams. Full depth, white-label, advanced integrations. |
| `FOUNDER` | Unlimited | First 20 tenants. Free forever. Same depth as ENTERPRISE. |
| `CUSTOM` | Manually set | Superadmin-configured. Bypasses all limits. |

---

## User Role Hierarchy (from `src/lib/roles.ts`)

```
PLATFORM LAYER (Coral Group staff — no tenant ERP access)
  └── SUPERADMIN               Full system control
  └── TENANT_MANAGER           Superadmin panel only
  └── FRONTSTORE_MANAGER       coral-sys storefront only

WORKSPACE LAYER (tenant ERP users)
  └── APP_MANAGER              Legacy/Founder. Full ERP, plan-agnostic.

FREE TIER (1 user max)
  └── TENANT_FREE              Single operator. Free feature set.

PRO TIER (3 users max: 1 owner + 2 employees)
  └── TENANT_PRO_OWNER         Invites/configures up to 2 employees.
  └── TENANT_PRO_EMPLOYEE      Standard access. Configured by owner.

ENTERPRISE TIER (unlimited users)
  └── TENANT_ENTERPRISE_OWNER      Full access. Manages all roles.
  └── TENANT_ENTERPRISE_MANAGER    Management-level access.
  └── TENANT_ENTERPRISE_EMPLOYEE   Standard access.
  └── TENANT_ENTERPRISE_WORKFORCE  Field/labour. Most restricted. (Tasks only)
```

---

## Feature Matrix

**Legend**: ✅ included · 🔒 locked (upgrade prompt) · — not applicable

---

### Module: DASHBOARD
_Always available. No toggle. No tier gating._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| Overview stats | ✅ | ✅ | ✅ | ✅ |
| Project widget | if PROJECTS ON | if PROJECTS ON | ✅ | ✅ |
| Peppol inbox widget | ✅ | ✅ | ✅ | ✅ |

---

### Module: INVOICING (`INVOICING` toggle)
_Core module. Always enabled at signup._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Facturen** (outgoing invoices) | ✅ 5/mo | ✅ 50/mo | ✅ unlimited | ✅ unlimited |
| **Offertes** (quotations) | ✅ 5/mo | ✅ 50/mo | ✅ unlimited | ✅ unlimited |
| **Aankoopfacturen** (purchase invoices) | ✅ | ✅ | ✅ | ✅ |
| **Onkostenfiches** (expense tickets) | ✅ | ✅ | ✅ | ✅ |
| **Creditnota aankoop** | ✅ | ✅ | ✅ | ✅ |
| **Creditnota verkoop** | 🔒 | ✅ | ✅ | ✅ |
| **Peppol sent** | 5/mo | 20/mo | unlimited | unlimited |
| **Peppol received** | 10/mo | 30/mo | unlimited | unlimited |
| PDF generation (auto, as-needed) | ✅ | ✅ | ✅ | ✅ |
| PDF branding (tenant logo) | 🔒 | ✅ | ✅ | ✅ |
| Remove "Powered by CoralOS" watermark | 🔒 | 🔒 | ✅ | ✅ |
| Multi-currency | 🔒 | 🔒 | ✅ | ✅ |
| Email dispatch (transactional via Resend) | ✅ | ✅ | ✅ | ✅ |

---

### Module: LIBRARY (`INVOICING` toggle — sub-module)
_Articles (knowledge base) + Bestek/Posten (price book). Both gated by plan._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Articles** (kennisbank — read) | 🔒 | ✅ manual add + import | ✅ advanced | ✅ advanced |
| **Batiprix integration** (1 module) | 🔒 | 🔒 | ✅ 1 module included | ✅ 1 module included |
| **Batiprix extra modules** | 🔒 | 🔒 | 💶 extra cost per module | 💶 extra cost |
| **Bestek / Posten** (price book items) | 🔒 | ✅ hardcoded catalog | ✅ editable + personalized | ✅ editable + personalized |

> **Bestek detail**:
> - PRO: Standard catalog items. Can select and apply. Cannot edit or add custom.
> - ENTERPRISE: Full edit of catalog items + ability to add custom/personalized Bestek entries on top of catalog.

---

### Module: CRM (`CRM` toggle)
_Contacts, suppliers, tasks, sales pipeline. Email client is NOT CRM — see EMAIL MODULE._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Contacts** (db-clients — always provisioned) | ✅ always | ✅ | ✅ | ✅ |
| **Suppliers** (db-leveranciers) | ✅ if INVOICING | ✅ | ✅ | ✅ |
| Contact custom fields | 🔒 | ✅ | ✅ | ✅ |

---

### Module: TASKS (standalone toggle — future: `TASKS`)
_Not part of CRM. Can be connected to other modules via Relations/Rollups/Formulas._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Task manager** (create, assign, track) | 🔒 | ✅ standalone | ✅ full | ✅ full |
| **Relations to other modules** | 🔒 | 🔒 | ✅ | ✅ |
| **Rollups / Formulas from tasks** | 🔒 | 🔒 | ✅ | ✅ |
| **Workforce assignment** (ENTERPRISE_WORKFORCE role) | 🔒 | 🔒 | ✅ | ✅ |
| Basic assignment (owner/employee) | 🔒 | ✅ | ✅ | ✅ |

> **User access per tier**:
> - PRO: TENANT_PRO_OWNER + TENANT_PRO_EMPLOYEE can manage and be assigned tasks.
> - ENTERPRISE: All roles including TENANT_ENTERPRISE_WORKFORCE can receive task assignments.

---

### Module: SALES (`CRM` toggle — sub-module, plan-gated)
_Sales pipelines. Part of CRM toggle but with internal tier depth._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Sales pipelines** | 🔒 | ✅ 1 pipeline | ✅ unlimited | ✅ unlimited |
| **Pipeline stages** (custom) | 🔒 | ✅ | ✅ | ✅ |
| **Advanced pipeline functions** | 🔒 | 🔒 | ✅ | ✅ |
| Revenue forecasting | 🔒 | 🔒 | ✅ | ✅ |
| Pipeline → Invoice automation | 🔒 | 🔒 | ✅ | ✅ |

---

### Module: EMAIL CLIENT (standalone — `ENTERPRISE` only)
_In-app email client. NOT the same as transactional email (Resend). Separate module toggle._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Email client** (compose, inbox, send) | 🔒 | 🔒 | ✅ | ✅ |
| Transactional email (Resend dispatch) | ✅ | ✅ | ✅ (+ client) | ✅ (+ client) |

> Resend powers all outgoing transactional email (invoices, quotes, notifications) on all plans.
> The EMAIL CLIENT module (sidebar `email`) is the in-app inbox/compose experience, ENTERPRISE only.

---

### Module: FILE MANAGER (`PROJECTS` toggle — sub-module, plan-gated)
_In-app file storage. PDF artifacts generated by INVOICING are always accessible._

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Auto-generated PDFs** (invoices, quotes) | ✅ | ✅ | ✅ | ✅ |
| **File manager** (upload, organize, share) | 🔒 | ✅ | ✅ | ✅ |
| File sharing with portals | 🔒 | ✅ | ✅ | ✅ |
| Storage limit | — | 5 GB | unlimited | unlimited |

---

### Module: PROJECTS (`PROJECTS` toggle)

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Projects database** | 🔒 | ✅ (20 max) | ✅ unlimited | ✅ unlimited |
| **Client portals** | 🔒 | ✅ (10 max) | ✅ unlimited | ✅ unlimited |
| **Planning timeline** | 🔒 | 🔒 | ✅ | ✅ |
| Portfolio page (frontend) | if WEBSITES | if WEBSITES | ✅ | ✅ |

---

### Module: HR (`HR` toggle)

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **WorkHub** (time tracker) | 🔒 | ✅ | ✅ | ✅ |
| **Employees** | 🔒 | ✅ (2 max) | ✅ unlimited | ✅ unlimited |
| **Workforce Scheduler** | 🔒 | 🔒 | ✅ | ✅ |
| Workforce role (ENTERPRISE_WORKFORCE) | — | — | ✅ | ✅ |

---

### Module: CALENDAR (`CALENDAR` toggle)

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Personal calendar** | 🔒 | ✅ | ✅ | ✅ |
| **Team calendar** | 🔒 | ✅ (3 users) | ✅ unlimited | ✅ unlimited |
| Calendar sync (Google/Outlook) | 🔒 | 🔒 | ✅ | ✅ |

---

### Module: WEBSITES (`WEBSITES` toggle)

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Pages / Content** | 🔒 | ✅ (1 site) | ✅ unlimited | ✅ unlimited |
| **Services** | 🔒 | ✅ | ✅ | ✅ |
| **Portfolio** | 🔒 | ✅ | ✅ | ✅ |
| Custom domain | 🔒 | 🔒 | ✅ | ✅ |

---

### Module: DATABASES (`DATABASES` toggle)

| Feature | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| **Custom databases** | 🔒 | ✅ (5 max) | ✅ unlimited | ✅ unlimited |
| **Spreadsheet view** | 🔒 | ✅ | ✅ | ✅ |
| **Advanced formulas** (cross-DB rollups) | 🔒 | 🔒 | ✅ | ✅ |
| Database sharing (portals) | 🔒 | ✅ | ✅ | ✅ |

---

### Module: SETTINGS (always visible — progressive depth)
_No toggle. Every tenant sees Settings. Depth grows by active modules + plan tier._

| Settings Tab | FREE | PRO | ENTERPRISE | FOUNDER |
|---|---|---|---|---|
| Company Info | ✅ always | ✅ | ✅ | ✅ |
| UI Layout | ✅ always | ✅ | ✅ | ✅ |
| Financial settings | if INVOICING | ✅ | ✅ | ✅ |
| Calendar settings | 🔒 | if CALENDAR | ✅ | ✅ |
| HR settings | 🔒 | if HR | ✅ | ✅ |
| Library settings | 🔒 | if INVOICING | ✅ | ✅ |
| Projects settings | 🔒 | if PROJECTS | ✅ | ✅ |
| Relations settings | 🔒 | if CRM | ✅ | ✅ |
| Tasks settings | 🔒 | if TASKS | ✅ | ✅ |
| Website settings | 🔒 | if WEBSITES | ✅ | ✅ |
| **Branding / Logo** | 🔒 | ✅ | ✅ | ✅ |
| **Custom domain** | 🔒 | 🔒 | ✅ | ✅ |
| **API access** | 🔒 | 🔒 | ✅ | ✅ |
| **User management** | 🔒 | ✅ (3 max) | ✅ unlimited | ✅ unlimited |

---

## Module Toggle → Plan Availability Summary

| Module | FREE | PRO | ENTERPRISE | FOUNDER | Notes |
|---|---|---|---|---|---|
| INVOICING | ✅ | ✅ | ✅ | ✅ | Always on |
| LIBRARY | 🔒 | ✅ | ✅ | ✅ | Sub of INVOICING toggle |
| CRM | 🔒 | ✅ | ✅ | ✅ | |
| TASKS | 🔒 | ✅ limited | ✅ full | ✅ | New standalone module needed |
| SALES | 🔒 | ✅ 1 pipeline | ✅ multi | ✅ | Sub of CRM toggle |
| EMAIL CLIENT | 🔒 | 🔒 | ✅ | ✅ | Enterprise-only sidebar item |
| FILE MANAGER | 🔒 | ✅ | ✅ | ✅ | Sub of PROJECTS toggle |
| PROJECTS | 🔒 | ✅ | ✅ | ✅ | |
| HR | 🔒 | ✅ | ✅ | ✅ | |
| CALENDAR | 🔒 | ✅ | ✅ | ✅ | |
| WEBSITES | 🔒 | ✅ | ✅ | ✅ | |
| DATABASES | 🔒 | ✅ | ✅ | ✅ | |
| SETTINGS | ✅ partial | ✅ partial | ✅ full | ✅ full | Always visible, depth varies |

---

## Implementation Gaps (ordered by priority)

| Gap | Impact | Status |
|---|---|---|
| TASKS needs its own `TASKS` module key (4 locations) | High — user mentioned it as standalone | ❌ not added |
| EMAIL sidebar shown for PRO (should be ENTERPRISE only) | High | ❌ not gated |
| Bestek unlocked on FREE | High | ❌ not gated |
| Library shown on FREE | High | ❌ not gated |
| Sales shown on FREE (if CRM on) | High | ❌ not gated |
| File manager shown on PRO (needs PROJECTS ON) | Medium | ❌ not gated |
| Sales: PRO limited to 1 pipeline | Medium | ❌ not enforced |
| Batiprix integration | Low (future) | ❌ not built |
| `showPoweredBy` watermark | ✅ `planType !== ENTERPRISE` | ✅ done |
| Peppol volume caps (FREE) | ✅ 5 sent / 10 recv | ✅ done |
| WEBSITES in superadmin toggle | ✅ just added | ✅ done |

---

## Code Implementation Pattern

### Tier helpers (add to `TenantContext`)
```ts
const isPro        = ['PRO', 'ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(planType);
const isEnterprise = ['ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(planType);
```

### 🔒 cell pattern
```tsx
{!isPro ? (
    <LockedFeature label="Bestek / Posten" requiredPlan="PRO" />
) : (
    <BestekContent editable={isEnterprise} />
)}
```

### `<LockedFeature>` component (to build)
Props: `label`, `requiredPlan: 'PRO' | 'ENTERPRISE'`, `upgradeHref?`
Renders: lock icon + plan badge + "Upgrade to PRO/ENTERPRISE" button.
Consistent across all 🔒 cells — design once, apply everywhere.

---

*Confirmed by product owner: 2026-04-21*
*Author: Florin + Antigravity*
