// Web-only responsive map screen. Reuses the same hooks/components as the native
// map.tsx; only the layout differs by breakpoint. Unlike native, it does NOT gate
// the map render on location loading (browser geolocation may prompt/hang) — it
// centres on Madrid until GPS resolves. Native never resolves this file.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import MapView, { type Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '@/lib/responsive';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useNearbyParkings } from '@/features/parkings/hooks';
import { ParkingMapPin } from '@/features/parkings/components/ParkingMapPin';
import { ParkingBottomSheet } from '@/components/ParkingBottomSheet';
import { ParkingSidePanel } from '@/components/web/ParkingSidePanel';
import { MapSearch, type GeocodeResult } from '@/components/web/MapSearch';
import { useFiltersStore } from '@/stores/filtersStore';
import { useUiStore } from '@/stores/uiStore';
import type { NearbyParking } from '@/types/domain';

const INITIAL_DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
const MADRID = { latitude: 40.4168, longitude: -3.7038 };

/** Search radius covering the visible map area (diagonal), capped 1–15 km. Mirrors map.tsx. */
function radiusFromDelta(latitudeDelta: number, longitudeDelta: number): number {
  const latM = (latitudeDelta / 2) * 111_000;
  const lngM = (longitudeDelta / 2) * 111_000;
  const diagonal = Math.sqrt(latM * latM + lngM * lngM);
  return Math.round(Math.min(Math.max(diagonal * 1.5, 1_000), 15_000));
}

export default function MapScreenWeb() {
  const bp = useBreakpoint();
  const { location } = useUserLocation();
  const { parkingType, onlyVerified } = useFiltersStore();
  const setMapCenter = useUiStore((s) => s.setMapCenter);
  const mapRef = useRef<MapView>(null);

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: MADRID.latitude,
    lng: MADRID.longitude,
  });
  const [radiusM, setRadiusM] = useState(2000);
  const [selected, setSelected] = useState<NearbyParking | null>(null);

  const filterString = parkingType === 'all' ? undefined : parkingType;
  const { data: parkings = [], isLoading } = useNearbyParkings(
    center,
    radiusM,
    filterString,
    onlyVerified,
  );

  // Stable render order by id (see feedback_rn_maps_marker_order): avoids markers
  // flickering when the distance-sorted array reorders on pan.
  const sorted = useMemo(
    () => [...parkings].sort((a, b) => a.id.localeCompare(b.id)),
    [parkings],
  );

  const initialRegion: Region = {
    latitude: location?.latitude ?? MADRID.latitude,
    longitude: location?.longitude ?? MADRID.longitude,
    ...INITIAL_DELTA,
  };

  const handleRegionChangeComplete = useCallback(
    (r: Region) => {
      const c = { lat: r.latitude, lng: r.longitude };
      setCenter(c);
      setMapCenter(c);
      setRadiusM(radiusFromDelta(r.latitudeDelta, r.longitudeDelta));
    },
    [setMapCenter],
  );

  const handleRecenter = useCallback(() => {
    if (!location) return;
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      ...INITIAL_DELTA,
    });
  }, [location]);

  // The web map mounts on Madrid before geolocation resolves (see file header),
  // and the Leaflet shim reads initialRegion only once on mount. So recenter the
  // map the first time the user's location arrives — otherwise it silently stays
  // on Madrid even though location is known. Runs once; later pans are preserved.
  const didAutoCenter = useRef(false);
  useEffect(() => {
    if (!location || didAutoCenter.current) return;
    didAutoCenter.current = true;
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      ...INITIAL_DELTA,
    });
  }, [location]);

  const handleSearchSelect = useCallback((r: GeocodeResult) => {
    mapRef.current?.animateToRegion({
      latitude: r.lat,
      longitude: r.lng,
      ...INITIAL_DELTA,
    });
  }, []);

  const map = (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        onRegionChangeComplete={handleRegionChangeComplete}
        testID="map-view"
      >
        {sorted.map((p) => (
          <ParkingMapPin key={p.id} parking={p} onPress={() => setSelected(p)} />
        ))}
      </MapView>

      <MapSearch onSelect={handleSearchSelect} />

      {isLoading ? (
        <View
          style={{
            position: 'absolute',
            top: 16,
            alignSelf: 'center',
            backgroundColor: 'rgba(30,41,59,0.9)',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <ActivityIndicator size="small" color="#FFD60A" />
        </View>
      ) : null}

      {location ? (
        <Pressable
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="Centrar mapa en mi ubicación"
          style={{
            position: 'absolute',
            bottom: 24,
            right: 16,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#1e293b',
            borderWidth: 1,
            borderColor: '#334155',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="locate" size={22} color="#FFD60A" />
        </Pressable>
      ) : null}
    </View>
  );

  if (bp === 'mobile') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        {map}
        <ParkingBottomSheet parking={selected} onClose={() => setSelected(null)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
      {map}
      <ParkingSidePanel
        parkings={sorted}
        selected={selected}
        onSelect={setSelected}
        onClearSelection={() => setSelected(null)}
      />
    </View>
  );
}
