import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { useNickAvailability, useUpdateProfile } from '../hooks';
import { nickSchema, type CitySuggestion } from '../schemas';
import { CitySearchInput } from './CitySearchInput';

type Props = {
  userId: string;
  email: string | null;
  initialNick: string;
  initialCity: string | null;
  onSaved: () => void;
};

/** Form to edit the public identity: read-only email + editable nick + city. */
export function EditProfileForm({
  userId,
  email,
  initialNick,
  initialCity,
  onSaved,
}: Props) {
  const [nick, setNick] = useState(initialNick);
  const [city, setCity] = useState<string | null>(initialCity);

  const parsed = nickSchema.safeParse(nick);
  const isValidFormat = parsed.success;
  const formatError = !isValidFormat && nick.length > 0
    ? parsed.error.issues[0]?.message ?? null
    : null;

  const debouncedNick = useDebounce(nick.trim(), 400);
  const nickChanged = debouncedNick.toLowerCase() !== initialNick.toLowerCase();
  const availability = useNickAvailability(
    debouncedNick,
    userId,
    isValidFormat && nickChanged,
  );
  const taken = nickChanged && availability.data === false;

  const update = useUpdateProfile(userId);
  const canSave = isValidFormat && !taken && !update.isPending;

  const handleSave = () => {
    if (!canSave) return;
    update.mutate({ nick: nick.trim(), city }, { onSuccess: onSaved });
  };

  return (
    <View className="gap-4">
      {/* Email — solo lectura */}
      <View>
        <Text className="text-content-muted text-xs mb-1">Email (no editable)</Text>
        <View className="bg-surface-2 rounded-card px-4 py-3 border border-border">
          <Text className="text-content-muted text-base" numberOfLines={1}>
            {email ?? '—'}
          </Text>
        </View>
      </View>

      {/* Nick */}
      <View>
        <Text className="text-content-muted text-xs mb-1">Nombre de usuario</Text>
        <View className="flex-row items-center bg-surface rounded-card px-4 py-2 border border-border">
          <Text className="text-content-muted text-base mr-1">@</Text>
          <TextInput
            className="flex-1 text-content text-base"
            value={nick}
            onChangeText={setNick}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            placeholder="tunick"
            placeholderTextColor="#94a3b8"
            accessibilityLabel="Nombre de usuario"
          />
          {availability.isFetching ? (
            <ActivityIndicator size="small" color="#FFD60A" />
          ) : null}
        </View>
        {formatError ? (
          <Text className="text-rejected text-xs mt-1">{formatError}</Text>
        ) : taken ? (
          <Text className="text-rejected text-xs mt-1">Ese nick ya está en uso.</Text>
        ) : isValidFormat && nickChanged && availability.data === true ? (
          <Text className="text-verified text-xs mt-1">✓ Disponible</Text>
        ) : (
          <Text className="text-content-muted text-xs mt-1">
            Así te verán en el ranking y en los comentarios.
          </Text>
        )}
      </View>

      {/* Ciudad */}
      <CitySearchField value={city} onChange={setCity} />

      {update.isError ? (
        <Text className="text-rejected text-sm">
          {(update.error as Error)?.message ?? 'No se pudo guardar.'}
        </Text>
      ) : null}

      <TouchableOpacity
        className={`rounded-pill py-3 items-center ${canSave ? 'bg-primary' : 'bg-surface-2'}`}
        onPress={handleSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel="Guardar perfil"
      >
        {update.isPending ? (
          <ActivityIndicator size="small" color="#0f172a" />
        ) : (
          <Text className={`font-bold text-base ${canSave ? 'text-background' : 'text-content-muted'}`}>
            Guardar
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function CitySearchField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (label: string | null) => void;
}) {
  return (
    <CitySearchInput
      value={value}
      onSelect={(s: CitySuggestion | null) => onChange(s ? s.label : null)}
    />
  );
}
