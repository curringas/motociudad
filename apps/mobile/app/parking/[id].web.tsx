// Web-only full parking detail. Reuses the same data hook as the native screen
// (useParkingDetail) but omits the verify CTA: verification is a GPS/on-site action
// that isn't trustworthy from a browser (photo would be a file upload). A hint points
// users to the mobile app instead. Centered column on desktop, full-bleed on mobile.
import React, { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useParkingDetail } from '@/features/parkings/hooks';
import { CommentsSection } from '@/features/comments/components/CommentsSection';
import { openInExternalMaps } from '@/lib/deeplinks';
import { supabase } from '@/lib/supabase';
import { useBreakpoint } from '@/lib/responsive';

const FEATURE_LABELS: Record<string, string> = {
  covered: 'Cubierto',
  cameras: 'Cámaras',
  anchors: 'Anclajes',
  lit: 'Iluminado',
  free: 'Gratuito',
  h24: '24h',
  battery_layout: 'Batería',
};

export default function ParkingDetailScreenWeb() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const bp = useBreakpoint();
  const { data: parking, isLoading, error } = useParkingDetail(id ?? '');

  const handleNavigate = useCallback(() => {
    if (!parking) return;
    void openInExternalMaps(parking.lat, parking.lng, parking.name ?? null);
  }, [parking]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FFD60A" />
      </View>
    );
  }

  if (error || !parking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#f8fafc', fontWeight: '600', marginBottom: 12 }}>
          No se pudo cargar el parking
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#FFD60A' }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const isVerified = parking.status === 'verified';
  const features = (parking.features ?? {}) as Record<string, boolean>;
  const activeFeatures = Object.entries(features)
    .filter(([, v]) => v)
    .map(([k]) => FEATURE_LABELS[k] ?? k);

  const photoPath = (parking.parking_photos as Array<{ storage_path: string }> | undefined)?.[0]?.storage_path;
  const photoUrl = photoPath
    ? supabase.storage.from('parkings-photos').getPublicUrl(photoPath).data.publicUrl
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      contentContainerStyle={{ alignItems: 'center', paddingVertical: bp === 'mobile' ? 0 : 24 }}
    >
      <View style={{ width: '100%', maxWidth: 720, paddingHorizontal: 16, gap: 16 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12 }}
        >
          <Ionicons name="chevron-back" size={18} color="#94a3b8" />
          <Text style={{ color: '#94a3b8', fontSize: 13 }}>Volver</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: '#f8fafc', fontSize: 24, fontWeight: '800', flex: 1 }}>{parking.name}</Text>
          {isVerified ? (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>Verificado</Text>
            </View>
          ) : null}
        </View>

        {!isVerified ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: 'rgba(234,179,8,0.12)', borderWidth: 1, borderColor: '#eab308',
              borderRadius: 12, padding: 12,
            }}
          >
            <Text style={{ color: '#eab308', fontSize: 13, fontWeight: '600', flex: 1 }}>
              Pendiente de confirmación — aún no verificado por la comunidad
            </Text>
          </View>
        ) : null}

        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 240, borderRadius: 12, backgroundColor: '#1e293b' }} resizeMode="cover" />
        ) : (
          <View style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 13 }}>Sin foto disponible</Text>
          </View>
        )}

        <View style={{ backgroundColor: '#111827', borderRadius: 12, padding: 16, gap: 4 }}>
          <InfoRow label="Ciudad" value={parking.city ?? ''} />
          <InfoRow label="Tipo" value={parking.type === 'public' ? 'Público' : 'Privado'} />
          {parking.capacity != null ? <InfoRow label="Capacidad" value={`${parking.capacity} motos`} /> : null}
          <InfoRow
            label="Estado"
            value={parking.status === 'verified' ? 'Verificado' : parking.status === 'pending' ? 'Pendiente' : (parking.status ?? '')}
          />
        </View>

        {activeFeatures.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
              Características
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {activeFeatures.map((f) => (
                <View key={f} style={{ backgroundColor: '#1e293b', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: '#cbd5e1', fontSize: 13 }}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {parking.notes ? (
          <View style={{ backgroundColor: '#111827', borderRadius: 12, padding: 16 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Notas</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 14 }}>{parking.notes}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleNavigate}
          accessibilityRole="button"
          accessibilityLabel="Cómo llegar"
          style={{ backgroundColor: '#FFD60A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#0f172a', fontWeight: '800' }}>Cómo llegar</Text>
        </Pressable>

        {/* Verification is mobile-only (on-site GPS + fresh photo) — see verify/[parkingId].web.tsx. */}
        {!isVerified ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b',
              padding: 12, marginBottom: 24,
            }}
          >
            <Ionicons name="phone-portrait-outline" size={18} color="#64748b" />
            <Text style={{ color: '#94a3b8', fontSize: 12, flex: 1 }}>
              La verificación se hace desde la app móvil, estando en el parking (usa tu ubicación).
            </Text>
          </View>
        ) : null}

        {/* Comentarios (funciona igual en web y móvil, no requiere ubicación) */}
        <CommentsSection parkingId={id ?? ''} />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: '#94a3b8', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: '#f8fafc', fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
