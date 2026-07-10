import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Shown on the map when no parking spots are found nearby.
 * Prompts the user to contribute a new spot.
 */
export function EmptyMapState() {
  const router = useRouter();

  return (
    <View className="absolute bottom-32 left-4 right-4 bg-surface rounded-card p-4 shadow-lg border border-border">
      <Text className="text-content text-base font-semibold text-center">
        No hay parkings cerca
      </Text>
      <Text className="text-content-muted text-sm text-center mt-1">
        ¿Conoces algún sitio donde aparcar la moto?
      </Text>
      <TouchableOpacity
        className="mt-3 bg-primary rounded-pill py-2 px-6 items-center"
        onPress={() => router.push('/(tabs)/contribute')}
        accessibilityRole="button"
        accessibilityLabel="Aportar un parking"
      >
        <Text className="text-background font-bold text-sm">
          Aportar un parking
        </Text>
      </TouchableOpacity>
    </View>
  );
}
