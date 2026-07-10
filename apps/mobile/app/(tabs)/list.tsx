import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useNearbyParkings } from '@/features/parkings/hooks';
import { formatDistance } from '@/lib/distance';
import type { NearbyParking } from '@/types/domain';

function ParkingListItem({ parking }: { parking: NearbyParking }) {
  const router = useRouter();

  return (
    <TouchableOpacity
      className="bg-surface rounded-card p-4 mb-3 border border-border"
      onPress={() => router.push(`/parking/${parking.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${parking.name}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-content font-semibold text-base" numberOfLines={1}>
            {parking.name}
          </Text>
          <Text className="text-content-muted text-sm mt-0.5">
            {parking.city} · {formatDistance(parking.distance_meters)}
          </Text>
        </View>

        {parking.status === 'verified' ? (
          <View className="bg-verified/20 rounded-pill px-2 py-1">
            <Text className="text-verified text-xs font-semibold">
              ✓ {parking.verifications_count}
            </Text>
          </View>
        ) : (
          <View className="bg-pending/20 rounded-pill px-2 py-1">
            <Text className="text-pending text-xs font-semibold">Pendiente</Text>
          </View>
        )}
      </View>

      {parking.capacity !== null && (
        <Text className="text-content-subtle text-xs mt-2">
          Capacidad: {parking.capacity} motos
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ListScreen() {
  const { location } = useUserLocation();
  const center = location
    ? { lat: location.latitude, lng: location.longitude }
    : null;

  const { data: parkings = [], isLoading, refetch, isRefetching } =
    useNearbyParkings(center, 5000);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-4">
        <Text className="text-content text-lg font-bold mb-4">
          Parkings cercanos
        </Text>

        {isLoading && (
          <Text className="text-content-muted text-center mt-8">Cargando…</Text>
        )}

        {!isLoading && parkings.length === 0 && (
          <Text className="text-content-muted text-center mt-8">
            No hay parkings en un radio de 5 km
          </Text>
        )}

        <FlatList
          data={parkings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ParkingListItem parking={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor="#FFD60A"
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}
