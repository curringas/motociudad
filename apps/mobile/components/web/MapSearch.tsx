// Web-only location search over the map, using OpenStreetMap's Nominatim geocoder
// (keyless). Debounced to respect Nominatim usage policy. On selection, reports the
// coordinates so the map can fly there (which reloads nearby parkings).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type GeocodeResult = { lat: number; lng: number; label: string };

type NominatimItem = { lat: string; lon: string; display_name: string; place_id: number };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 600;

async function geocode(query: string, signal: AbortSignal): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM_URL}?format=json&limit=5&accept-language=es&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimItem[];
  return data.map((d) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    label: d.display_name,
  }));
}

export function MapSearch({ onSelect }: { onSelect: (r: GeocodeResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const r = await geocode(q, controller.signal);
        setResults(r);
        setOpen(true);
      } catch {
        // aborted or network error — ignore
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const handleSelect = useCallback(
    (r: GeocodeResult) => {
      setQuery(r.label.split(',')[0] ?? r.label);
      setOpen(false);
      setResults([]);
      onSelect(r);
    },
    [onSelect],
  );

  return (
    <View
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        width: 340,
        maxWidth: '90%',
        zIndex: 1000,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#0f172a',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#334155',
          paddingHorizontal: 12,
          height: 44,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Buscar calle, ciudad…"
          placeholderTextColor="#64748b"
          style={{ flex: 1, color: '#f8fafc', fontSize: 14, outlineStyle: 'none' } as object}
          returnKeyType="search"
        />
        {loading ? <ActivityIndicator size="small" color="#FFD60A" /> : null}
        {query.length > 0 && !loading ? (
          <Pressable onPress={() => { setQuery(''); setResults([]); setOpen(false); }} accessibilityLabel="Limpiar búsqueda">
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </Pressable>
        ) : null}
      </View>

      {open && results.length > 0 ? (
        <View
          style={{
            marginTop: 6,
            backgroundColor: '#0f172a',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#334155',
            overflow: 'hidden',
          }}
        >
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.lat},${item.lng}`}
            style={{ maxHeight: 260 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                accessibilityRole="button"
                style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}
              >
                <Text style={{ color: '#e2e8f0', fontSize: 13 }} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}
