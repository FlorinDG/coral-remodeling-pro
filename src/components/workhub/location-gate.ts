/**
 * GEO-2 · Location gate decision logic.
 * Pure module: evaluates whether our custom location explainer modal should be
 * presented to the crew member prior to requesting browser geolocation.
 *
 * PURE: No window, no storage, no React. Fully runnable under Node test runner.
 */

export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | null;

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
 * Pure decision function evaluating whether the LocationExplainer modal should be shown.
 *
 * Rules:
 * 1. If permission is already 'granted' -> NEVER show (redundant, whatever other inputs are).
 * 2. If Permissions API is unavailable -> Fall back to 'shown once' on device.
 * 3. If permission is 'prompt':
 *    - If dismissed in this session ('Not now') -> do not show again this session.
 *    - Otherwise -> show before phone asks.
 * 4. If permission is 'denied':
 *    - If already explained on device -> do not show (cannot prompt anyway without OS change).
 *    - If never explained on device -> show once so user understands why location is disabled.
 * 5. If permissionState is null (unknown) -> Fall back to 'shown once' on device.
 */
export function shouldShowLocationExplainer(input: LocationGateDecisionInput): boolean {
  // 1. If already granted, never show (under any combination of inputs)
  if (input.permissionState === 'granted') {
    return false;
  }

  // 2. If permissions API is unavailable, fall back to "shown once per device"
  if (!input.hasPermissionsApi) {
    return !input.alreadyShownDevice;
  }

  // 3. If permission is in 'prompt' state
  if (input.permissionState === 'prompt') {
    if (input.sessionDismissed) {
      return false;
    }
    return true;
  }

  // 4. If permission is 'denied'
  if (input.permissionState === 'denied') {
    return !input.alreadyShownDevice;
  }

  // 5. Unknown permission state (null) -> fall back to shown once
  return !input.alreadyShownDevice;
}
