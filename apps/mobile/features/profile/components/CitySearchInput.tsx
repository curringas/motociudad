import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { useCitySearch } from '../hooks';
import type { CitySuggestion } from '../schemas';

type Props = {
  /** Canonical label currently stored (e.g. "Málaga, España"), or null. */
  value: string | null;
  /** Called with the picked suggestion, or null when the city is cleared. */
  onSelect: (suggestion: CitySuggestion | null) => void;
};

/**
 * Typeahead for the "Me suelo mover por…" city. Suggestions come from the
 * `city-search` Edge Function (OSM/Nominatim). Only a picked suggestion is
 * stored — free text is never persisted.
 */
export function CitySearchInput({ value, onSelect }: Props) {
  const [editing, setEditing] = useState(!value);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 350);
  const { data: results, isFetching } = useCitySearch(editing ? debounced : '');

  if (value && !editing) {
    return (
      <View>
        <Text className="text-content-muted text-xs mb-1">Me suelo mover por…</Text>
        <View className="flex-row items-center justify-between bg-surface rounded-card px-4 py-3 border border-border">
          <Text className="text-content text-base flex-1" numberOfLines={1}>
            📍 {value}
          </Text>
          <TouchableOpacity
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar ciudad"
          >
            <Text className="text-primary font-semibold text-sm ml-3">Cambiar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text className="text-content-muted text-xs mb-1">Me suelo mover por…</Text>
      <View className="flex-row items-center bg-surface rounded-card px-4 py-2 border border-border">
        <TextInput
          className="flex-1 text-content text-base"
          placeholder="Escribe tu ciudad…"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          accessibilityLabel="Buscar ciudad"
        />
        {isFetching ? <ActivityIndicator size="small" color="#FFD60A" /> : null}
      </View>

      {value ? (
        <TouchableOpacity
          onPress={() => {
            onSelect(null);
            setEditing(false);
            setQuery('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Quitar ciudad"
        >
          <Text className="text-content-muted text-xs mt-1">Quitar ciudad</Text>
        </TouchableOpacity>
      ) : null}

      {(results ?? []).map((r) => (
        <TouchableOpacity
          key={`${r.label}-${r.lat}-${r.lng}`}
          className="bg-surface-2 rounded-card px-4 py-3 mt-1"
          onPress={() => {
            onSelect(r);
            setEditing(false);
            setQuery('');
          }}
          accessibilityRole="button"
          accessibilityLabel={`Elegir ${r.label}`}
        >
          <Text className="text-content text-sm">{r.label}</Text>
        </TouchableOpacity>
      ))}

      {debounced.trim().length >= 2 && !isFetching && (results ?? []).length === 0 ? (
        <Text className="text-content-muted text-xs mt-2">
          No se encontró esa ciudad. Prueba con otra.
        </Text>
      ) : null}

      <Text className="text-content-subtle text-[10px] mt-2">
        Búsqueda de ciudades © OpenStreetMap contributors
      </Text>
    </View>
  );
}
