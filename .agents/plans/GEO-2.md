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
