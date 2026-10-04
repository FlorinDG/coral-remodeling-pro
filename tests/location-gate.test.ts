import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocationGateAction,
  shouldShowLocationExplainer,
  type LocationGateAction,
  type GeolocationPermissionState,
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

test('granted permission maps to ask-phone and never shows explainer across all 8 combinations', () => {
  const bools = [true, false];
  let combinationsChecked = 0;

  for (const hasPermissionsApi of bools) {
    for (const alreadyShownDevice of bools) {
      for (const sessionDismissed of bools) {
        combinationsChecked++;
        const input = {
          permissionState: 'granted' as const,
          hasPermissionsApi,
          alreadyShownDevice,
          sessionDismissed,
        };
        const action = getLocationGateAction(input);
        const shouldShow = shouldShowLocationExplainer(input);

        assert.equal(
          action,
          'ask-phone',
          `granted must return 'ask-phone' for combination (api=${hasPermissionsApi}, shown=${alreadyShownDevice}, dismissed=${sessionDismissed})`
        );
        assert.equal(
          shouldShow,
          false,
          `granted must return false for shouldShowLocationExplainer`
        );
      }
    }
  }

  assert.equal(combinationsChecked, 8, 'must verify all 2^3 = 8 combinations for granted');
});

// ── 2. PROMPT STATE (SHOW BEFORE NATIVE PROMPT) ──────────────────────────────

test('shows explainer on prompt state when session is not dismissed', () => {
  // First time on device
  const input1 = {
    permissionState: 'prompt' as const,
    hasPermissionsApi: true,
    alreadyShownDevice: false,
    sessionDismissed: false,
  };
  assert.equal(getLocationGateAction(input1), 'explain');
  assert.equal(shouldShowLocationExplainer(input1), true);

  // Ungranted on device across sessions (worker starts new session still in prompt state)
  const input2 = {
    permissionState: 'prompt' as const,
    hasPermissionsApi: true,
    alreadyShownDevice: true,
    sessionDismissed: false,
  };
  assert.equal(getLocationGateAction(input2), 'explain');
  assert.equal(shouldShowLocationExplainer(input2), true);
});

test('suppresses explainer and skips prompt if dismissed in current session', () => {
  // Worker clicked 'Not now' earlier in this browser session
  const input1 = {
    permissionState: 'prompt' as const,
    hasPermissionsApi: true,
    alreadyShownDevice: false,
    sessionDismissed: true,
  };
  assert.equal(getLocationGateAction(input1), 'skip', 'Not now must skip completely, never ask-phone');
  assert.equal(shouldShowLocationExplainer(input1), false);

  const input2 = {
    permissionState: 'prompt' as const,
    hasPermissionsApi: true,
    alreadyShownDevice: true,
    sessionDismissed: true,
  };
  assert.equal(getLocationGateAction(input2), 'skip', 'Not now must skip completely when already shown');
  assert.equal(shouldShowLocationExplainer(input2), false);
});

// ── 3. FALLBACK WHEN PERMISSIONS API IS UNAVAILABLE ─────────────────────────

test('falls back to shown-once per device when Permissions API is unsupported', () => {
  // First time on device without navigator.permissions
  const input1 = {
    permissionState: null,
    hasPermissionsApi: false,
    alreadyShownDevice: false,
  };
  assert.equal(getLocationGateAction(input1), 'explain');
  assert.equal(shouldShowLocationExplainer(input1), true);

  // Subsequent time on device without navigator.permissions (calls phone directly)
  const input2 = {
    permissionState: null,
    hasPermissionsApi: false,
    alreadyShownDevice: true,
  };
  assert.equal(getLocationGateAction(input2), 'ask-phone');
  assert.equal(shouldShowLocationExplainer(input2), false);
});

// ── 4. DENIED PERMISSION ────────────────────────────────────────────────────

test('handles denied permission state', () => {
  // First time on device when browser/site already has denied permission: explain once
  const input1 = {
    permissionState: 'denied' as const,
    hasPermissionsApi: true,
    alreadyShownDevice: false,
  };
  assert.equal(getLocationGateAction(input1), 'explain');
  assert.equal(shouldShowLocationExplainer(input1), true);

  // Already explained on device: skip (cannot prompt anyway without OS change)
  const input2 = {
    permissionState: 'denied' as const,
    hasPermissionsApi: true,
    alreadyShownDevice: true,
  };
  assert.equal(getLocationGateAction(input2), 'skip');
  assert.equal(shouldShowLocationExplainer(input2), false);
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

test('storage helpers handle throwing storage gracefully (private mode / blocked storage)', () => {
  const originalWindow = (globalThis as any).window;
  try {
    (globalThis as any).window = {
      localStorage: {
        getItem() { throw new Error('Blocked storage access'); },
        setItem() { throw new Error('Blocked storage access'); },
      },
      sessionStorage: {
        getItem() { throw new Error('Blocked storage access'); },
        setItem() { throw new Error('Blocked storage access'); },
      },
    };

    assert.equal(isDeviceExplainerShown(), false, 'throwing localStorage read must return false');
    assert.equal(isSessionExplainerDismissed(), false, 'throwing sessionStorage read must return false');
    assert.doesNotThrow(() => markDeviceExplainerShown(), 'throwing localStorage write must not throw');
    assert.doesNotThrow(() => dismissSessionExplainer(), 'throwing sessionStorage write must not throw');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

// ── 6. UNKNOWN PERMISSION STATE WITH API PRESENT ─────────────────────────────

test('handles unknown permissionState (null) when Permissions API is present', () => {
  // Query pending or rejected, but API is present, not yet shown on device
  const input1 = {
    permissionState: null,
    hasPermissionsApi: true,
    alreadyShownDevice: false,
  };
  assert.equal(getLocationGateAction(input1), 'explain');
  assert.equal(shouldShowLocationExplainer(input1), true);

  // Query pending or rejected, but API is present, already shown on device
  const input2 = {
    permissionState: null,
    hasPermissionsApi: true,
    alreadyShownDevice: true,
  };
  assert.equal(getLocationGateAction(input2), 'ask-phone');
  assert.equal(shouldShowLocationExplainer(input2), false);
});

// ── 7. TABLE-DRIVEN MATRIX ACROSS ALL 3 ACTIONS (explain, ask-phone, skip) ──

test('table-driven matrix covers all three actions (explain, ask-phone, skip)', () => {
  const cases: Array<{
    permissionState: GeolocationPermissionState;
    hasPermissionsApi: boolean;
    alreadyShownDevice: boolean;
    sessionDismissed: boolean;
    expectedAction: LocationGateAction;
    name: string;
  }> = [
    // granted (always ask-phone)
    { permissionState: 'granted', hasPermissionsApi: true, alreadyShownDevice: false, sessionDismissed: false, expectedAction: 'ask-phone', name: 'granted initial' },
    { permissionState: 'granted', hasPermissionsApi: true, alreadyShownDevice: true, sessionDismissed: false, expectedAction: 'ask-phone', name: 'granted already shown' },
    { permissionState: 'granted', hasPermissionsApi: true, alreadyShownDevice: false, sessionDismissed: true, expectedAction: 'ask-phone', name: 'granted dismissed' },
    { permissionState: 'granted', hasPermissionsApi: false, alreadyShownDevice: false, sessionDismissed: false, expectedAction: 'ask-phone', name: 'granted no api' },

    // prompt
    { permissionState: 'prompt', hasPermissionsApi: true, alreadyShownDevice: false, sessionDismissed: false, expectedAction: 'explain', name: 'prompt initial -> explain' },
    { permissionState: 'prompt', hasPermissionsApi: true, alreadyShownDevice: true, sessionDismissed: false, expectedAction: 'explain', name: 'prompt ungranted next session -> explain' },
    { permissionState: 'prompt', hasPermissionsApi: true, alreadyShownDevice: false, sessionDismissed: true, expectedAction: 'skip', name: 'prompt dismissed -> skip' },
    { permissionState: 'prompt', hasPermissionsApi: true, alreadyShownDevice: true, sessionDismissed: true, expectedAction: 'skip', name: 'prompt shown & dismissed -> skip' },

    // denied
    { permissionState: 'denied', hasPermissionsApi: true, alreadyShownDevice: false, sessionDismissed: false, expectedAction: 'explain', name: 'denied never shown -> explain' },
    { permissionState: 'denied', hasPermissionsApi: true, alreadyShownDevice: true, sessionDismissed: false, expectedAction: 'skip', name: 'denied already shown -> skip' },
    { permissionState: 'denied', hasPermissionsApi: true, alreadyShownDevice: false, sessionDismissed: true, expectedAction: 'skip', name: 'denied dismissed -> skip' },
    { permissionState: 'denied', hasPermissionsApi: true, alreadyShownDevice: true, sessionDismissed: true, expectedAction: 'skip', name: 'denied shown & dismissed -> skip' },

    // unsupported API / null state
    { permissionState: null, hasPermissionsApi: false, alreadyShownDevice: false, sessionDismissed: false, expectedAction: 'explain', name: 'unsupported api never shown -> explain' },
    { permissionState: null, hasPermissionsApi: false, alreadyShownDevice: true, sessionDismissed: false, expectedAction: 'ask-phone', name: 'unsupported api already shown -> ask-phone' },
    { permissionState: null, hasPermissionsApi: false, alreadyShownDevice: false, sessionDismissed: true, expectedAction: 'skip', name: 'unsupported api dismissed -> skip' },
    { permissionState: null, hasPermissionsApi: false, alreadyShownDevice: true, sessionDismissed: true, expectedAction: 'skip', name: 'unsupported api shown & dismissed -> skip' },
  ];

  for (const c of cases) {
    const action = getLocationGateAction({
      permissionState: c.permissionState,
      hasPermissionsApi: c.hasPermissionsApi,
      alreadyShownDevice: c.alreadyShownDevice,
      sessionDismissed: c.sessionDismissed,
    });
    assert.equal(action, c.expectedAction, `case failed: ${c.name}`);
  }
});

// ── 8. THROW PROOF TARGET: DISMISSED SESSION MUST MAP TO SKIP, NEVER ASK-PHONE ──

test('dismissed session never leaks to ask-phone for non-granted permissions', () => {
  const nonGrantedStates: GeolocationPermissionState[] = ['prompt', 'denied', null];
  for (const permissionState of nonGrantedStates) {
    const action = getLocationGateAction({
      permissionState,
      hasPermissionsApi: true,
      alreadyShownDevice: false,
      sessionDismissed: true,
    });
    assert.equal(
      action,
      'skip',
      `dismissed session for state=${permissionState} must be 'skip', never 'ask-phone'`
    );
  }
});


