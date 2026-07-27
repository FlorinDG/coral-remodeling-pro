# CORAL — CALENDAR MODULE (aggregation + multi-tenant hardening) — Planner spec 2026-07-26

**Florin:** *"our calendar module is still a bit of a joke… it renders a Google-inspired calendar that is impossible to connect a Google account to… basically wherever a date can be generated, it should be able to write that to the calendar (HR, PM, tasks, financials too)."* Mobile explicitly **out of scope** (separate mobile-app overhaul).

## CURRENT STATE — verified in code, and better than it looks
`src/components/admin/calendar/CalendarModule.tsx` is **989 lines** of real calendar: FullCalendar with `dayGrid` + `timeGrid` + `list` (real times, not all-day-only), a multi-calendar sidebar with checkbox toggles (`selectedCalendars: Set`), event + task creation modals, a mini `DayPicker`, its own `Event` Prisma model, and a **complete two-way Google sync** (`api/calendar/{accounts,events,sync}`, `lib/googleToken.ts`, create/update/delete against the Google API).
> ⚠️ Do NOT confuse with `components/admin/database/views/CalendarView.tsx` — that's the per-database Notion view (all-day only, `handleEventClick` is a `console.log`). Different thing. It also needs click-through, but it is not "the calendar module."

**So the module isn't primitive — it's (a) unreachable and (b) disconnected from the business.**

### 🔴 BLOCKER — why Google can't be connected (root-caused)
1. **No connect flow exists.** `api/calendar/accounts/route.ts` doesn't run OAuth — it only reads NextAuth rows: `prisma.account.findMany({ userId, provider: 'google' })`. Those rows exist **only if the user signed into CoralOS via Google SSO**. Email/password login ⇒ `accounts: []` ⇒ empty sidebar, no button, no path forward.
2. **Calendar scope is never requested.** No `https://www.googleapis.com/auth/calendar` scope anywhere (`auth.ts` Google provider doesn't ask for it). Even a Google-SSO user would hold a token without calendar permission → `calendarList` 403.
3. **The pattern already exists for email**: `app/api/email/connect/google/route.ts` is a proper dedicated consent flow. Calendar needs the same, and can mirror it closely. `/admin/settings/calendar/page.tsx` exists as a host for the button.

### 🟥 TENANT DEFECTS in the calendar as shipped (both are standing-rule violations)
- **`calendar-storage-v1` is a persisted Zustand store with a hardcoded, non-tenant-keyed name** (`components/admin/calendar/store.ts:52`). Durable browser state with no tenant tag → survives tenant switch / impersonation / logout. Direct breach of the TENANT-PARTITION HARD RULE (`pd.md`).
- **`GET /api/calendar/events` filters by `userId` ONLY — `tenantId` is ignored** (`route.ts:12-14`), even though `Event.tenantId` exists. Latent cross-tenant read; breaks the "server reads scoped `WHERE tenantId = <session>`" rule. It also has **no date-range filter** — it fetches every event ever (perf).

---

## ARCHITECTURE — a lens over sources, plus deliberate events
Two classes of calendar entry. The distinction is what stops the calendar from becoming a lying second copy of the truth.

**1. PROJECTIONS (derived, never stored).** Computed live from the owning record for the requested date range: `ScheduledShift`, approved `TimeOffRequest`, task due dates, project start/end, invoice due dates, quote expiry. Cannot drift, appear automatically, need no migration. This is the *"nothing is invisible"* layer that answers Florin's "wherever a date is generated."

**2. OWNED EVENTS (stored `Event` rows).** Meetings, site visits, anything deliberately *added* to the calendar. These are the only things that can sync to Google — **you cannot push a projection to Google; it must be materialised.** That requirement is precisely why both classes must exist.

> **HARD RULE — SOURCE WINS.** An `Event` linked to a source record is a **mirror, never the master**. If the source date changes, the linked Event is updated; if the source is deleted/unlinked, the Event is removed. Never let an Event become the authoritative date for an invoice, task, shift, or project.

**Normalized envelope** — every source adapter returns the same shape, so FullCalendar is source-agnostic and adding a source later is one adapter, not a rewrite:
```ts
{ id, sourceType, sourceId, title, start, end, allDay, color, deeplink, editable, meta }
```
`sourceType`: `event | google | shift | absence | task | project | invoice | quote`.

**Schema (additive only, per the data-safety rule):** `Event` currently has `taskId String? @unique` and nothing else — it can link to one task and no other record type. Add **`sourceType String?`** + **`sourceId String?`** (+ composite index) so an Event can mirror any record. Keep `taskId` for back-compat; do not drop or re-type anything.

---

## 🔒 THE MULTI-TENANT LENS (this governs every item below)
The calendar is the widest fan-out surface in the app — it reads shifts, leave, tasks, projects, invoices, quotes, and an external Google account, in one request. **Every one of those is an isolation boundary.** Rules:

1. **Tenant comes from the session, never the client.** The aggregator derives `tenantId` from `auth()` only. No `tenantId` query param, body field, or header is ever trusted — a client-supplied tenant on a fan-out endpoint is a total-read primitive.
2. **Every source adapter is tenant-scoped, individually.** `ScheduledShift`/`TimeOffRequest`/`Event` filter `WHERE tenantId = <session>`. `GlobalPage`-backed sources (tasks/projects/invoices/quotes) scope **via `database.tenantId`** — mirror the existing check in `saveGlobalPage` (`global-databases.ts:196-207`). One unscoped adapter leaks the whole layer.
3. **Fix `GET /api/calendar/events` now**: add `tenantId` to the `where`, and add mandatory `start`/`end` range params.
4. **Partition the persisted store.** Rename to `calendar-storage-v1::<tenantId>` (or key the persisted slice by tenant) and **clear on logout / tenant switch / impersonation start+stop**. Applies to `selectedCalendars`, cached events, and view state. Same treatment already applied to the database store.
5. **Google connections are per (user × tenant), not per user.** NextAuth `Account` is tenant-agnostic — that's the trap. A superadmin who connects Google while impersonating tenant A must not surface those calendars in tenant B, and must not have personal events written into a tenant's calendar. Bind the calendar connection to `(userId, tenantId)`; resolve tokens through that binding, never by `userId` alone.
6. **Impersonation is read-only for external accounts.** While impersonating, do NOT expose or write through the impersonator's Google tokens; show the layer as unavailable. Writing a support engineer's personal calendar into a customer's tenant is unrecoverable.
7. **Intra-tenant visibility (RBAC), per layer** — tenant isolation is necessary but not sufficient; not everyone in a tenant may see everything:
   - `owner/admin`: all layers.
   - `foreman`: crew shifts + absences for their crew/projects; no financial layers.
   - `workforce`: **own shifts + own approved leave only**; never other workers' absences (medical/personal inference), never financials.
   - Enforce **server-side in the aggregator** — never by hiding layers in the UI.
8. **Client portal never touches this endpoint.** Portal audiences must not receive shift, absence, task, or financial projections. If a client-facing calendar is ever wanted, it is a separate, explicitly-allow-listed projection set.
9. **Deeplinks must be tenant-checked on open.** A `deeplink` carries a record id; the target route must verify tenant ownership and 404 on mismatch rather than rendering.
10. **Cache keys carry the tenant.** Any React Query keys added here are `['calendar', tenantId, …]` (the standing convention from the OCC/projects work); the `queryClient.clear()` on tenant switch stays as the backstop.
11. **`Event.googleEventId` is `@unique` globally** — verify two tenants mirroring the same Google event can't collide; if they can, make uniqueness composite with tenant.
12. **Audit the fan-out.** Log `tenantId + userId + sources` on aggregator calls; an adapter returning rows for a foreign tenant should be a hard error, not a filtered-out row.

---

## BUILD PLAN (ordered)
- [ ] **CAL-0 · TENANT HARDENING** 🟥 — the two shipped defects, before any new feature: add `tenantId` (+ date range) to `GET /api/calendar/events`; partition `calendar-storage-v1` by tenant and reset on logout/switch/impersonation. Verify: tenant A's events never appear for B; switching tenants clears selections and cached events.
- [ ] **CAL-1 · GOOGLE CONNECT FLOW** 🟥 — the blocker. Mirror `api/email/connect/google/route.ts`: a dedicated OAuth consent route requesting `auth/calendar` scope (incremental auth, `access_type=offline`, `prompt=consent` for a refresh token), a callback storing tokens bound to `(userId, tenantId)`, and a **Connect Google Calendar** button + connected-account list with Disconnect on `/admin/settings/calendar`. Handle refresh-token expiry/revocation with a clear "reconnect" state. Verify: an email/password user can connect Google from settings and see their calendars in the sidebar; disconnect revokes cleanly; impersonation shows the layer unavailable.
- [ ] **CAL-2 · AGGREGATOR + ENVELOPE** 🟧 — turn `GET /api/calendar/events` into a date-ranged, tenant-scoped fan-out returning the normalized envelope; adapters for `event` + `google` first (parity), behind a `sources` param. Adapter registry pattern so later sources are additive.
- [ ] **CAL-3 · PROJECTION LAYERS** 🟧 — adapters for **shifts** (`ScheduledShift`) and **approved absences** (`TimeOffRequest`) — Florin's original "connect the scheduler to the calendar" ask — then **tasks** (due), **projects** (start/end/milestones), **financials** (invoice due, quote expiry). Each is a toggleable layer in the existing sidebar with its own colour + legend. All read-only. RBAC-filtered server-side per §7.
- [ ] **CAL-4 · CLICK-THROUGH** 🟧 — wire `deeplink` so every entry opens its real record (shift → shift editor, absence → leave request, invoice → invoice, task → task panel). Tenant-check on open. **Also fix `CalendarView.tsx:85-89`** (the database view's `console.log` dead-end). Cheapest big win: the calendar becomes a navigation surface.
- [ ] **CAL-5 · ADD-TO-CALENDAR (owned events w/ back-link)** 🟨 — add `sourceType`/`sourceId` to `Event` (additive); an "Add to calendar" affordance on date-bearing records creates a **linked** Event (syncable to Google). Implement the SOURCE-WINS mirror: source date change updates the Event, source delete removes it. Verify: change an invoice due date → the linked event follows; never the reverse.
- [ ] **CAL-6 · WRITE-BACK (phase 2)** 🟨 — drag a **shift** on the calendar → writes `ScheduledShift`. Deliberately last: dragging into a write path before the aggregation is proven risks corrupting the schedule. Projections other than shifts stay read-only permanently.

## CONSTRAINTS / NOTES
- **Per-worker swimlanes need FullCalendar `resource-timeline`, which is a PAID add-on.** Don't rebuild it: the WorkHub scheduler grid already does per-worker rows. Division of labour — **scheduler = planning tool** (assign people to days), **calendar = aggregated view** (everything at once). Revisit only if Florin wants to license it.
- Mobile is **out of scope** (pending mobile-app overhaul) — but don't add new desktop-only assumptions that will have to be unpicked.
- `Event.userId` is required and `Task.eventId` exists (portal tasks) — check the portal task/event path isn't broken by the aggregator change.

## OPEN DECISIONS (Florin)
- **Layer defaults** — which layers are ON by default for an owner? (Suggest: shifts + absences + my events + Google ON; tasks/projects/financials OFF until wanted.)
- **Financial layer scope** — invoice due dates only, or also quote expiry, payment plan instalments, VAT/accountant deadlines?
- **Foreman visibility** — should a foreman see absences for their crew (useful for planning) or only shifts (privacy)? Default above is crew absences visible to foreman; confirm.
- **Multiple Google accounts per user per tenant** — support several (business + personal), or one?
