"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { GeolocationCoordinates } from '@/components/time-tracker/types/timesheet';
import { shouldShowLocationExplainer } from '@/components/workhub/location-gate';

const LocationExplainer = dynamic(
  () => import('@/components/workhub/LocationExplainer').then((mod) => mod.LocationExplainer),
  { ssr: false }
);

// ── Geofence Validation ──────────────────────────────────────────────

export interface GeofenceResult {
  withinFence: boolean;
  distanceMeters: number;
  radiusMeters: number;
}

/**
 * Haversine formula — calculates the great-circle distance between two points
 * on the Earth's surface given their latitude and longitude in degrees.
 * Returns distance in meters.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates whether user coordinates are within the geofence of a project location.
 * @param userCoords - Worker's current GPS position
 * @param projectLat - Project site latitude
 * @param projectLng - Project site longitude
 * @param radiusMeters - Allowed radius in meters (default 200m)
 */
export function validateGeofence(
  userCoords: GeolocationCoordinates,
  projectLat: number,
  projectLng: number,
  radiusMeters: number = 200
): GeofenceResult {
  const distanceMeters = haversineDistance(
    userCoords.latitude, userCoords.longitude,
    projectLat, projectLng
  );

  return {
    withinFence: distanceMeters <= radiusMeters,
    distanceMeters: Math.round(distanceMeters),
    radiusMeters,
  };
}

// ── Geolocation Explainer Storage Helpers (GEO-2) ───────────────────

export const GEO_EXPLAINER_DEVICE_KEY = 'coral:geo-explainer-shown';
export const GEO_EXPLAINER_SESSION_KEY = 'coral:geo-explainer-dismissed';

export function isDeviceExplainerShown(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GEO_EXPLAINER_DEVICE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markDeviceExplainerShown(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GEO_EXPLAINER_DEVICE_KEY, 'true');
  } catch {
    // Ignore private mode / blocked storage throws
  }
}

export function isSessionExplainerDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(GEO_EXPLAINER_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissSessionExplainer(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(GEO_EXPLAINER_SESSION_KEY, 'true');
  } catch {
    // Ignore private mode / blocked storage throws
  }
}

// ── Geolocation Hook ─────────────────────────────────────────────────

export interface UseGeolocationResult {
  location: GeolocationCoordinates | null;
  error: string | null;
  loading: boolean;
  permissionState: PermissionState | null;
  /** Direct native location request (bypasses explainer modal gate) */
  requestLocationRaw: () => Promise<GeolocationCoordinates | null>;
  /**
   * Unified Location Gate:
   * Evaluates shouldShowLocationExplainer. If explanation needed, opens LocationExplainer
   * and awaits worker action.
   * - Continue -> marks device shown, requests native GPS (or resolves null if denied).
   * - Not now -> marks session dismissed, resolves null immediately.
   * - Escape / backdrop / close / background / unmount -> resolves null immediately.
   */
  requestLocation: (options?: { skipExplainer?: boolean }) => Promise<GeolocationCoordinates | null>;
  /** The LocationExplainer dialog element to render in the caller component */
  explainerDialog: React.ReactNode;
}

export function useGeolocation(): UseGeolocationResult {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const pendingResolverRef = useRef<((coords: GeolocationCoordinates | null) => void) | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      }).catch(() => {
        // Permissions API query rejected or unsupported
      });
    }
  }, []);

  const requestLocationRaw = useCallback(async (): Promise<GeolocationCoordinates | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: GeolocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setLocation(coords);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  const requestLocation = useCallback(async (options?: { skipExplainer?: boolean }): Promise<GeolocationCoordinates | null> => {
    if (options?.skipExplainer) {
      return requestLocationRaw();
    }

    const hasPermissionsApi = typeof navigator !== 'undefined' && 'permissions' in navigator;
    const alreadyShown = isDeviceExplainerShown();
    const sessionDismissed = isSessionExplainerDismissed();

    const shouldShow = shouldShowLocationExplainer({
      permissionState,
      hasPermissionsApi,
      alreadyShownDevice: alreadyShown,
      sessionDismissed,
    });

    if (!shouldShow) {
      if (permissionState === 'denied') {
        return null;
      }
      return requestLocationRaw();
    }

    if (pendingResolverRef.current) {
      pendingResolverRef.current(null);
      pendingResolverRef.current = null;
    }

    return new Promise<GeolocationCoordinates | null>((resolve) => {
      pendingResolverRef.current = resolve;
      setIsExplainerOpen(true);
    });
  }, [permissionState, requestLocationRaw]);

  const handleExplainerContinue = useCallback(async () => {
    markDeviceExplainerShown();
    setIsExplainerOpen(false);
    const resolver = pendingResolverRef.current;
    pendingResolverRef.current = null;
    if (!resolver) return;

    if (permissionState === 'denied') {
      resolver(null);
    } else {
      const coords = await requestLocationRaw();
      resolver(coords);
    }
  }, [permissionState, requestLocationRaw]);

  const handleExplainerDismiss = useCallback(() => {
    dismissSessionExplainer();
    setIsExplainerOpen(false);
    if (pendingResolverRef.current) {
      pendingResolverRef.current(null);
      pendingResolverRef.current = null;
    }
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setIsExplainerOpen(false);
      if (pendingResolverRef.current) {
        pendingResolverRef.current(null);
        pendingResolverRef.current = null;
      }
    }
  }, []);

  // Ensure clock-in never waits forever if app moves to background or unmounts
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && pendingResolverRef.current) {
        setIsExplainerOpen(false);
        pendingResolverRef.current(null);
        pendingResolverRef.current = null;
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (pendingResolverRef.current) {
        pendingResolverRef.current(null);
        pendingResolverRef.current = null;
      }
    };
  }, []);

  const explainerDialog = React.createElement(LocationExplainer, {
    open: isExplainerOpen,
    onOpenChange: handleOpenChange,
    onContinue: handleExplainerContinue,
    onDismiss: handleExplainerDismiss,
    isDenied: permissionState === 'denied',
  });

  return {
    location,
    error,
    loading,
    permissionState,
    requestLocationRaw,
    requestLocation,
    explainerDialog,
  };
}
