"use client";
import { useState, useCallback, useEffect } from 'react';
import { GeolocationCoordinates } from '@/components/time-tracker/types/timesheet';

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
