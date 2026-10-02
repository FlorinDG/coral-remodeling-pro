# CODER DIRECTIVE — GEO-2 · our location explanation BEFORE the phone asks — PLAN REQUEST

**Planner 2026-10-02. Gate 1 only: write the PLAN (`.agents/plans/GEO-2.md`) per `coder-report-protocol.md` §0, push, STOP.**
Backlog: `coral-backlog-jibble.md` (Planned) · GEO-1 in `coral-work-order-tabs.md` (what we record and why).

## The need (Florin 2026-10-02)
Before the phone's own location-permission prompt appears, the crew member sees **our** explanation:
- location is read **only at clock-in and clock-out** — never in between, never tracked;
- **why**: the timesheet shows the address and the distance to the site; it **never blocks** a clock-in;
- two buttons: **Continue** (then the phone's prompt) · **Not now** (clock in without location — allowed today).

## Behaviour to plan
- Shown **once per device**, the first time a location is about to be requested — and again only if the
  permission is not granted (check `navigator.permissions.query({ name: 'geolocation' })` where available;
  where it is not, fall back to "shown once").
- If the permission is already `granted`, never show it.
- The 5 crew languages (en/nl/fr/ro/ru) — `src/components/time-tracker/i18n/locales/*.json`; the existing guard
  test `tests/i18n-crew.test.ts` must stay green.
- Large, phone-first, the WorkHub's look (see `src/components/workhub/WorkOrderTabs.tsx` for style).

## Call sites (read them — the plan says exactly how each changes)
`src/components/time-tracker/components/ClockButton.tsx:90, :199` · `src/components/time-tracker/components/MySchedule.tsx:247, :326`
(each calls `requestLocation()` from `src/components/time-tracker/hooks/useGeolocation.ts`). A single gate the four
call through is preferred over four copies — propose it.

## Tests
The decision "show / don't show" must be a pure function you can test for real (permission state × already-shown ×
API available). Each test with its THROW PROOF (§3a).

## 🛑 FENCE
May create: one component (`src/components/workhub/LocationExplainer.tsx`), one pure module for the decision, one test file.
May change: the four call sites above, `useGeolocation.ts` (only to add the gate), the 5 crew locale files.
Everything else read-only. No new dependency.

## Your plan must contain
1. The decision function's signature and its truth table. 2. How the four call sites go through one gate.
3. The screen's text in nl (others follow). 4. Tests + how each fails. 5. Milestones (suggested: M1 decision + tests ·
M2 component + one call site · M3 the other call sites + 5 languages). 6. Open questions.
