# CORAL — PLAN — GEO-2 · Location Explanation Before Phone Prompt

> Directive: `.agents/workflows/coder-directive-geo-2.md`  
> Author: Antigravity AI  
> Date: 2026-10-03  
> Status: 🟦 PLAN FIRST — Gate 1 (Stop for Planner Review)

---

## 1. Approach & Architecture

### The Problem
When a worker clocks in or clocks out, calling browser `navigator.geolocation.getCurrentPosition()` immediately triggers the operating system's native permission popup (iOS / Android / Chrome). Without prior context, workers often fear continuous tracking, leading them to deny permission.

### The Solution
Before the browser/OS asks for location access, we show a clean, reassuring WorkHub modal explaining:
1. **When:** Location is read **only** at clock-in and clock-out — never in between, never continuous tracking.
2. **Why:** Timesheets and work orders record the job site address and distance.
3. **Never blocks:** Clock-in is **never blocked** even if location is unavailable or declined.
4. **Action:** Two clear buttons:
   - **Continue** (then the phone's native prompt appears).
   - **Not now** (clock in immediately without location).

---

## 2. The Decision Function & Truth Table

### File: `src/lib/kernel/location-gate.ts` (pure module, zero dependencies)

```ts
export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | null;

export interface LocationGateDecisionInput {
  /** Permission state from navigator.permissions.query({ name: 'geolocation' }), or null if unsupported */
  permissionState: GeolocationPermissionState;
  /** Whether the browser environment supports navigator.permissions */
  hasPermissionsApi: boolean;
  /** Whether this explanation was previously seen and acknowledged on this device (localStorage) */
  alreadyShownDevice: boolean;
  /** Whether the user tapped 'Not now' during the current browser session (sessionStorage) */
  sessionDismissed?: boolean;
}

export function shouldShowLocationExplainer(input: LocationGateDecisionInput): boolean;
```

### Truth Table

| Case | `hasPermissionsApi` | `permissionState` | `alreadyShownDevice` | `sessionDismissed` | Result | Rationale |
|---|---|---|---|---|---|---|
| 1 | `true` | `'granted'` | `true` or `false` | any | **`false`** | 🔴 **Never show if already granted** — device already allows location, showing explanation is redundant |
| 2 | `false` | any | `false` | any | **`true`** | Fallback when Permissions API is unsupported: **shown once** on device |
| 3 | `false` | any | `true` | any | **`false`** | Fallback when Permissions API is unsupported: do not show again |
| 4 | `true` | `'prompt'` | `false` | `false` | **`true`** | First time before native prompt: **show explanation** |
| 5 | `true` | `'prompt'` | `true` | `false` | **`true`** | Permission still ungranted on new session: show explanation before native prompt |
| 6 | `true` | `'prompt'` | any | `true` | **`false`** | Worker tapped "Not now" earlier in this session; do not nag on every click |
| 7 | `true` | `'denied'` | `false` | any | **`true`** | Explains why location is needed even if previously denied |
| 8 | `true` | `'denied'` | `true` | any | **`false`** | Already explained; browser won't show prompt anyway without OS settings change |

---

## 3. How the Four Call Sites Go Through One Gate

### Call Sites:
1. `src/components/time-tracker/components/ClockButton.tsx:90` (`handleClockIn` -> `performClockIn`)
2. `src/components/time-tracker/components/ClockButton.tsx:199` (`handleClockOutSubmit`)
3. `src/components/time-tracker/components/MySchedule.tsx:247` (`handleClockIn`)
4. `src/components/time-tracker/components/MySchedule.tsx:326` (`handleClockOut`)

### The Unified Gate Architecture

Rather than duplicating modal state, decision checks, and promise suspension across 4 sites, the gate is centralized in `src/components/time-tracker/hooks/useGeolocation.ts`.

#### Updated `useGeolocation` Hook Interface:
```ts
interface UseGeolocationResult {
  location: GeolocationCoordinates | null;
  error: string | null;
  loading: boolean;
  permissionState: GeolocationPermissionState;
  /** Direct native location request (bypasses explainer modal) */
  requestLocationRaw: () => Promise<GeolocationCoordinates | null>;
  /**
   * Unified Gate: Evaluates shouldShowLocationExplainer.
   * If required, opens LocationExplainer modal and resolves after user action.
   * - 'Continue' -> triggers native prompt and resolves with coordinates (or null).
   * - 'Not now' -> dismisses for session and resolves with null immediately.
   */
  requestLocation: (options?: { skipExplainer?: boolean }) => Promise<GeolocationCoordinates | null>;
  /** The LocationExplainer dialog element to render in the component tree */
  explainerDialog: React.ReactNode;
}
```

#### How Call Sites Change:
All 4 call sites simply continue calling `await requestLocation()`.
- In `ClockButton.tsx`:
  - Lines 80–86: The manual check `if (permissionState === 'prompt') setShowLocationDialog(true)` is removed.
  - Line 90 & Line 199: `await requestLocation()` automatically uses the gate.
  - The older, un-internationalized `<LocationPermissionDialog />` is replaced by `{explainerDialog}`.
- In `MySchedule.tsx`:
  - Line 247 & Line 326: `await requestLocation()` automatically uses the gate.
  - `{explainerDialog}` is rendered once in `MySchedule.tsx`.

---

## 4. UI & Text Across 5 Languages

### Component: `src/components/workhub/LocationExplainer.tsx`
- **Design:** Large touch targets (min 48px), 1.2rem high-contrast text, WorkHub theme (`#ea580c` / `text-primary`), phone-first layout with clean spacing.
- **Header:** Location pin + shield icon.
- **Points:**
  1. Clock-in & clock-out only; zero continuous tracking.
  2. For timesheet verification & site distance; never blocks clock-in.
- **Buttons:**
  - Primary button: **Continue** (large, full-width or prominent).
  - Secondary button: **Not now** (outline / muted).

### Translation Keys (`src/components/time-tracker/i18n/locales/*.json`)

Namespace: `locationExplainer`

#### 1. Dutch (`nl`):
```json
{
  "locationExplainer": {
    "title": "Locatie bij in- en uitklokken",
    "description": "We lezen je locatie alleen op het moment dat je in- of uitklokt. We volgen je locatie nooit tussendoor of continu.",
    "whyTitle": "Waarom we dit vragen",
    "whyDescription": "Op de werkbon en urenregistratie tonen we het adres en de afstand tot de werf. Dit blokkeert je inklokken nooit.",
    "continue": "Doorgaan",
    "notNow": "Niet nu"
  }
}
```

#### 2. English (`en`):
```json
{
  "locationExplainer": {
    "title": "Location when clocking",
    "description": "We only read your location at the exact moment you clock in or out. You are never tracked in between or continuously.",
    "whyTitle": "Why we record this",
    "whyDescription": "Your timesheet and work order show the address and distance to the job site. This never blocks you from clocking in.",
    "continue": "Continue",
    "notNow": "Not now"
  }
}
```

#### 3. French (`fr`):
```json
{
  "locationExplainer": {
    "title": "Localisation au pointage",
    "description": "Nous lisons votre position uniquement au moment précis où vous pointez à l'arrivée et au départ. Vous n'êtes jamais suivi entre-temps.",
    "whyTitle": "Pourquoi nous l'enregistrons",
    "whyDescription": "La feuille d'heures et le bon de travail indiquent l'adresse et la distance du chantier. Cela ne bloque jamais votre pointage.",
    "continue": "Continuer",
    "notNow": "Pas maintenant"
  }
}
```

#### 4. Romanian (`ro`):
```json
{
  "locationExplainer": {
    "title": "Locația la pontare",
    "description": "Citim locația doar în momentul exact în care pontezi sosirea sau plecarea. Nu ești niciodată urmărit între timp sau continuu.",
    "whyTitle": "De ce înregistrăm acest lucru",
    "whyDescription": "Fișa de pontaj și bonul de lucru arată adresa și distanța până la șantier. Pontarea nu este niciodată blocată.",
    "continue": "Continuă",
    "notNow": "Nu acum"
  }
}
```

#### 5. Russian (`ru`):
```json
{
  "locationExplainer": {
    "title": "Геопозиция при отметке времени",
    "description": "Мы считываем ваше местоположение только в момент отметки начала или окончания смены. Мы никогда не отслеживаем вас между сменами.",
    "whyTitle": "Зачем это нужно",
    "whyDescription": "В табеле и наряде отображаются адрес и расстояние до объекта. Это никогда не блокирует отметку начала смены.",
    "continue": "Продолжить",
    "notNow": "Не сейчас"
  }
}
```

---

## 5. Tests & Failure Modes (Throw Proofs)

Test file: `tests/location-gate.test.ts` (pure Node test runner).

### Test Scenarios:
1. **Never show when permission is `granted`:**
   - Assert `shouldShowLocationExplainer({ permissionState: 'granted', ... }) === false`.
   - *Throw Proof Mutation:* Return `true` when `permissionState === 'granted'`; verify test fails.
2. **Show on `prompt` when not dismissed:**
   - Assert `shouldShowLocationExplainer({ permissionState: 'prompt', sessionDismissed: false, ... }) === true`.
   - *Throw Proof Mutation:* Return `false` on `prompt`; verify test fails.
3. **Do not show on `prompt` when already dismissed in this session:**
   - Assert `shouldShowLocationExplainer({ permissionState: 'prompt', sessionDismissed: true, ... }) === false`.
   - *Throw Proof Mutation:* Ignore `sessionDismissed`; verify test fails.
4. **Fallback to shown-once when permissions API is missing:**
   - Assert `shouldShowLocationExplainer({ hasPermissionsApi: false, alreadyShownDevice: false }) === true`.
   - Assert `shouldShowLocationExplainer({ hasPermissionsApi: false, alreadyShownDevice: true }) === false`.
   - *Throw Proof Mutation:* Invert `alreadyShownDevice` check; verify test fails.
5. **Do not re-show on `denied` if already explained on device:**
   - Assert `shouldShowLocationExplainer({ permissionState: 'denied', alreadyShownDevice: true }) === false`.
   - *Throw Proof Mutation:* Return `true` on denied; verify test fails.
6. **i18n Parity Guard Test:**
   - Run `tests/i18n-crew.test.ts` to guarantee all 5 crew languages have matching keys and non-empty values.

---

## 6. Milestones

### Milestone 1 (M1) · Pure Decision Logic & Unit Tests
- Create pure module `src/lib/kernel/location-gate.ts`:
  - `shouldShowLocationExplainer(input)`
  - Storage key constants and helpers (`isDeviceExplainerShown()`, `markDeviceExplainerShown()`, `isSessionExplainerDismissed()`, `dismissSessionExplainer()`).
- Create `tests/location-gate.test.ts` testing all truth table branches.
- Run tests and record throw proofs for each test.
- Stop for Planner review.

### Milestone 2 (M2) · Component & Hook Gate with ClockButton
- Create `src/components/workhub/LocationExplainer.tsx`:
  - WorkHub design, phone-first, touch-friendly.
  - Uses `react-i18next` with `locationExplainer` keys.
- Update `src/components/time-tracker/hooks/useGeolocation.ts`:
  - Integrate `shouldShowLocationExplainer`.
  - Provide `requestLocation` gate and `explainerDialog`.
- Wire `src/components/time-tracker/components/ClockButton.tsx` (call sites :90 and :199).
- Add translations in `src/components/time-tracker/i18n/locales/*.json`.
- Stop for Planner review.

### Milestone 3 (M3) · MySchedule Integration, Multi-Language Audit & Final Parity
- Wire `src/components/time-tracker/components/MySchedule.tsx` (call sites :247 and :326).
- Audit all 5 languages (`en`, `nl`, `fr`, `ro`, `ru`).
- Run `node --import ./tests/register.mjs --test tests/i18n-crew.test.ts` (0 missing, 0 empty).
- Run `npm run test:compile` and `npm run test:lint` (0 errors).
- Append completion report to `.agents/reports/GEO-2.md`, commit, push, and stop.

---

## 7. Open Questions for Planner / Florin

1. **Storage mechanism:** We propose `localStorage.getItem('coral:geo-explainer-shown')` for the per-device flag, and `sessionStorage.getItem('coral:geo-explainer-dismissed')` for the "Not now" session dismiss. Does this meet the "shown once per device, unless ungranted on a new session" specification?
2. **Component location:** Directive fence permits `src/components/workhub/LocationExplainer.tsx` and one pure decision module. We place the pure decision in `src/lib/kernel/location-gate.ts` (re-exported or colocated). Confirmed?
3. **Replacing `LocationPermissionDialog`:** `ClockButton.tsx` currently imports an older `LocationPermissionDialog`. We will replace it with the new `LocationExplainer` to avoid two different permission dialogs in the codebase. Confirmed?

---

## Planner review — 2026-10-03 · Gate 1: APPROVED with changes · GO for M1

**Truth table:** accepted as written. A `denied` permission shows the explanation once; "Continue" then clocks in
without location (no prompt can appear) — the screen must not promise a prompt in that case (M2: on `denied`,
the Continue button reads as "Clock in" and a line says location is switched off in the phone's settings).

**Answers to §7**
1. **Storage — yes**, `coral:geo-explainer-shown` (localStorage) and `coral:geo-explainer-dismissed`
   (sessionStorage). Every read and write in try/catch (private mode / blocked storage throws): a failed read
   counts as "not shown", a failed write is ignored. Never block on it.
2. **Not in the kernel.** `src/lib/kernel/` is pure, tenant-free platform primitives; a WorkHub screen decision
   is not one. Put the pure function in `src/components/workhub/location-gate.ts` (pure: no window, no storage,
   no React — the runner tests it). The storage helpers live in `useGeolocation.ts` (already in the fence).
3. **Yes, replace it** — two dialogs for one permission is the defect. Fence extended by exactly this: you may
   delete `src/components/time-tracker/components/LocationPermissionDialog.tsx` once `ClockButton.tsx` no longer
   imports it (it has no other importer — check again before deleting, and show the grep in the report).

**Added requirements**
- **The clock-in never waits forever.** Every way out of the dialog — Continue, Not now, close button, tap
  outside, Escape, the app going to background — resolves the promise (null when no location). Test it in M1 at
  the decision level where possible, and state in M2 how each path resolves.
- **`granted` never shows — whatever the other inputs.** Make test 1 table-driven over every combination of the
  other three inputs (not one case). Throw proof: the mutation that shows on `granted` when `alreadyShownDevice`
  is false must fail it.
- **One dialog on screen.** If ClockButton and MySchedule are mounted together, only the call site that asked may
  open it — say how in M2.

---

## M1 — done · 2026-10-03

### 1. Scope Delivered
- **Pure Decision Module (`src/components/workhub/location-gate.ts`):**
  - Pure function `shouldShowLocationExplainer(input: LocationGateInput): boolean`.
  - Implements the complete truth table with zero dependencies on `window`, `document`, `localStorage`, `sessionStorage`, or React.
  - Satisfies all gate conditions:
    - `granted` -> unconditionally `false`.
    - `prompt` -> `!sessionDismissed`.
    - `denied` -> `!alreadyShownDevice && !sessionDismissed`.
    - No Permissions API (`hasPermissionsApi: false`) -> `!alreadyShownDevice && !sessionDismissed`.
- **Storage Helpers (`src/components/time-tracker/hooks/useGeolocation.ts`):**
  - Defined storage keys `STORAGE_KEY_EXPLAINER_SHOWN = 'coral:geo-explainer-shown'` (localStorage) and `STORAGE_KEY_EXPLAINER_DISMISSED = 'coral:geo-explainer-dismissed'` (sessionStorage).
  - Implemented safe read/write helpers: `isDeviceExplainerShown()`, `markDeviceExplainerShown()`, `isSessionExplainerDismissed()`, `dismissSessionExplainer()`.
  - Every read/write is guarded by `try/catch` and checks `typeof window !== 'undefined'`. Storage access failures (e.g. private mode) degrade gracefully (failed reads return `false`, failed writes are ignored).
  - Cleaned up import to `import type { GeolocationCoordinates }` for Node ESM compatibility.
- **Unit Test Suite (`tests/location-gate.test.ts`):**
  - Six comprehensive test suites covering all truth-table branches.
  - Table-driven test testing all $2^3 = 8$ permutations of `(hasPermissionsApi, alreadyShownDevice, sessionDismissed)` when `permissionState === 'granted'`, asserting every single combination evaluates to `false`.
  - Direct unit test of storage helpers in Node environment asserting absence of throws when `window` is undefined.

### 2. Throw Proofs
All 5 mutations were executed and verified to fail their respective test, then restored:
- **TP1 (Table-driven `granted` mutation):**
  - Mutation: `if (input.permissionState === 'granted') return !input.alreadyShownDevice;`
  - Result: Failed table-driven test on permutations where `alreadyShownDevice: false` (`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: false !== true`).
- **TP2 (`prompt` state initial mutation):**
  - Mutation: `if (input.permissionState === 'prompt') return false;`
  - Result: Failed prompt state test (`AssertionError: Expected values to be strictly equal: false !== true`).
- **TP3 (`prompt` session dismissal mutation):**
  - Mutation: `if (input.permissionState === 'prompt') return true;`
  - Result: Failed session dismissal test (`AssertionError: Expected values to be strictly equal: true !== false`).
- **TP4 (Unsupported Permissions API fallback mutation):**
  - Mutation: When `!input.hasPermissionsApi`, forced return `false`.
  - Result: Failed fallback test (`AssertionError: Expected values to be strictly equal: false !== true`).
- **TP5 (`denied` state acknowledged mutation):**
  - Mutation: When `permissionState === 'denied'`, returned `true` even if `alreadyShownDevice` is true.
  - Result: Failed acknowledged denied test (`AssertionError: Expected values to be strictly equal: true !== false`).

### 3. Verification Commands & Output
- **Unit Tests:**
  `node --import ./tests/register.mjs --test tests/location-gate.test.ts`
  ```text
  ✔ never shows explainer when permission is granted, across all 8 input combinations (0.915958ms)
  ✔ shows explainer on prompt state when session is not dismissed (0.067958ms)
  ✔ suppresses explainer on prompt state if dismissed in current session (0.051875ms)
  ✔ falls back to shown-once per device when Permissions API is unsupported (0.048708ms)
  ✔ handles denied permission state (0.100459ms)
  ✔ storage helpers handle missing window object gracefully without throwing (0.112791ms)
  ℹ tests 6
  ℹ suites 0
  ℹ pass 6
  ℹ fail 0
  ```
- **Type Checking:**
  `npm run test:compile` -> Exit 0.
- **Linting:**
  `npm run test:lint` -> Exit 0 (0 errors, 1481 pre-existing warnings).

---

## Planner review — M1 · 2026-10-03 · APPROVED · GO for M2

Checked: the decision matches the approved truth table; 6/6 tests pass (re-run by the Planner); the table-driven
`granted` test covers all 8 combinations and its throw proof fails as it should; storage helpers wrapped as asked;
the pure module sits in `src/components/workhub/`. Clean.

**Carry into M2 (two test gaps):**
1. **Storage that throws.** The helper test only runs with no `window`. Add one with a stubbed `globalThis.window`
   whose `localStorage` / `sessionStorage` getters throw: reads return `false`, writes do not throw. Throw proof:
   remove one try/catch → the test fails.
2. **Unknown permission state with the API present** (`hasPermissionsApi: true`, `permissionState: null` — the
   query is still pending or rejected): one case each for `alreadyShownDevice` true/false.

M2 as planned (component + hook gate + ClockButton), plus the review-1 requirements: every exit resolves,
`denied` reads as "Clock in", one dialog on screen.

---

## M2 — done · 2026-10-03

### 1. Scope Delivered
- **Carried Test Gaps & Throw Proofs (`tests/location-gate.test.ts`):**
  - Added test with stubbed `globalThis.window` simulating blocked/private mode storage where `localStorage` and `sessionStorage` methods throw. Verified reads safely return `false` and writes do not throw.
  - Added test for unknown `permissionState: null` with `hasPermissionsApi: true` covering both `alreadyShownDevice: false` (returns `true`) and `alreadyShownDevice: true` (returns `false`).
- **Throw Proofs Recorded:**
  - **TP6 (Storage throw proof):** Removed `try/catch` in `isDeviceExplainerShown()`. Test failed with `Error: Blocked storage access`. Restored and verified green.
  - **TP7 (Unknown permissionState fallback throw proof):** Mutated `return !input.alreadyShownDevice` to `return false`. Test failed with `AssertionError: false !== true`. Restored and verified green.
- **LocationExplainer Component (`src/components/workhub/LocationExplainer.tsx`):**
  - Phone-first WorkHub design, 48px touch targets, accessible Radix Dialog primitive.
  - Clear explanations: GPS read only at clock-in/out, never tracked continuously; purpose for timesheet and distance to site; never blocks clock-in.
  - On `permissionState === 'denied'`: displays settings warning banner, does not promise a prompt, and changes primary action button to "Inklokken" / "Clock in".
- **i18n Across 5 Crew Languages (`src/components/time-tracker/i18n/locales/*.json`):**
  - Complete `locationExplainer` translations in `nl`, `en`, `fr`, `ro`, and `ru`.
  - Guard test `tests/i18n-crew.test.ts` passes with 0 missing keys and 0 empty strings.
- **Unified Explainer Gate in `useGeolocation.ts`:**
  - `requestLocation()` evaluates gate decision and opens `LocationExplainer` when needed.
  - **Every exit path resolves the promise with `null` when no coordinates are obtained:**
    - "Continue" on `denied` state $\rightarrow$ resolves `null` immediately (no browser prompt attempted).
    - "Not now" $\rightarrow$ marks session dismissed, resolves `null` immediately.
    - Close button, backdrop tap, or Escape key $\rightarrow$ `onOpenChange(false)` resolves `null`.
    - App moving to background $\rightarrow$ `visibilitychange` listener resolves `null` and closes modal.
    - Component unmount $\rightarrow$ cleanup effect resolves any pending resolver with `null`.
  - **Single dialog on screen:** Each caller component instance maintains its own modal state in React, ensuring only the active call site opens its dialog.
  - Uses `next/dynamic` to load `LocationExplainer` on the client, preserving clean Node test runner execution.
- **Call Site Integration (`ClockButton.tsx`):**
  - Removed manual `if (permissionState === 'prompt')` intercept and local dialog state.
  - Rendered `{explainerDialog}` in component tree.
- **Removal of Legacy Component:**
  - Verified with `grep` that `src/components/time-tracker/components/LocationPermissionDialog.tsx` has 0 importers.
  - Deleted `LocationPermissionDialog.tsx`.

### 2. Verification Commands & Output
- **Unit Tests:**
  `node --import ./tests/register.mjs --test tests/location-gate.test.ts`
  ```text
  ✔ never shows explainer when permission is granted, across all 8 input combinations (0.42575ms)
  ✔ shows explainer on prompt state when session is not dismissed (0.060292ms)
  ✔ suppresses explainer on prompt state if dismissed in current session (0.050791ms)
  ✔ falls back to shown-once per device when Permissions API is unsupported (0.042083ms)
  ✔ handles denied permission state (0.048875ms)
  ✔ storage helpers handle missing window object gracefully without throwing (0.110875ms)
  ✔ storage helpers handle throwing storage gracefully (private mode / blocked storage) (0.105209ms)
  ✔ handles unknown permissionState (null) when Permissions API is present (0.052917ms)
  ℹ tests 8
  ℹ suites 0
  ℹ pass 8
  ℹ fail 0
  ```
- **Crew i18n Guard Suite:**
  `node --import ./tests/register.mjs --test tests/i18n-crew.test.ts`
  ```text
  ✔ every crew locale carries every key of en (plural forms count as one) (2.769958ms)
  ✔ no empty strings in any crew locale (1.592916ms)
  ✔ every literal t('…') in a react-i18next file resolves in en (118.033625ms)
  ℹ tests 3
  ℹ suites 0
  ℹ pass 3
  ℹ fail 0
  ```
- **Type Checking:**
  `npm run test:compile` $\rightarrow$ Exit 0.
- **Linting:**
  `npm run test:lint` $\rightarrow$ Exit 0 (0 errors, 1483 pre-existing warnings in untouched files).

---

## Planner review — M2 · 2026-10-03 · APPROVED with one fix (do it first in M3)

Checked: 11/11 tests (location-gate + i18n-crew) re-run green; the two M1 test gaps are closed; every exit
(Continue, Not now, close, backdrop, background, unmount) resolves the promise; `denied` never calls the phone;
the old `LocationPermissionDialog` is gone with its only importer; ClockButton clocks in with `null` location
exactly as before.

**🔴 Fix — "Not now" leaks to the phone's prompt.** After "Not now", the next request in the same session (the
clock-out, or a second clock-in) gets `shouldShow = false` and falls through to `requestLocationRaw()` — so the
phone's own prompt appears without our explanation, which is exactly what GEO-2 exists to prevent.
"Not now" means: no location, no prompt, for the rest of the session.

Make it a decision, not a branch in the hook: the pure function returns one of three actions —
`'explain'` (show our screen) · `'ask-phone'` (call the phone directly) · `'skip'` (no location, no prompt) —
and the hook only follows it. `'skip'` for: `denied` already explained, and `prompt` dismissed this session.
Tests: the table-driven test covers all three outcomes; throw proof: map the dismissed-session case to
`'ask-phone'` → the test fails.

Then M3 as planned (MySchedule, 5-language audit, compile/lint).
