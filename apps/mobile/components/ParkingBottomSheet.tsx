import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

const SPRING = { damping: 22, stiffness: 220 } as const;

/**
 * Draggable bottom sheet for a selected parking, built on gesture-handler +
 * reanimated (gorhom's gestures don't work under reanimated 4 / new arch here).
 * - Opens collapsed; drag the handle up to see the full detail.
 * - Drag the handle down (or tap the dimmed map) to close — the map stays put.
 */
export function ParkingBottomSheet({ parking, onClose }: Props) {
  const router = useRouter();
  const { user } = useSessionStore();
  const { height: screenH } = useWindowDimensions();

  const SHEET_H = Math.round(screenH * 0.9);
  const COLLAPSED_VISIBLE = Math.round(SHEET_H * 0.62);
  // translateY: 0 = fully expanded, COLLAPSED_Y = collapsed, SHEET_H = closed.
  const COLLAPSED_Y = SHEET_H - COLLAPSED_VISIBLE;

  const translateY = useSharedValue(SHEET_H);

  const close = useCallback(() => onClose(), [onClose]);

  // Animate open/closed when the selection changes.
  useEffect(() => {
    translateY.value = parking
      ? withSpring(COLLAPSED_Y, SPRING)
      : withTiming(SHEET_H, { duration: 220 });
  }, [parking, COLLAPSED_Y, SHEET_H, translateY]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      translateY.value = Math.max(0, Math.min(SHEET_H, translateY.value + e.changeY));
    })
    .onEnd((e) => {
      const y = translateY.value;
      if (y > COLLAPSED_Y + 90 || e.velocityY > 900) {
        // Dragged down → close.
        translateY.value = withTiming(SHEET_H, { duration: 200 }, (done) => {
          if (done) runOnJS(close)();
        });
      } else if (y < COLLAPSED_Y - 60 || e.velocityY < -700) {
        // Dragged up → expand.
        translateY.value = withSpring(0, SPRING);
      } else {
        translateY.value = withSpring(COLLAPSED_Y, SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SHEET_H], [0.5, 0], Extrapolation.CLAMP),
  }));

  const { data: detail } = useParkingDetail(parking?.id ?? '');
  const { data: hasVerified = false } = useHasVerified(parking?.id, user?.id);
  const isProposer = !!user && !!detail && user.id === detail.proposed_by;
  const canVerify =
    parking !== null &&
    parking.verifications_count < 3 &&
    !isProposer &&
    !hasVerified;
  const photoPath = (detail?.parking_photos as Array<{ storage_path: string }> | undefined)?.[0]
    ?.storage_path;
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
    <View
      pointerEvents={parking ? 'auto' : 'none'}
      style={StyleSheet.absoluteFill}
    >
      {/* Dimmed backdrop — tap to close (the map stays where it was). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar detalle">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
        />
      </Pressable>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: SHEET_H,
            backgroundColor: '#1e293b',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
          sheetStyle,
        ]}
      >
        {/* Draggable header (handle + title). Content below scrolls independently. */}
        <GestureDetector gesture={pan}>
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
            <View
              style={{
                width: 44,
                height: 4,
                backgroundColor: '#475569',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />
            {parking && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text
                    style={{ color: '#f8fafc', fontSize: 18, fontWeight: 'bold' }}
                    numberOfLines={2}
                  >
                    {parking.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 2 }}>
                    {parking.city} · {formatDistance(parking.distance_meters)}
                  </Text>
                </View>
                {parking.status === 'verified' ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(34,197,94,0.2)',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>
                      ✓ {parking.verifications_count}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: 'rgba(251,191,36,0.2)',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '600' }}>
                      Pendiente
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </GestureDetector>

        {parking && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Pending banner */}
            {parking.status !== 'verified' && (
              <View
                style={{
                  backgroundColor: 'rgba(251,191,36,0.1)',
                  borderWidth: 1,
                  borderColor: '#fbbf24',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 12,
                  marginTop: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
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
                style={{ height: 140, borderRadius: 12, marginTop: 8, marginBottom: 12 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  height: 140,
                  borderRadius: 12,
                  backgroundColor: '#334155',
                  marginTop: 8,
                  marginBottom: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {activeFeatures.map((feature) => (
                  <View
                    key={feature}
                    style={{
                      backgroundColor: '#334155',
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      marginRight: 8,
                    }}
                  >
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
                style={{
                  flex: 1,
                  backgroundColor: '#FFD60A',
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={handleNavigate}
                accessibilityRole="button"
                accessibilityLabel="Llévame a este parking"
              >
                <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>Llévame</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#334155',
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={handleDetails}
                accessibilityRole="button"
                accessibilityLabel="Ver ficha completa y comentarios"
              >
                <Text style={{ color: '#f8fafc', fontWeight: '600' }}>Detalles</Text>
              </TouchableOpacity>
            </View>
            {canVerify && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#1e293b',
                  borderWidth: 1,
                  borderColor: '#FFD60A',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  marginTop: 8,
                }}
                onPress={handleVerifyPress}
                accessibilityRole="button"
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
      </Animated.View>
    </View>
  );
}
