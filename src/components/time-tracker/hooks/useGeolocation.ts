"use client";
import { useState, useCallback, useEffect } from 'react';
import { GeolocationCoordinates } from '@/components/time-tracker/types/timesheet';

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

// ── Geolocation Hook ─────────────────────────────────────────────────

interface UseGeolocationResult {
  location: GeolocationCoordinates | null;
  error: string | null;
  loading: boolean;
  permissionState: PermissionState | null;
  requestLocation: () => Promise<GeolocationCoordinates | null>;
}

export function useGeolocation(): UseGeolocationResult {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      });
    }
  }, []);

  const requestLocation = useCallback(async (): Promise<GeolocationCoordinates | null> => {
    if (!navigator.geolocation) {
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

  return { location, error, loading, permissionState, requestLocation };
}
