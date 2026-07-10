import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useOctanosSummary } from '../hooks';
import { toOctanosView } from '../presenter';

/**
 * Card showing the user's level, confirmed and pending Octanos.
 * Reads via useOctanosSummary; renders loading and error states.
 */
export function OctanosSummary({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useOctanosSummary(userId);

  if (isLoading) {
    return (
      <View
        className="bg-surface rounded-card p-5 items-center mb-6"
        accessibilityLabel="Cargando Octanos"
      >
        <ActivityIndicator color="#FFD60A" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="bg-surface rounded-card p-5 mb-6">
        <Text className="text-content-muted text-center">
          No se pudieron cargar tus Octanos
        </Text>
      </View>
    );
  }

  const view = toOctanosView(data);

  return (
    <View className="bg-surface rounded-card p-5 mb-6">
      <Text className="text-content-muted text-sm uppercase tracking-wide">
        {view.levelLabel}
      </Text>
      <Text className="text-content text-2xl font-bold mb-3">{view.levelName}</Text>

      <View className="h-2 rounded-pill bg-background overflow-hidden mb-1">
        <View
          className="h-2 rounded-pill bg-primary"
          style={{ width: `${view.progressPct}%` }}
        />
      </View>
      <Text className="text-content-subtle text-sm mb-5">{view.progressLabel}</Text>

      <View className="flex-row justify-around">
        <View className="items-center">
          <Text
            className="text-primary text-2xl font-bold"
            accessibilityLabel={`${view.confirmed} Octanos conseguidos`}
          >
            {view.confirmed}
          </Text>
          <Text className="text-content-muted text-sm mt-1">⚡ Conseguidos</Text>
        </View>
        <View className="items-center">
          <Text
            className="text-pending text-2xl font-bold"
            accessibilityLabel={`${view.pending} Octanos pendientes`}
          >
            {view.pending}
          </Text>
          <Text className="text-content-muted text-sm mt-1">⏳ Pendientes</Text>
        </View>
      </View>

      {view.showPendingNote && (
        <Text className="text-content-subtle text-sm text-center mt-4">
          Se confirmarán cuando otro usuario valide tus aportaciones.
        </Text>
      )}
    </View>
  );
}
