import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useParkingDetail } from '@/features/parkings/hooks';
import { useSessionStore } from '@/stores/sessionStore';
import { openInExternalMaps } from '@/lib/deeplinks';
import { supabase } from '@/lib/supabase';

const FEATURE_LABELS: Record<string, string> = {
  covered: 'Cubierto',
  cameras: 'Cámaras',
  anchors: 'Anclajes',
  lit: 'Iluminado',
  free: 'Gratuito',
  h24: '24h',
  battery_layout: 'Batería',
};

export default function ParkingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSessionStore();

  const { data: parking, isLoading, error } = useParkingDetail(id ?? '');

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-content-muted">Parking no encontrado</Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FFD60A" />
      </SafeAreaView>
    );
  }

  if (error || !parking) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center p-6">
        <Text className="text-content text-base font-semibold text-center">
          No se pudo cargar el parking
        </Text>
        <TouchableOpacity
          className="mt-4"
          onPress={() => router.back()}
        >
          <Text className="text-primary">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isProposer = user?.id === parking.proposed_by;
  const isVerified = parking.status === 'verified';
  const showVerifyCta = !isVerified && !isProposer;

  const features = (parking.features ?? {}) as Record<string, boolean>;
  const activeFeatures = Object.entries(features)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const handleNavigate = async () => {
    await openInExternalMaps(parking.lat, parking.lng, parking.name ?? null);
  };

  const handleVerifyPress = () => {
    if (!user) {
      router.push({ pathname: '/login', params: { redirect: `/verify/${id}` } });
    } else {
      router.push(`/verify/${id}`);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View className="flex-row items-start justify-between mb-4">
          <Text className="text-content text-2xl font-bold flex-1 mr-3">
            {parking.name}
          </Text>
          {isVerified && (
            <View className="bg-verified/20 rounded-pill px-3 py-1.5 mt-1">
              <Text className="text-verified text-xs font-bold">Verificado</Text>
            </View>
          )}
        </View>

        {/* Pending banner */}
        {!isVerified && (
          <View className="bg-pending/15 border border-pending rounded-card p-3 mb-4 flex-row items-center gap-3">
            <View className="bg-pending rounded-full w-6 h-6 items-center justify-center shrink-0">
              <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: 'bold' }}>!</Text>
            </View>
            <Text className="text-pending text-sm flex-1 font-medium">
              Pendiente de confirmación — aún no verificado por la comunidad
            </Text>
          </View>
        )}

        {/* Photo */}
        {parking.parking_photos && parking.parking_photos.length > 0 ? (
          <Image
            source={{
              uri: supabase.storage.from('parkings-photos').getPublicUrl((parking.parking_photos[0] as { storage_path: string }).storage_path).data.publicUrl,
            }}
            className="h-48 rounded-card mb-4"
            resizeMode="cover"
          />
        ) : (
          <View className="h-48 rounded-card bg-surface-2 mb-4 items-center justify-center">
            <Text className="text-content-subtle text-sm">Sin foto disponible</Text>
          </View>
        )}

        {/* Info grid */}
        <View className="bg-surface rounded-card p-4 mb-4">
          <InfoRow label="Ciudad" value={parking.city ?? ''} />
          <InfoRow
            label="Tipo"
            value={parking.type === 'public' ? 'Público' : 'Privado'}
          />
          {parking.capacity !== null && (
            <InfoRow label="Capacidad" value={`${parking.capacity} motos`} />
          )}
          <InfoRow
            label="Estado"
            value={
              parking.status === 'verified'
                ? 'Verificado'
                : parking.status === 'pending'
                ? 'Pendiente'
                : (parking.status ?? '')
            }
          />
        </View>

        {/* Features */}
        {activeFeatures.length > 0 && (
          <View className="mb-4">
            <Text className="text-content-muted text-sm mb-2 font-semibold uppercase tracking-wider">
              Características
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {activeFeatures.map((feature) => (
                <View
                  key={feature}
                  className="bg-surface rounded-pill px-3 py-1.5 border border-border"
                >
                  <Text className="text-content-muted text-sm">
                    {FEATURE_LABELS[feature] ?? feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {parking.notes && (
          <View className="bg-surface rounded-card p-4 mb-4">
            <Text className="text-content-muted text-sm mb-1 font-semibold">
              Notas
            </Text>
            <Text className="text-content text-sm">{parking.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View className="p-4 border-t border-border gap-3">
        <TouchableOpacity
          className="bg-primary rounded-pill py-3.5 items-center"
          onPress={handleNavigate}
          accessibilityRole="button"
          accessibilityLabel="Llévame a este parking"
        >
          <Text className="text-background font-bold">Llévame</Text>
        </TouchableOpacity>

        {showVerifyCta && (
          <TouchableOpacity
            className="bg-surface border border-primary rounded-card p-4 items-center"
            onPress={handleVerifyPress}
            accessibilityRole="button"
            accessibilityLabel="Confirmar o desmentir este parking"
          >
            <Text className="text-primary font-bold text-base">
              Confirma que existe y gana Octanos
            </Text>
            <Text className="text-primary/70 text-xs mt-1">
              ¿Está bien ubicado? ¿Existe el parking?
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border/50 last:border-b-0">
      <Text className="text-content-muted text-sm">{label}</Text>
      <Text className="text-content text-sm font-medium">{value}</Text>
    </View>
  );
}
