import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type UseUserLocationResult = {
  location: LocationCoords | null;
  permission: Location.PermissionStatus | null;
  isLoading: boolean;
  isLowAccuracy: boolean;
  requestPermission: () => Promise<void>;
};

const LOW_ACCURACY_THRESHOLD_M = 50;

/**
 * Requests and tracks the device's current GPS location.
 *
 * - Requests "when in use" location permission on mount.
 * - Updates `isLowAccuracy` when GPS accuracy exceeds 50 m.
 * - Returns `null` location if permission is denied.
 */
export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [permission, setPermission] =
    useState<Location.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLowAccuracy, setIsLowAccuracy] = useState(false);

  const requestAndFetch = useCallback(async () => {
    setIsLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);

    if (status !== Location.PermissionStatus.GRANTED) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: LocationCoords = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
      };

      setLocation(coords);
      setIsLowAccuracy(
        result.coords.accuracy !== null &&
          result.coords.accuracy > LOW_ACCURACY_THRESHOLD_M,
      );
    } catch {
      // GPS unavailable (simulator, aeroplane mode, etc.) — leave location null
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void requestAndFetch();
  }, [requestAndFetch]);

  const requestPermission = useCallback(async () => {
    await requestAndFetch();
  }, [requestAndFetch]);

  return { location, permission, isLoading, isLowAccuracy, requestPermission };
}
