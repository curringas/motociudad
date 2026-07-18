// Web replacement for `react-native-maps`, backed by Leaflet + OpenStreetMap tiles.
// Implements ONLY the API surface the app uses (see map.tsx / contribute.tsx /
// ParkingMapPin.tsx). Bundled by Metro exclusively on web (see metro.config.js);
// native platforms never resolve this file.
//
// NOTE: Expo web statically prerenders pages in Node (SSR). Leaflet touches
// `window` at import time, so it is loaded LAZILY (dynamic import) inside effects,
// never at module top. The static import below is TYPE-ONLY (erased at build).
import 'leaflet/dist/leaflet.css';
import type * as LType from 'leaflet';
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { zoomFromLongitudeDelta, LEAFLET_TILE_SIZE } from './geo';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';

// Cache the client-only Leaflet module so it loads once, in the browser.
let leafletPromise: Promise<typeof LType> | null = null;
async function getLeaflet(): Promise<typeof LType> {
  if (!leafletPromise) {
    leafletPromise = (async () => {
      const mod = await import('leaflet');
      return (mod.default ?? mod) as typeof LType;
    })();
  }
  return leafletPromise;
}

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = 'google';

const MapContext = createContext<LType.Map | null>(null);

type MapViewProps = {
  style?: unknown;
  initialRegion?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
  testID?: string;
  // Unsupported RN Maps props (provider, customMapStyle, showsCompass, ...) are accepted and ignored.
  provider?: unknown;
  customMapStyle?: unknown;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  showsPointsOfInterest?: boolean;
};

export type MapViewHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { initialRegion, onRegionChangeComplete, children, testID },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const [map, setMap] = useState<LType.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await getLeaflet();
      if (cancelled || !containerRef.current || mapRef.current) return;
      const width = containerRef.current.clientWidth || 375;
      const region = initialRegion ?? {
        latitude: 40.4168,
        longitude: -3.7038,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      const instance = L.map(containerRef.current, {
        center: [region.latitude, region.longitude],
        zoom: zoomFromLongitudeDelta(region.longitudeDelta, width, LEAFLET_TILE_SIZE),
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(instance);
      setTimeout(() => instance.invalidateSize(), 0);

      instance.on('moveend', () => {
        if (!onRegionChangeComplete) return;
        const c = instance.getCenter();
        const b = instance.getBounds();
        onRegionChangeComplete({
          latitude: c.lat,
          longitude: c.lng,
          latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
          longitudeDelta: Math.abs(b.getEast() - b.getWest()),
        });
      });

      mapRef.current = instance;
      setMap(instance);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Mount once; later initialRegion changes are ignored (matches RN Maps behaviour).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      const instance = mapRef.current;
      if (!instance) return;
      const width = containerRef.current?.clientWidth || 375;
      instance.flyTo(
        [region.latitude, region.longitude],
        zoomFromLongitudeDelta(region.longitudeDelta, width, LEAFLET_TILE_SIZE),
      );
    },
  }));

  return (
    <div
      ref={containerRef}
      data-testid={testID}
      style={{ position: 'relative', flex: 1, width: '100%', height: '100%', minHeight: 200 }}
    >
      {map ? (
        <MapContext.Provider value={map}>{children}</MapContext.Provider>
      ) : null}
    </div>
  );
});

type DragEndEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  onPress?: () => void;
  draggable?: boolean;
  onDragEnd?: (e: DragEndEvent) => void;
  children?: React.ReactNode;
  identifier?: string;
  tracksViewChanges?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
};

export function Marker({ coordinate, onPress, draggable, onDragEnd, children }: MarkerProps) {
  const map = useContext(MapContext);
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current && typeof document !== 'undefined') {
    elRef.current = document.createElement('div');
  }

  useEffect(() => {
    if (!map || !elRef.current) return;
    let marker: LType.Marker | null = null;
    let cancelled = false;
    void (async () => {
      const L = await getLeaflet();
      if (cancelled || !elRef.current) return;
      const icon = L.divIcon({
        html: elRef.current,
        className: 'motociudad-marker',
        iconSize: [34, 40],
        iconAnchor: [17, 40],
      });
      marker = L.marker([coordinate.latitude, coordinate.longitude], {
        icon,
        draggable: !!draggable,
      }).addTo(map);
      if (onPress) marker.on('click', onPress);
      if (draggable && onDragEnd) {
        marker.on('dragend', () => {
          const ll = marker!.getLatLng();
          // Match react-native-maps' onDragEnd event shape.
          onDragEnd({ nativeEvent: { coordinate: { latitude: ll.lat, longitude: ll.lng } } });
        });
      }
    })();
    return () => {
      cancelled = true;
      if (marker) marker.remove();
    };
  }, [map, coordinate.latitude, coordinate.longitude, onPress, draggable, onDragEnd]);

  if (!elRef.current) return null;
  return createPortal(<div>{children}</div>, elRef.current);
}

// react-native-maps' default export IS MapView, with named exports exposed as properties.
type MapViewComponent = typeof MapView & {
  Marker: typeof Marker;
  PROVIDER_DEFAULT: typeof PROVIDER_DEFAULT;
  PROVIDER_GOOGLE: typeof PROVIDER_GOOGLE;
};
const MapViewWithStatics = MapView as MapViewComponent;
MapViewWithStatics.Marker = Marker;
MapViewWithStatics.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
MapViewWithStatics.PROVIDER_GOOGLE = PROVIDER_GOOGLE;

export default MapViewWithStatics;
