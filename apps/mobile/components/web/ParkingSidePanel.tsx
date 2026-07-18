// Desktop/tablet right contextual panel (web-only): list of nearby parkings and,
// when one is selected, its detail with actions. Reuses the same hooks/helpers as
// the mobile bottom sheet (useParkingDetail, formatDistance, openInExternalMaps).
import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { NearbyParking } from '@/types/domain';
import { formatDistance } from '@/lib/distance';
import { openInExternalMaps } from '@/lib/deeplinks';
import { useParkingDetail } from '@/features/parkings/hooks';
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

type Props = {
  parkings: NearbyParking[];
  selected: NearbyParking | null;
  onSelect: (p: NearbyParking) => void;
  onClearSelection: () => void;
};

export function ParkingSidePanel({ parkings, selected, onSelect, onClearSelection }: Props) {
  return (
    <View
      style={{
        width: 380,
        backgroundColor: '#0b1220',
        borderLeftWidth: 1,
        borderLeftColor: '#1e293b',
      }}
    >
      {selected ? (
        <ParkingDetail parking={selected} onBack={onClearSelection} />
      ) : (
        <ParkingList parkings={parkings} onSelect={onSelect} />
      )}
    </View>
  );
}

function ParkingList({
  parkings,
  onSelect,
}: {
  parkings: NearbyParking[];
  onSelect: (p: NearbyParking) => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>
        Parkings cercanos ({parkings.length})
      </Text>
      {parkings.length === 0 ? (
        <Text style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
          Mueve el mapa para buscar parkings en la zona.
        </Text>
      ) : null}
      {parkings.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onSelect(p)}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}, ${formatDistance(p.distance_meters)}`}
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: '#111827',
            borderWidth: 1,
            borderColor: '#1e293b',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: p.type === 'public' ? '#FFD60A' : '#64748b',
              }}
            />
            <Text style={{ color: '#f8fafc', fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {p.name}
            </Text>
          </View>
          <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            {formatDistance(p.distance_meters)} · {p.type === 'public' ? 'Público' : 'Privado'}
            {p.status === 'pending' ? ' · Pendiente' : ''}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ParkingDetail({ parking, onBack }: { parking: NearbyParking; onBack: () => void }) {
  const router = useRouter();
  const { data: detail } = useParkingDetail(parking.id);

  const photoPath = (
    detail?.parking_photos as Array<{ storage_path: string }> | undefined
  )?.[0]?.storage_path;
  const photoUrl = photoPath
    ? supabase.storage.from('parkings-photos').getPublicUrl(photoPath).data.publicUrl
    : null;

  const handleDirections = useCallback(() => {
    void openInExternalMaps(parking.lat, parking.lng, parking.name);
  }, [parking]);

  const activeFeatures = Object.entries(parking.features ?? {})
    .filter(([, v]) => v)
    .map(([k]) => FEATURE_LABELS[k] ?? k);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Volver a la lista"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Ionicons name="chevron-back" size={18} color="#94a3b8" />
        <Text style={{ color: '#94a3b8', fontSize: 13 }}>Volver</Text>
      </Pressable>

      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: '#1e293b' }}
          resizeMode="cover"
        />
      ) : null}

      <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '800' }}>{parking.name}</Text>
      <Text style={{ color: '#94a3b8', fontSize: 13 }}>
        {formatDistance(parking.distance_meters)} · {parking.type === 'public' ? 'Público' : 'Privado'}
        {parking.city ? ` · ${parking.city}` : ''}
      </Text>

      {activeFeatures.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {activeFeatures.map((f) => (
            <View
              key={f}
              style={{ backgroundColor: '#1e293b', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
            >
              <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{f}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ color: '#64748b', fontSize: 12 }}>
        {parking.verifications_count} verificacion{parking.verifications_count === 1 ? '' : 'es'}
      </Text>

      <Pressable
        onPress={handleDirections}
        style={{ backgroundColor: '#FFD60A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={{ color: '#0f172a', fontWeight: '800' }}>Cómo llegar</Text>
      </Pressable>

      {/* Verification is a location-based action: it requires being physically at the
          parking with GPS. That can't be done from a desktop browser, so we surface a
          hint instead of the verify button (mobile keeps the button in the bottom sheet). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#111827',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#1e293b',
          padding: 12,
        }}
      >
        <Ionicons name="phone-portrait-outline" size={18} color="#64748b" />
        <Text style={{ color: '#94a3b8', fontSize: 12, flex: 1 }}>
          Para verificar este parking, ábrelo en la app móvil estando en el lugar (usa tu ubicación).
        </Text>
      </View>

      <Pressable
        onPress={() => router.push(`/parking/${parking.id}`)}
        style={{ paddingVertical: 8, alignItems: 'center' }}
      >
        <Text style={{ color: '#94a3b8', fontSize: 13 }}>Ver ficha completa</Text>
      </Pressable>
    </ScrollView>
  );
}
