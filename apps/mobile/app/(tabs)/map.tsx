import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, {
  type Region,
  type MapStyleElement,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useNearbyParkings } from '@/features/parkings/hooks';
import { ParkingMapPin } from '@/features/parkings/components/ParkingMapPin';
import { ParkingBottomSheet } from '@/components/ParkingBottomSheet';
import { EmptyMapState } from '@/components/EmptyMapState';
import { MapSearchBar } from '@/features/search/components/MapSearchBar';
import type { GeocodeResult } from '@/features/search/api';
import { useFiltersStore } from '@/stores/filtersStore';
import { useUiStore } from '@/stores/uiStore';
import type { NearbyParking } from '@/types/domain';

// Import dark map style — bundled JSON array of Google Maps style rules
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MAP_STYLE_DARK = require('@/assets/map-style-dark.json') as MapStyleElement[];

const INITIAL_DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
const MADRID_FALLBACK: Region = {
  latitude: 40.4168,
  longitude: -3.7038,
  ...INITIAL_DELTA,
};

/** Search radius covering the full visible map area (diagonal), capped between 1 km and 15 km. */
function radiusFromDelta(latitudeDelta: number, longitudeDelta: number): number {
  const latM = (latitudeDelta / 2) * 111_000;
  const lngM = (longitudeDelta / 2) * 111_000;
  const diagonal = Math.sqrt(latM * latM + lngM * lngM);
  // 1.5× buffer keeps pins within radius even after a half-screen pan
  return Math.round(Math.min(Math.max(diagonal * 1.5, 1_000), 15_000));
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);

  const { location, permission, isLoading: locationLoading } = useUserLocation();
  const { parkingType, onlyVerified } = useFiltersStore();
  const setMapCenter = useUiStore((s) => s.setMapCenter);

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusM, setRadiusM] = useState(2000);
  const [selectedParking, setSelectedParking] = useState<NearbyParking | null>(null);

  const filterString = parkingType === 'all' ? undefined : parkingType;

  const { data: parkings = [], isLoading: parkingsLoading } = useNearbyParkings(
    center,
    radiusM,
    filterString,
    onlyVerified,
  );

  // Stable render order: nearby_parkings returns results sorted by distance (changes on every pan).
  // react-native-maps reorders native MKMapView annotations when JSX child order changes,
  // causing markers to briefly disappear. Sorting by ID keeps the native order constant.
  const sortedParkings = useMemo(
    () => [...parkings].sort((a, b) => a.id.localeCompare(b.id)),
    [parkings],
  );

  // Set initial map centre: from GPS when available, or Madrid fallback when GPS fails/unavailable
  useEffect(() => {
    if (center) return;
    if (location) {
      const initial = { lat: location.latitude, lng: location.longitude };
      setCenter(initial);
      setMapCenter(initial);
    } else if (!locationLoading) {
      // GPS not available (simulator, permission denied, etc.) — use fallback so queries start
      const fallback = { lat: MADRID_FALLBACK.latitude, lng: MADRID_FALLBACK.longitude };
      setCenter(fallback);
      setMapCenter(fallback);
    }
  }, [location, locationLoading, center, setMapCenter]);

  /** Called whenever the user finishes panning or zooming the map. */
  const handleRegionChangeComplete = useCallback((region: Region) => {
    const newCenter = { lat: region.latitude, lng: region.longitude };
    setCenter(newCenter);
    setMapCenter(newCenter);
    setRadiusM(radiusFromDelta(region.latitudeDelta, region.longitudeDelta));
  }, [setMapCenter]);

  const handlePinPress = useCallback(
    (parking: NearbyParking) => {
      setSelectedParking(parking);
    },
    [],
  );

  const handleBottomSheetClose = useCallback(() => {
    setSelectedParking(null);
  }, []);

  const handleRecenter = useCallback(() => {
    if (!location) return;
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      ...INITIAL_DELTA,
    });
  }, [location]);

  const handleLocationFound = useCallback((coords: GeocodeResult) => {
    mapRef.current?.animateToRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
  }, []);

  const permissionDenied =
    permission === Location.PermissionStatus.DENIED ||
    permission === Location.PermissionStatus.UNDETERMINED;

  const initialRegion: Region =
    location
      ? { latitude: location.latitude, longitude: location.longitude, ...INITIAL_DELTA }
      : MADRID_FALLBACK;

  return (
    <View className="flex-1 bg-background">
      <MapSearchBar onLocationFound={handleLocationFound} />

      {/* Map */}
      {!locationLoading && (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterest={false}
          customMapStyle={MAP_STYLE_DARK}
          onRegionChangeComplete={handleRegionChangeComplete}
          testID="map-view"
        >
          {sortedParkings.map((parking) => (
            <ParkingMapPin
              key={parking.id}
              parking={parking}
              onPress={() => handlePinPress(parking)}
            />
          ))}
        </MapView>
      )}

      {/* Loading spinner while location initialises */}
      {locationLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFD60A" />
          <Text className="text-content-muted mt-3 text-sm">
            Obteniendo tu ubicación…
          </Text>
        </View>
      )}

      {/* Location permission banner */}
      {!locationLoading && permissionDenied && (
        <SafeAreaView
          edges={['top']}
          className="absolute top-0 left-0 right-0 z-10"
        >
          <View className="mx-4 mt-16 bg-pending/90 rounded-card p-3 flex-row items-center">
            <Text className="text-background text-xs font-semibold flex-1">
              Activa la ubicación para ver parkings cerca de ti.
            </Text>
          </View>
        </SafeAreaView>
      )}

      {/* Parkings loading indicator */}
      {parkingsLoading && !locationLoading && (
        <View className="absolute top-28 self-center bg-surface/90 rounded-pill px-4 py-2">
          <ActivityIndicator size="small" color="#FFD60A" />
        </View>
      )}

      {/* Recenter button */}
      {!locationLoading && location && (
        <TouchableOpacity
          className="absolute bottom-48 right-4 w-12 h-12 bg-surface rounded-full shadow-lg border border-border items-center justify-center"
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="Centrar mapa en mi ubicación"
        >
          <Text className="text-primary text-xl">◎</Text>
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {!parkingsLoading && parkings.length === 0 && center !== null && (
        <EmptyMapState />
      )}


      {/* Parking detail bottom sheet */}
      <ParkingBottomSheet
        parking={selectedParking}
        onClose={handleBottomSheetClose}
      />
    </View>
  );
}
