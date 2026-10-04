/**
 * GEO-2 · Location gate decision logic.
 * Pure module: evaluates whether our custom location explainer modal should be
 * presented to the crew member prior to requesting browser geolocation.
 *
 * PURE: No window, no storage, no React. Fully runnable under Node test runner.
 */

export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | null;

export type LocationGateAction = 'explain' | 'ask-phone' | 'skip';

export interface LocationGateDecisionInput {
  /**
   * Permission state from navigator.permissions.query({ name: 'geolocation' }),
   * or null if query is unsupported or pending.
   */
  permissionState: GeolocationPermissionState;
  /** Whether the runtime supports navigator.permissions */
  hasPermissionsApi: boolean;
  /** Whether this explanation was already presented and acknowledged on this device */
  alreadyShownDevice: boolean;
  /** Whether the user tapped 'Not now' in the current browser session */
  sessionDismissed?: boolean;
}

/**
 * Pure decision function evaluating the gate action for location requests.
 *
 * Actions:
 * - 'explain'   : Present our LocationExplainer modal before native prompt.
 * - 'ask-phone' : Request browser geolocation directly (permission already granted or device already explained).
 * - 'skip'      : Do not request location and do not prompt the phone (e.g. dismissed this session or denied & already explained).
 *
 * Rules:
 * 1. If permission is already 'granted' -> Ask phone directly (under any combination of inputs).
 * 2. If user dismissed in this session ('Not now') -> 'skip' (no location, NO prompt for rest of session).
 * 3. If permission is 'denied':
 *    - If never explained on device -> 'explain' once so user understands why location is disabled.
 *    - If already explained on device -> 'skip' (cannot prompt anyway without OS change).
 * 4. If permission is 'prompt' -> 'explain' before native phone prompt.
 * 5. If Permissions API unavailable or state is null:
 *    - If never explained on device -> 'explain'.
 *    - If already explained on device -> 'ask-phone' (browser native handling).
 */
export function getLocationGateAction(input: LocationGateDecisionInput): LocationGateAction {
  // 1. If already granted, ask phone directly (whatever the other inputs are)
  if (input.permissionState === 'granted') {
    return 'ask-phone';
  }

  // 2. "Not now" in this session -> skip (no prompt, no location for rest of session)
  if (input.sessionDismissed) {
    return 'skip';
  }

  // 3. If permission is 'denied'
  if (input.permissionState === 'denied') {
    if (!input.alreadyShownDevice) {
      return 'explain';
    }
    return 'skip';
  }

  // 4. If permission is 'prompt'
  if (input.permissionState === 'prompt') {
    return 'explain';
  }

  // 5. Unknown permission state (null) or Permissions API unavailable
  if (!input.alreadyShownDevice) {
    return 'explain';
  }

  return 'ask-phone';
}

/**
 * Convenience helper: returns true when gate action is 'explain'.
 */
export function shouldShowLocationExplainer(input: LocationGateDecisionInput): boolean {
  return getLocationGateAction(input) === 'explain';
}

