import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { NearbyParking } from '@/types/domain';
import { formatDistance } from '@/lib/distance';
import { openInExternalMaps } from '@/lib/deeplinks';
import { useSessionStore } from '@/stores/sessionStore';
import { useParkingDetail } from '@/features/parkings/hooks';
import { useHasVerified } from '@/features/verifications/hooks';
import { supabase } from '@/lib/supabase';

type Props = {
  parking: NearbyParking | null;
  onClose: () => void;
};

const FEATURE_LABELS: Record<string, string> = {
  covered: 'Cubierto',
  cameras: 'Cámaras',
  anchors: 'Anclajes',
  lit: 'Iluminado',
  free: 'Gratuito',
  h24: '24h',
  battery_layout: 'Batería',
};

export function ParkingBottomSheet({ parking, onClose }: Props) {
  const router = useRouter();
  const { user } = useSessionStore();

  const { data: detail } = useParkingDetail(parking?.id ?? '');
  const { data: hasVerified = false } = useHasVerified(parking?.id, user?.id);
  const isProposer = !!user && !!detail && user.id === detail.proposed_by;
  const canVerify =
    parking !== null &&
    parking.verifications_count < 3 &&
    !isProposer &&
    !hasVerified;
  const photoPath = (detail?.parking_photos as Array<{ storage_path: string }> | undefined)?.[0]?.storage_path;
  const photoUrl = photoPath
    ? supabase.storage.from('parkings-photos').getPublicUrl(photoPath).data.publicUrl
    : null;

  const handleNavigate = useCallback(async () => {
    if (!parking) return;
    await openInExternalMaps(parking.lat, parking.lng, parking.name);
  }, [parking]);

  const handleDetails = useCallback(() => {
    if (!parking) return;
    onClose();
    router.push(`/parking/${parking.id}`);
  }, [parking, router, onClose]);

  const handleVerifyPress = useCallback(() => {
    if (!parking) return;
    onClose();
    if (!user) {
      router.push({ pathname: '/login', params: { redirect: `/verify/${parking.id}` } });
    } else {
      router.push(`/verify/${parking.id}`);
    }
  }, [parking, user, router, onClose]);

  const activeFeatures = parking
    ? Object.entries(parking.features)
        .filter(([, active]) => active)
        .map(([key]) => key)
    : [];

  return (
    <Modal
      visible={parking !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 40, maxHeight: '75%' }}>
              {/* Handle */}
              <View style={{ width: 40, height: 4, backgroundColor: '#475569', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />

              {parking && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: 'bold' }} numberOfLines={2}>
                        {parking.name}
                      </Text>
                      <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 2 }}>
                        {parking.city} · {formatDistance(parking.distance_meters)}
                      </Text>
                    </View>
                    {parking.status === 'verified' ? (
                      <View style={{ backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>✓ {parking.verifications_count}</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: 'rgba(251,191,36,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '600' }}>Pendiente</Text>
                      </View>
                    )}
                  </View>

                  {/* Pending banner */}
                  {parking.status !== 'verified' && (
                    <View style={{ backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: '#fbbf24', borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: '#fbbf24', fontSize: 13 }}>!</Text>
                      <Text style={{ color: '#fbbf24', fontSize: 12, flex: 1 }}>
                        Aún no verificado por la comunidad
                      </Text>
                    </View>
                  )}

                  {/* Photo */}
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={{ height: 140, borderRadius: 12, marginBottom: 12 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ height: 140, borderRadius: 12, backgroundColor: '#334155', marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#475569', fontSize: 14 }}>Sin foto</Text>
                    </View>
                  )}

                  {/* Capacity */}
                  {parking.capacity !== null && (
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
                      Capacidad: {parking.capacity} motos
                    </Text>
                  )}

                  {/* Feature chips */}
                  {activeFeatures.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {activeFeatures.map((feature) => (
                        <View key={feature} style={{ backgroundColor: '#334155', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginRight: 8 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                            {FEATURE_LABELS[feature] ?? feature}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#FFD60A', borderRadius: 999, paddingVertical: 12, alignItems: 'center' }}
                      onPress={handleNavigate}
                    >
                      <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>Llévame</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingVertical: 12, alignItems: 'center' }}
                      onPress={handleDetails}
                    >
                      <Text style={{ color: '#f8fafc', fontWeight: '600' }}>Detalles</Text>
                    </TouchableOpacity>
                  </View>
                  {canVerify && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#FFD60A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 8 }}
                      onPress={handleVerifyPress}
                    >
                      <Text style={{ color: '#FFD60A', fontWeight: 'bold', fontSize: 14 }}>
                        Confirma que existe y gana Octanos
                      </Text>
                      <Text style={{ color: 'rgba(255,214,10,0.6)', fontSize: 11, marginTop: 2 }}>
                        ¿Está bien ubicado? ¿Existe el parking?
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
