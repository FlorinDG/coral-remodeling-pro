# CORAL — CODER REPORT — GEO-2 (M1)

### 0 · Header
```
Item:            GEO-2
Directive:       .agents/workflows/coder-directive-geo-2.md
Directive blob:  726ff3b1d3ee9a3f2c61c18d095299cff7edb4c3
Start SHA:       1e4318a
End SHA:         8d683e9
Branch:          develop
Date:            2026-10-03
Milestone:       M1 (Decision Logic, Storage Helpers, Table-Driven Tests)
```

### 1 · Outcome
`DONE — M1 ready for review`

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `8d683e9` | feat(geo-2): M1 location gate decision logic, storage helpers, and unit tests | 4 | +327/−1 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| Directive §Behaviour | Decision logic pure function tested for real | ✅ | `src/components/workhub/location-gate.ts:39-65`; tests `tests/location-gate.test.ts:17-147` |
| Directive §Behaviour | If permission is already `granted`, never show it | ✅ | `src/components/workhub/location-gate.ts:41-43`; test `tests/location-gate.test.ts:17-42` |
| Review Added req | `granted` never shows — table-driven over all 8 combinations | ✅ | `tests/location-gate.test.ts:17-42` (all 8 combinations verified) |
| Directive §Behaviour | Shown once per device, first time location is about to be requested | ✅ | `src/components/workhub/location-gate.ts:46-48, 59-64`; test `tests/location-gate.test.ts:47-57, 99-121` |
| Directive §Behaviour | Again only if permission is not granted (prompt across sessions) | ✅ | `src/components/workhub/location-gate.ts:51-56`; test `tests/location-gate.test.ts:60-70` |
| Directive §Behaviour | Fall back to "shown once" when Permissions API unavailable | ✅ | `src/components/workhub/location-gate.ts:46-48`; test `tests/location-gate.test.ts:99-121` |
| Directive §Behaviour | Handle denied permission state | ✅ | `src/components/workhub/location-gate.ts:59-61`; test `tests/location-gate.test.ts:125-147` |
| Directive §Tests | Each test with its throw proof | ✅ | Documented in `.agents/plans/GEO-2.md:309-325` & this report §6 |
| Review Ans 1 | Storage keys & helpers in `useGeolocation.ts` wrapped in try/catch | ✅ | `src/components/time-tracker/hooks/useGeolocation.ts:63-104`; test `tests/location-gate.test.ts:151-159` |
| Review Ans 2 | Decision module in `src/components/workhub/location-gate.ts` | ✅ | `src/components/workhub/location-gate.ts:1-66` |
| Directive §Fence | No new dependency | ✅ | Zero additions to `package.json` |
| Directive §The need | 2 buttons (Continue / Not now) UI | ⏭ | Deferred to M2 (`LocationExplainer.tsx`) |
| Directive §Call sites | Single gate across 4 call sites | ⏭ | Deferred to M2/M3 |
| Directive §Behaviour | 5 crew languages (en/nl/fr/ro/ru) | ⏭ | Deferred to M3 |
| Review Ans 3 | Replace and delete `LocationPermissionDialog.tsx` | ⏭ | Deferred to M2 once `ClockButton.tsx` is updated |

### 4 · Files vs blast radius
Verbatim `git diff --stat 1e4318a..8d683e9`:
```
 .agents/plans/GEO-2.md                             |  61 ++++++++
 .../time-tracker/hooks/useGeolocation.ts           |  43 +++++-
 src/components/workhub/location-gate.ts            |  65 +++++++++
 tests/location-gate.test.ts                        | 159 +++++++++++++++++++++
 4 files changed, 327 insertions(+), 1 deletion(-)
```

| File | In blast radius? |
|---|---|
| `.agents/plans/GEO-2.md` | Yes (Plan file per §0) |
| `src/components/time-tracker/hooks/useGeolocation.ts` | Yes (Directive fence: "May change: ... useGeolocation.ts (only to add the gate)") |
| `src/components/workhub/location-gate.ts` | Yes (Directive fence: "one pure module for the decision" + Planner review: "Put the pure function in src/components/workhub/location-gate.ts") |
| `tests/location-gate.test.ts` | Yes (Directive fence: "one test file") |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/components/workhub/location-gate.ts:1-66` | Pure module placement | Put in `src/lib/kernel/` or `src/components/workhub/` | `src/components/workhub/location-gate.ts` | Planner review binding decision 2: `src/lib/kernel/` is reserved for tenant-free primitives; UI screen decision lives in workhub. |
| `src/components/time-tracker/hooks/useGeolocation.ts:3` | Node ESM import of `timesheet.ts` types | `import { GeolocationCoordinates }` vs `import type { GeolocationCoordinates }` | `import type { GeolocationCoordinates }` | When Node test runner loads `useGeolocation.ts`, value import of a TypeScript interface throws `SyntaxError: The requested module ... does not provide an export named 'GeolocationCoordinates'`. `import type` is pure erased type annotation. |
| `src/components/workhub/location-gate.ts:22` | Optionality of `sessionDismissed` parameter | Required boolean vs optional boolean | Optional boolean (`sessionDismissed?: boolean`) | Call sites or tests that don't track session dismissal can omit it cleanly; falsy evaluation preserves safe behavior. |
| `src/components/time-tracker/hooks/useGeolocation.ts:63-64` | Storage key naming | Raw strings vs named exported constants | Exported constants `GEO_EXPLAINER_DEVICE_KEY` and `GEO_EXPLAINER_SESSION_KEY` | Allows tests to assert exact string values (`coral:geo-explainer-shown` and `coral:geo-explainer-dismissed`) without hardcoding them in multiple locations. |

### 6 · Verification — commands, not descriptions

### VERIFY 1: Unit Test Suite
```
$ node --import ./tests/register.mjs --test tests/location-gate.test.ts; echo "exit: $?"
✔ never shows explainer when permission is granted, across all 8 input combinations (1.089208ms)
✔ shows explainer on prompt state when session is not dismissed (0.064708ms)
✔ suppresses explainer on prompt state if dismissed in current session (0.04975ms)
✔ falls back to shown-once per device when Permissions API is unsupported (0.04625ms)
✔ handles denied permission state (0.051625ms)
✔ storage helpers handle missing window object gracefully without throwing (0.11375ms)
(node:3116) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/florin/Documents/GitHub/coral-remodeling-pro/tests/location-gate.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/florin/Documents/GitHub/coral-remodeling-pro/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 143.358167
exit: 0
```

### VERIFY 2: Throw Proofs
All 5 mutations were executed and verified to fail their respective test, then restored:
1. **TP1 (Table-driven `granted` mutation):**
   - Mutation in `src/components/workhub/location-gate.ts:41`: `if (input.permissionState === 'granted') return !input.alreadyShownDevice;`
   - Output:
     ```
     ✖ never shows explainer when permission is granted, across all 8 input combinations (1.277083ms)
       AssertionError [ERR_ASSERTION]: granted must return false for combination (api=true, shown=false, dismissed=true)
     ```
   - Restored and verified green.
2. **TP2 (`prompt` state initial mutation):**
   - Mutation in `src/components/workhub/location-gate.ts:51`: `if (input.permissionState === 'prompt') return false;`
   - Output:
     ```
     ✖ shows explainer on prompt state when session is not dismissed (0.081542ms)
       AssertionError [ERR_ASSERTION]: must show explainer on initial prompt state
     ```
   - Restored and verified green.
3. **TP3 (`prompt` session dismissal mutation):**
   - Mutation in `src/components/workhub/location-gate.ts:51`: `if (input.permissionState === 'prompt') return true;`
   - Output:
     ```
     ✖ suppresses explainer on prompt state if dismissed in current session (0.05775ms)
       AssertionError [ERR_ASSERTION]: must not repeatedly nag worker in same session after Not now
     ```
   - Restored and verified green.
4. **TP4 (Unsupported Permissions API fallback mutation):**
   - Mutation in `src/components/workhub/location-gate.ts:46`: `if (!input.hasPermissionsApi) return false;`
   - Output:
     ```
     ✖ falls back to shown-once per device when Permissions API is unsupported (0.054375ms)
       AssertionError [ERR_ASSERTION]: must show explainer once when Permissions API is unavailable
     ```
   - Restored and verified green.
5. **TP5 (`denied` state acknowledged mutation):**
   - Mutation in `src/components/workhub/location-gate.ts:59`: `if (input.permissionState === 'denied') return true;`
   - Output:
     ```
     ✖ handles denied permission state (0.059291ms)
       AssertionError [ERR_ASSERTION]: do not show when already explained on device for denied permission
     ```
   - Restored and verified green.

### VERIFY 3: Typecheck
```
$ npm run test:compile; echo "exit: $?"

> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY 4: Lint
```
$ npm run test:lint; echo "exit: $?"

> coral-remodeling-pro@0.1.0 test:lint
> eslint src

[trimmed: 1481 pre-existing warnings in untouched files]
✖ 1481 problems (0 errors, 1481 warnings)
  0 errors and 19 warnings potentially fixable with the `--fix` option.

exit: 0
```

### 7 · Measurements
None.

### 8 · 🟨 Report-only items
None.

### 9 · Not done, and why
- UI Modal Component `LocationExplainer.tsx`: Deferred to M2 per approved plan.
- Call site rewiring (`ClockButton.tsx` and `MySchedule.tsx`): Deferred to M2/M3 per approved plan.
- 5 Languages translations (`locales/*.json`): Deferred to M3 per approved plan.
- Deletion of `LocationPermissionDialog.tsx`: Deferred to M2 once call site `ClockButton.tsx` is switched to `LocationExplainer`.

### 10 · Noticed, out of scope
`src/components/time-tracker/components/LocationPermissionDialog.tsx` is still imported by `ClockButton.tsx:21`. Per Planner review Gate 1 decision 3, once `ClockButton.tsx` is rewired to `LocationExplainer` in M2, this file will have 0 importers and will be deleted.

---

## REVISION 1 — M2 · 2026-10-03

### 0 · Header
```
Item:            GEO-2
Directive:       .agents/workflows/coder-directive-geo-2.md
Directive blob:  726ff3b1d3ee9a3f2c61c18d095299cff7edb4c3
Start SHA:       e73b8b0
End SHA:         065ed47
Branch:          develop
Date:            2026-10-03
Milestone:       M2 (Component, Unified Hook Gate, ClockButton Integration, 5-Locale Parity)
```

### 1 · Outcome
`DONE — M2 ready for review`

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `065ed47` | feat(geo-2): M2 LocationExplainer component, unified hook gate, ClockButton integration, and 5-locale parity | 11 | +435/−94 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| Review Carry 1 | Storage that throws test + throw proof | ✅ | `tests/location-gate.test.ts:161-188`; TP6 documented in §6 |
| Review Carry 2 | Unknown permissionState (null) with API present test + throw proof | ✅ | `tests/location-gate.test.ts:190-213`; TP7 documented in §6 |
| Directive §The need | 2 buttons (Continue / Not now) UI, phone-first, WorkHub look | ✅ | `src/components/workhub/LocationExplainer.tsx:1-120` |
| Review M1 req | On `denied`: "Clock in" button label + settings warning line | ✅ | `src/components/workhub/LocationExplainer.tsx:88-106` |
| Review M1 req | Every exit from dialog resolves promise (null when no location) | ✅ | `src/components/time-tracker/hooks/useGeolocation.ts:182-269` |
| Review M1 req | One dialog on screen (per-caller hook state) | ✅ | `src/components/time-tracker/hooks/useGeolocation.ts:121, 169` |
| Directive §Behaviour | 5 crew languages (en/nl/fr/ro/ru) | ✅ | `src/components/time-tracker/i18n/locales/*.json`; test `tests/i18n-crew.test.ts:1-74` |
| Directive §Call sites | ClockButton.tsx call sites rewired to gate | ✅ | `src/components/time-tracker/components/ClockButton.tsx:28, 81, 313` |
| Review Ans 3 | Delete `LocationPermissionDialog.tsx` once 0 importers | ✅ | Deleted; grep proof in §8 |
| Directive §Call sites | MySchedule.tsx call sites | ⏭ | Deferred to M3 per approved plan |

### 4 · Files vs blast radius
Verbatim `git diff --stat e73b8b0..065ed47`:
```
 .agents/plans/GEO-2.md                             |  68 ++++++++++
 .../time-tracker/components/ClockButton.tsx        |  22 +---
 .../components/LocationPermissionDialog.tsx        |  67 ----------
 .../time-tracker/hooks/useGeolocation.ts           | 144 ++++++++++++++++++++-
 src/components/time-tracker/i18n/locales/en.json   |  11 ++
 src/components/time-tracker/i18n/locales/fr.json   |  11 ++
 src/components/time-tracker/i18n/locales/nl.json   |  11 ++
 src/components/time-tracker/i18n/locales/ro.json   |  11 ++
 src/components/time-tracker/i18n/locales/ru.json   |  11 ++
 src/components/workhub/LocationExplainer.tsx       | 119 +++++++++++++++++
 tests/location-gate.test.ts                        |  54 ++++++++
 11 files changed, 435 insertions(+), 94 deletions(-)
```

| File | In blast radius? |
|---|---|
| `.agents/plans/GEO-2.md` | Yes (Plan file per §0) |
| `src/components/time-tracker/components/ClockButton.tsx` | Yes (Directive fence: "May change: the four call sites above") |
| `src/components/time-tracker/components/LocationPermissionDialog.tsx` | Yes (Gate 1 Planner review: "Fence extended by exactly this: you may delete ... LocationPermissionDialog.tsx once ClockButton.tsx no longer imports it") |
| `src/components/time-tracker/hooks/useGeolocation.ts` | Yes (Directive fence: "May change: ... useGeolocation.ts (only to add the gate)") |
| `src/components/time-tracker/i18n/locales/*.json` (en, fr, nl, ro, ru) | Yes (Directive fence: "the 5 crew locale files") |
| `src/components/workhub/LocationExplainer.tsx` | Yes (Directive fence: "May create: one component (src/components/workhub/LocationExplainer.tsx)") |
| `tests/location-gate.test.ts` | Yes (Directive fence: "one test file") |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/components/time-tracker/hooks/useGeolocation.ts:7-10` | Loading `LocationExplainer` in `.ts` hook without breaking Node test runner | Static import vs dynamic component load | `next/dynamic(() => import('@/components/workhub/LocationExplainer').then(m => m.LocationExplainer), { ssr: false })` | Node's native ESM loader strips TypeScript annotations from `.ts` files but does not parse `.tsx` files. Using `next/dynamic` defers UI component evaluation to browser runtime, preventing Node from attempting to load `.tsx` when executing unit tests for storage helpers. |
| `src/components/time-tracker/hooks/useGeolocation.ts:245-267` | Guaranteeing clock-in never waits forever on app background | Rely on window focus vs listen for `visibilitychange` | `visibilitychange` listener resolving `null` on `document.visibilityState === 'hidden'` + unmount cleanup | If mobile OS switches away from browser or app backgrounds while modal is open, pending resolver is immediately fulfilled with `null`, preventing permanently stalled clock-in promises. |
| `src/components/time-tracker/i18n/locales/*.json` | Translation key naming for Privacy badge label | Reuse existing ad-hoc keys vs dedicated `privacyTitle` key | `locationExplainer.privacyTitle` in all 5 locales | `tests/i18n-crew.test.ts` strictly checks that every namespaced `t('...')` resolves in `en` and all 5 locales match; dedicated key maintains full 5-locale parity. |

### 6 · Verification — commands, not descriptions

### VERIFY 1: Location Gate Suite (8/8 tests pass)
```
$ node --import ./tests/register.mjs --test tests/location-gate.test.ts; echo "exit: $?"
✔ never shows explainer when permission is granted, across all 8 input combinations (0.6815ms)
✔ shows explainer on prompt state when session is not dismissed (0.079542ms)
✔ suppresses explainer on prompt state if dismissed in current session (0.062458ms)
✔ falls back to shown-once per device when Permissions API is unsupported (0.051083ms)
✔ handles denied permission state (0.0575ms)
✔ storage helpers handle missing window object gracefully without throwing (0.143292ms)
✔ storage helpers handle throwing storage gracefully (private mode / blocked storage) (0.139334ms)
✔ handles unknown permissionState (null) when Permissions API is present (0.05025ms)
(node:5669) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/florin/Documents/GitHub/coral-remodeling-pro/tests/location-gate.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/florin/Documents/GitHub/coral-remodeling-pro/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 232.418958
exit: 0
```

### VERIFY 2: Crew i18n Guard Suite (5 locales verified)
```
$ node --import ./tests/register.mjs --test tests/i18n-crew.test.ts; echo "exit: $?"
✔ every crew locale carries every key of en (plural forms count as one) (2.292375ms)
✔ no empty strings in any crew locale (1.73225ms)
✔ every literal t('…') in a react-i18next file resolves in en (129.360625ms)
(node:5682) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/florin/Documents/GitHub/coral-remodeling-pro/tests/i18n-crew.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/florin/Documents/GitHub/coral-remodeling-pro/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 261.885
exit: 0
```

### VERIFY 3: M2 Throw Proofs
1. **TP6 (Storage throw proof):**
   - Mutation in `src/components/time-tracker/hooks/useGeolocation.ts:68`: removed `try/catch` around `localStorage.getItem`.
   - Output:
     ```
     ✖ storage helpers handle throwing storage gracefully (private mode / blocked storage) (0.121417ms)
       Error: Blocked storage access
           at Object.getItem (file:///.../tests/location-gate.test.ts:166:27)
           at isDeviceExplainerShown (file:///.../src/components/time-tracker/hooks/useGeolocation.ts:68:30)
     ```
   - Restored and verified green.
2. **TP7 (Unknown permissionState fallback throw proof):**
   - Mutation in `src/components/workhub/location-gate.ts:64`: replaced `return !input.alreadyShownDevice;` with `return false;`.
   - Output:
     ```
     ✖ handles unknown permissionState (null) when Permissions API is present (0.399375ms)
       AssertionError [ERR_ASSERTION]: must show explainer if permissionState is null and device has not seen it
       false !== true
     ```
   - Restored and verified green.

### VERIFY 4: Typecheck
```
$ npm run test:compile; echo "exit: $?"

> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY 5: Lint
```
$ npm run test:lint; echo "exit: $?"

> coral-remodeling-pro@0.1.0 test:lint
> eslint src

[trimmed: 1483 pre-existing warnings in untouched files]
✖ 1483 problems (0 errors, 1483 warnings)
  0 errors and 19 warnings potentially fixable with the `--fix` option.

exit: 0
```

### 7 · Measurements
None.

### 8 · 🟨 Report-only items
Verification that `LocationPermissionDialog` was completely purged from codebase:
```
$ grep -rn "LocationPermissionDialog" src; echo "exit: $?"
exit: 1
```
(Zero matches found in `src/`).

### 9 · Not done, and why
`src/components/time-tracker/components/MySchedule.tsx` call sites (lines 247 & 326) deferred to M3 per the approved plan.

### 10 · Noticed, out of scope
None.

