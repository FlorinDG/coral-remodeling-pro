# MOBILE-1 PLAN — the office mobile app, built canonical first

Planner, 2026-10-08. Status: **PLAN — for Florin's review; nothing built yet.**

**Florin 2026-10-08:** "for now the owner. build it in the logic, to ensure easy expansion for other roles, without
refactoring" · two apps (office `/m` + WorkHub) — "the whole point of it" · "the mobile cards with options, that
translate into an editor line/section … refactor the editor UI … quickly draft at least a quote, invoice" · review the
journal, the text editor, the site visit · **"canonical build still trumps every other initiative. avoid cutting
corners, we will pay the piper later on for all the shortcomings of today."**

Supersedes the screen-first order of `.agents/workflows/coral-mobile-optimization.md` (2026-07-12). Its principles
(edge-to-edge, stacked cards, one device detection) stay; its order does not — rules first, screens last.

---

## 0 · What is there (measured 2026-10-08)

| Area | State |
|---|---|
| WorkHub (crew) | Mature: schedule/clock, leave, tasks, timesheets, files, projects, team, profile, offline. Stays its own app. |
| `/m` office | Dashboard, lists (invoices, quotes, purchases, tickets, clients), new invoice, files, settings, tasks (1 754 lines). Detail pages mount the **desktop engines**. |
| Bottom bar | Home, Tasks → `/m`; Projects, Calendar, More → **desktop pages**; camera = tickets only; English labels. |
| Phone redirects | Hand-written list in `middleware.ts:getMobileEquivalent` — stale (old expenses path; no Te valideren, supplier quotes, projects, calendar, HR). |
| Document editor | Quote and invoice rows are separate components; the **row total rule is written twice** (`QuotationRow.tsx:154`, `InvoiceRow.tsx:67`) — a rule in two UI files. Document totals are canonical (`lib/invoice-totals.ts`). |
| Text editor | **EDITOR-1 never built.** `contentEditable` in `QuotationRow` / `FinancialRowRenderer` / `InvoiceRow` (VRIJETEKST-EDITOR-RESET open); journal + record pages use `BlockEditor` (a block list, no inline formatting). |
| Journal | `admin/journal/page.tsx` (811 lines). Fixed since 2026-09-21: it no longer creates its own database; `journal-general` is a kernel role. **Open:** fail-open fallback `resolveDbId(GENERAL_DB_ID) \|\| GENERAL_DB_ID` (`:100`, R1-2); drafts created from the client store (`:346`), not a server door; the module is ungated (`module: null`, "until the Journal decision"). |
| Site visit | `SiteVisitModal` (WorkHub) writes to `resolveDbId('db-site-visits')` — **`db-site-visits` is not a kernel role**: no provisioning, the id resolves to the literal base, i.e. **not tenant-safe** (journal defect #3 again). Writes go through the client store (`createPage`), and it also creates a client and a quote from the crew phone. Kernel has its schema (`system-schemas.ts:60`) but no role. |

---

## 1 · The canonical spine (built FIRST — rules and doors, no screens)

### M1-K · Role-driven mobile, as data (`lib/records/mobile-surfaces.ts`, pure)
Florin: owner now, other roles later **without refactoring** → the app asks ONE table what a person gets; adding a role
is adding a row.
```ts
interface MobileSurfaces {
  home: HomeWidgetId[];          // 'cash' | 'overdue' | 'crew-today' | 'my-tasks' | 'alerts' …
  inbox: InboxSourceId[];        // 'to-validate' | 'hours-review' | 'leave' | 'peppol' | 'mentions' | 'quote-answers'
  create: CreateActionId[];      // 'ticket-photo' | 'scan-purchase' | 'scan-quote' | 'quote-draft' | 'invoice-draft' | 'contact' | 'hours'
  modules: MobileModuleId[];     // the "Meer" list
}
mobileSurfaces(ctx: { role, plan, entitlements }): MobileSurfaces
```
- Decided by **capabilities** (`gridAccess`, `isTenantHrRole`, `canRunAccountantExport`, entitlement), never by role
  names in screens. Owner = the full set; every other role = the empty set until Florin enables it (one row each).
- Tested per role; a screen never shows a widget, inbox source or action the table did not grant.

### M1-R · One route map (`lib/records/mobile-routes.ts`, pure)
- `mobileRouteOf(desktopPath)` and `mobileRecordRoute(role, id)` from one table; `middleware.ts:getMobileEquivalent`
  and `databaseRoute` read it (no hand-written list). Notifications deep-link to the mobile record on a phone.
- Test: every bottom-bar / "Meer" entry is a mobile route (no desktop page behind a mobile tab).

### M1-I · The inbox — one door over existing rules (`lib/data/mobile-inbox.ts`, scoped client)
- `listInbox(db, reach, sources)` → typed items; each source REUSES its rule, never a copy:
  to-validate → `lib/records/validation` (`approvalPlan`) · hours to review → the clock-entry approval fields + HR write
  policy · leave → `kernel/absence` (pending) · Peppol arrivals · comment mentions · quote answers.
- Actions go through the doors that exist (`saveRecord` for approval, `/api/hr` PATCH under `hrWriteRefusal`) —
  swipe = the same write as the desktop button. Counts for the tab badge from the same door.

### M1-D · ONE document block model (`lib/records/document-blocks.ts`, pure) — prerequisite of the card editor
Florin's "cards that translate into an editor line/section" needs the editor's model OUT of the UI:
- Block operations: add / move / update / delete / nest, line total, section total, optional lines — the ONE rule
  (today twice in `QuotationRow` / `InvoiceRow`; document totals stay `invoice-totals`, which the line rule must agree
  with — tested against each other).
- Quote and invoice share the model; their differences (numbering, lock, VAT presentation) stay in their own rules
  (`document-lock`, `series`, `invoice-totals`).
- Then **two renderers over one model**: desktop rows (today's look) and mobile cards. A mobile card IS a block; its
  options (quantity, price, discount, optional, move to section) are block operations.
- Drafts from the phone are saved by the existing record door (`saveRecord` + `createIfMissing`, numbering as today).

### M1-E · The text editor (EDITOR-1) — decide before the card editor
The card editor's text block and the quote's free text need ONE rich-text primitive. Options:
- **TipTap (recommended).** Headless ProseMirror. It edits **inside our blocks** (a quote line's description, a text
  block, a journal entry) and stores HTML/JSON in the block's `content` — our block model stays ours. Mobile-friendly.
- **BlockNote** (recommended in June). Brings its **own** block model: right for Notion-style pages (journal, record
  bodies), wrong inside a quote whose blocks are financial lines — two block models in one document.

**Recommendation: TipTap as the one rich-text primitive** (`components/editor/RichText.tsx`) — quote/invoice text,
line descriptions, journal, record bodies — closing VRIJETEKST-EDITOR-RESET at the root (commit on idle, never per
keystroke). `BlockEditor` becomes blocks-of-RichText. ✅ **Decided 2026-10-09: TipTap.**

### M1-J · Journal (review → canonical)
1. Fail-closed resolution (remove the `|| GENERAL_DB_ID` fallback) — R1-2.
2. Entries created through a server door (scoped), not the client store.
3. Editor = the M1-E primitive.
4. The Journal decision (entitlement: which plan, which roles) — **Florin**.

### M1-S · Site visit (review → canonical)
1. **`site-visits` becomes a kernel role** (provisioned, tenant-bound) — or folds into an existing database if Florin
   prefers (a site visit as a CRM/lead activity). **Florin decides** which.
2. Its writes through a server door (scoped): the visit, and — if kept — the client and draft quote it creates, each by
   its own door (contacts, `saveRecord`), never three client-store writes from a crew phone.
3. Its place in the two apps: crew (WorkHub, on site) captures; office (`/m`) reviews and turns it into a quote — the
   draft quote via M1-D.

---

## 2 · Screens (after the spine)

| # | Item | Uses |
|---|---|---|
| M2 | Shell: bottom bar **Vandaag · Inbox · [+] · Zoeken · Meer**, one device detection (`bowser` + `matchMedia`, per the July plan), safe areas, i18n | M1-K, M1-R |
| M3 | Inbox screen, swipe actions, badges | M1-I |
| M4 | `[+]` create sheet (photo ticket, scan purchase/quote, drafts, contact, hours) — the capture modal generalised | M1-K, scan pipeline |
| M5 | Search (clients, projects, documents, articles, purchase lines) | the purchase-line search door (next) |
| M6 | Record cards (invoice, quote, purchase, client, project) with actions + "open full editor" | M1-R, `MobileRecordCard` (July spec) |
| M7 | Card editor: draft a quote / invoice on the phone | M1-D, M1-E |
| M8 | Vandaag (role-driven widgets) | M1-K |
| M9 | Push (PWA) + offline queue for captures | — |

Coder-suitable once the spine exists: M2 (shell markup), M5/M6 screens, M8 widgets — under a fence of the M1 files.
Planner: all of M1, M3 actions, M7.

---

## 3 · Decisions for Florin

1. ✅ **Text editor — DECIDED 2026-10-09 (Florin: "go for tiptap then"): TipTap**, the one rich-text primitive (quote/invoice text, line descriptions, journal, record bodies). BlockNote is not used: its own block model inside our financial block model would be two block models in one document.
2. **Site visit:** its own kernel database (recommended) or an activity on CRM / leads.
3. **Journal:** which plan and roles get it (it is ungated today).
4. **Order:** M1-D (document model) + M1-E (editor) are the heaviest and gate the card editor; M1-K/R/I gate the shell
   and inbox. Recommended: M1-K → M1-R → M1-I → M2/M3 (a usable inbox early), in parallel M1-E decision → M1-D → M7.
