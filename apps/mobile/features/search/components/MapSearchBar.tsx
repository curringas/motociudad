import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGeocodeSearch } from '../hooks';
import type { GeocodeResult } from '../api';

type Props = {
  onLocationFound: (coords: GeocodeResult) => void;
};

/**
 * Search bar pinned to the top of the map. Geocodes the typed address and,
 * on a hit, hands the coordinates up to the map screen (which recenters).
 * Shows a spinner while searching and an inline message when nothing matches.
 */
export function MapSearchBar({ onLocationFound }: Props) {
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState(false);
  const geocode = useGeocodeSearch();

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setNotFound(false);
    geocode.mutate(trimmed, {
      onSuccess: (result) => {
        if (result) onLocationFound(result);
        else setNotFound(true);
      },
      onError: () => setNotFound(true),
    });
  }, [query, geocode, onLocationFound]);

  const handleClear = useCallback(() => {
    setQuery('');
    setNotFound(false);
  }, []);

  return (
    <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 z-20">
      <View className="mx-4 mt-2">
        <View className="flex-row items-center bg-surface rounded-pill px-4 py-2 border border-border shadow-lg">
          <Text className="text-content-muted text-base mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-content text-base"
            placeholder="Busca una calle o ciudad…"
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar ubicación"
          />
          {geocode.isPending ? (
            <ActivityIndicator size="small" color="#FFD60A" />
          ) : query.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
            >
              <Text className="text-content-muted text-base ml-2">✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {notFound && (
          <View className="mx-1 mt-1 bg-surface/90 rounded-card px-3 py-2">
            <Text className="text-content-muted text-xs">
              No se encontró esa ubicación. Prueba con otra calle o ciudad.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
