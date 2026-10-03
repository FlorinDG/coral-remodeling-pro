import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowLocationExplainer,
} from '../src/components/workhub/location-gate.ts';
import {
  GEO_EXPLAINER_DEVICE_KEY,
  GEO_EXPLAINER_SESSION_KEY,
  isDeviceExplainerShown,
  markDeviceExplainerShown,
  isSessionExplainerDismissed,
  dismissSessionExplainer,
} from '../src/components/time-tracker/hooks/useGeolocation.ts';

// ── 1. GRANTED PERMISSION: NEVER SHOW (TABLE-DRIVEN OVER ALL 8 COMBINATIONS) ──

test('never shows explainer when permission is granted, across all 8 input combinations', () => {
  const bools = [true, false];
  let combinationsChecked = 0;

  for (const hasPermissionsApi of bools) {
    for (const alreadyShownDevice of bools) {
      for (const sessionDismissed of bools) {
        combinationsChecked++;
        const result = shouldShowLocationExplainer({
          permissionState: 'granted',
          hasPermissionsApi,
          alreadyShownDevice,
          sessionDismissed,
        });

        assert.equal(
          result,
          false,
          `granted must return false for combination (api=${hasPermissionsApi}, shown=${alreadyShownDevice}, dismissed=${sessionDismissed})`
        );
      }
    }
  }

  assert.equal(combinationsChecked, 8, 'must verify all 2^3 = 8 combinations for granted');
});

// ── 2. PROMPT STATE (SHOW BEFORE NATIVE PROMPT) ──────────────────────────────

test('shows explainer on prompt state when session is not dismissed', () => {
  // First time on device
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: 'prompt',
      hasPermissionsApi: true,
      alreadyShownDevice: false,
      sessionDismissed: false,
    }),
    true,
    'must show explainer on initial prompt state'
  );

  // Ungranted on device across sessions (worker starts new session still in prompt state)
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: 'prompt',
      hasPermissionsApi: true,
      alreadyShownDevice: true,
      sessionDismissed: false,
    }),
    true,
    'must show explainer again if permission remains ungranted in a new session'
  );
});

test('suppresses explainer on prompt state if dismissed in current session', () => {
  // Worker clicked 'Not now' earlier in this browser session
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: 'prompt',
      hasPermissionsApi: true,
      alreadyShownDevice: false,
      sessionDismissed: true,
    }),
    false,
    'must not repeatedly nag worker in same session after Not now'
  );

  assert.equal(
    shouldShowLocationExplainer({
      permissionState: 'prompt',
      hasPermissionsApi: true,
      alreadyShownDevice: true,
      sessionDismissed: true,
    }),
    false,
    'must not nag worker in same session when already shown on device'
  );
});

// ── 3. FALLBACK WHEN PERMISSIONS API IS UNAVAILABLE ─────────────────────────

test('falls back to shown-once per device when Permissions API is unsupported', () => {
  // First time on device without navigator.permissions
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: null,
      hasPermissionsApi: false,
      alreadyShownDevice: false,
    }),
    true,
    'must show explainer once when Permissions API is unavailable'
  );

  // Subsequent time on device without navigator.permissions
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: null,
      hasPermissionsApi: false,
      alreadyShownDevice: true,
    }),
    false,
    'must not show explainer again on same device when Permissions API is unavailable'
  );
});

// ── 4. DENIED PERMISSION ────────────────────────────────────────────────────

test('handles denied permission state', () => {
  // First time on device when browser/site already has denied permission: show once so worker understands
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: 'denied',
      hasPermissionsApi: true,
      alreadyShownDevice: false,
    }),
    true,
    'shows once if never explained on this device'
  );

  // Already explained on device: do not show repeatedly since browser won't re-prompt
  assert.equal(
    shouldShowLocationExplainer({
      permissionState: 'denied',
      hasPermissionsApi: true,
      alreadyShownDevice: true,
    }),
    false,
    'do not show when already explained on device for denied permission'
  );
});

// ── 5. STORAGE HELPERS AND WINDOW FALLBACKS ─────────────────────────────────

test('storage helpers handle missing window object gracefully without throwing', () => {
  // Running in Node.js test environment (typeof window === 'undefined')
  assert.equal(isDeviceExplainerShown(), false);
  assert.equal(isSessionExplainerDismissed(), false);
  assert.doesNotThrow(() => markDeviceExplainerShown());
  assert.doesNotThrow(() => dismissSessionExplainer());
  assert.equal(GEO_EXPLAINER_DEVICE_KEY, 'coral:geo-explainer-shown');
  assert.equal(GEO_EXPLAINER_SESSION_KEY, 'coral:geo-explainer-dismissed');
});
