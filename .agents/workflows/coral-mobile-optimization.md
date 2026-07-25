# CORAL — MOBILE OPTIMIZATION (Planner plan 2026-07-12, spec'd with Florin)

**Concept:** the mobile experience is the dedicated **`/m` app** (a deliberately simplified ERP), NOT the full admin app squeezed onto a phone. The heavy admin engines (quote/invoice builder, full NotionGrid table) stay **desktop-first** — we don't fight them on small screens. Mobile users are routed to `/m`, which must be genuinely mobile-native: edge-to-edge, stacked, thumb-friendly.

**Architecture decision (Florin):** `/m` = the mobile experience. Keep admin desktop-first; route phones to `/m`; polish `/m` hard.

## Principles
- **Edge-to-edge:** kill horizontal margins/paddings on mobile; content uses full width; padding only where touch/readability needs it; respect safe-areas.
- **Stack, don't scroll sideways:** no horizontal-scroll tables, no fixed `min-w` that forces overflow; rows/toolbars wrap and stack.
- **One mobile-detection standard** (today it's a mix of `use-mobile`, `isMobile`, `useIsMobile` — consolidate to one).
- **Consistency:** the `/m` surfaces currently hand-roll their own card lists (clients/invoices/quotes/expenses/purchases each differ) — unify them.

## Workstreams
1. **Database → stacked cards** ← FIRST (spec below).
2. **Foundations** — one mobile-detection hook + the edge-to-edge spacing convention.
3. **`/m` surface polish** — apply the card + spacing conventions across all `/m` screens; unify the ad-hoc lists.
4. **Mobile routing/scope** — confirm phones land in `/m`; decide what's intentionally absent on mobile (the "crippled" scope) + the desktop-view escape hatch.
5. **(Deferred) admin engines/toolbars on mobile** — desktop-first per the architecture call; only revisit if users must use the builder on a phone.

---

## SPEC 1 — MOBILE STACKED CARDS (design locked with Florin)
**Design:** minimal, **chat/inbox-style** cards — a vertical stack, one card per record: **primary field as title + ONE status/amount line**; everything else on **tap → full record** (the record modal is already mobile-aware). **Fields are chosen per-database** (each DB defines its own mobile card fields, independent of the desktop view).

- [ ] **MOBILE-STACKED-CARDS** 🟨 —
  1. **Per-database mobile card config.** Add a small config to each database: `mobileCard: { titleFieldId, subtitleFieldId, badgeFieldId? }` (title = the heading; subtitle = the one status/amount/date line; optional badge = a status pill). Smart defaults so it works before anyone configures it (title = name/number/primary field; subtitle = amount → else status → else date). Editable in the DB settings ("Edit Custom Fields" area) as a "Mobile card" section.
  2. **Reusable `MobileRecordCard` component.** Full-width, edge-to-edge, compact: title line + one subtitle line (+ optional status badge), tap → open record (`PageModal`). Divider between cards, safe-area aware. No horizontal overflow, ever.
  3. **`NotionGrid` mobile card mode.** On mobile (unified detection), render the record list as a vertical stack of `MobileRecordCard` using the DB's `mobileCard` config, INSTEAD of the `min-w-max` horizontal table (L945). Keep group headers if the view is grouped; keep filter/sort/search reachable via a compact control. Desktop keeps the table unchanged.
  4. **Standardize the `/m` surfaces.** Replace the hand-rolled per-screen card lists in `m/clients`, `m/invoices`, `m/quotes`, `m/expenses`, `m/purchases` with `MobileRecordCard` (each using its DB's `mobileCard` config) so every mobile list looks/behaves the same.
  - Verify: open any database (system or custom) on mobile → a clean vertical stack of compact title+status cards, no sideways scroll; tap opens the record; the `/m` list screens use the same card; changing a DB's mobile title/subtitle fields changes what the card shows.

## SPEC 2 — FOUNDATIONS: unified device detection (agent + OS + screen size) (spec'd with Florin)
**Decision (Florin):** use an open-source detector keyed on **user-agent + OS + screen size**, replacing the current ad-hoc mix (`use-mobile`, `isMobile`, `useIsMobile`).
**Library choice (Planner, license-checked):** **`bowser` (MIT)** for agent+OS — actively maintained, lightweight, works server-side (parse the request UA string) AND client-side. **`matchMedia`** (native, no dep) in a small `useViewport` hook for screen size. **AVOID `ua-parser-js` v2 — it's AGPLv3/commercial dual-licensed**, a copyleft risk for a proprietary SaaS; if its richer parsing is ever needed, pin **v1.x (MIT)** instead.

- [ ] **MOBILE-DEVICE-DETECT** 🟨 —
  1. **One module, two entry points:** `getDevice(ua: string)` (server — from `headers().get('user-agent')`) and `useDevice()` (client — bowser on `navigator.userAgent` + `matchMedia` for live viewport). Exposes `{ isMobile, isTablet, isDesktop, os: 'ios'|'android'|'other', browser, viewportWidth, breakpoint }`.
  2. **Decision rule (combine all three):** `isMobile = uaIsPhone || viewport < <breakpoint>`; `isTablet` from UA/size; `os` drives platform behavior (iOS safe-area insets, Android). So UA handles server-side routing with no client flash; viewport catches small desktop windows + large tablets UA misjudges.
  3. **Consolidate:** replace every `use-mobile` / `isMobile` / `useIsMobile` call site with `useDevice()`; delete the duplicates. Single source of truth.
  4. **Server-side `/m` routing (ties to workstream 4):** in middleware/layout, `getDevice(ua).isMobile` → redirect phones to `/m` (no flash), honoring the existing `bypass-mobile-redirect` desktop-view escape hatch.
  5. **Edge-to-edge spacing tokens (the other half of Foundations):** define the mobile spacing convention — full-bleed content, x-padding only where touch/readability needs it, safe-area insets — as shared utilities so every `/m` screen + `MobileRecordCard` inherits it (kills the stray x-margins/paddings Florin flagged).
  - Verify: one detection module used everywhere; a phone UA is server-detected → routed to `/m` with no flash; a narrow desktop window is treated as mobile via viewport; iOS shows safe-area padding; no component still imports the old detection helpers.

### Open for the next co-spec pass (workstreams 3–4)
- `/m` routing UX: hard auto-redirect vs a "you're on mobile — open the app?" prompt; how the desktop-view escape hatch is surfaced.
- Mobile scope: which modules/actions are present vs hidden/simplified in `/m` (the "crippled" scope).
