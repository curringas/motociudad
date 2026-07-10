import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSubmitVerification, useUploadVerificationPhoto } from '@/features/verifications/hooks';
import { VERIFICATION_ERROR_CODES } from '@/features/verifications/api';

const GPS_ACCURACY_THRESHOLD_M = 50;

const ERROR_MESSAGES: Record<string, string> = {
  [VERIFICATION_ERROR_CODES.GEOFENCE_FAIL]:
    'Estás demasiado lejos del parking. Acércate más e inténtalo de nuevo.',
  [VERIFICATION_ERROR_CODES.STALE_PHOTO]:
    'La foto ha caducado, toma una nueva.',
  [VERIFICATION_ERROR_CODES.SELF_VERIFICATION_FORBIDDEN]:
    'No puedes verificar tu propio parking.',
  [VERIFICATION_ERROR_CODES.ALREADY_VERIFIED]:
    'Ya has verificado este parking anteriormente.',
  [VERIFICATION_ERROR_CODES.DAILY_CAP_REACHED]:
    'Has alcanzado el límite diario de Octanos. Vuelve mañana.',
  [VERIFICATION_ERROR_CODES.UNAUTHENTICATED]:
    'Debes iniciar sesión para verificar un parking.',
};

type VerifyState =
  | { phase: 'camera' }
  | { phase: 'preview'; photoUri: string; takenAt: string }
  | { phase: 'submitting' }
  | { phase: 'success'; octanos: number; isFirstVerifier: boolean }
  | { phase: 'error'; message: string };

export default function VerifyScreen() {
  const { parkingId } = useLocalSearchParams<{ parkingId: string }>();
  const router = useRouter();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [state, setState] = useState<VerifyState>({ phase: 'camera' });

  const cameraRef = useRef<CameraView>(null);
  const submitMutation = useSubmitVerification();
  const uploadMutation = useUploadVerificationPhoto();

  const isLowAccuracy =
    gpsAccuracy !== null && gpsAccuracy > GPS_ACCURACY_THRESHOLD_M;

  const refreshGpsAccuracy = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGpsAccuracy(pos.coords.accuracy);
    } catch {
      setGpsAccuracy(null);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    if (isLowAccuracy) {
      Alert.alert(
        'GPS poco preciso',
        `La precisión GPS actual es ${Math.round(gpsAccuracy ?? 0)} m. Espera a que mejore a menos de ${GPS_ACCURACY_THRESHOLD_M} m.`,
      );
      return;
    }

    const takenAt = new Date().toISOString();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error('No photo URI');

      // Strip EXIF metadata to protect user privacy
      const stripped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      setState({ phase: 'preview', photoUri: stripped.uri, takenAt });
    } catch {
      Alert.alert('Error', 'No se pudo tomar la foto. Inténtalo de nuevo.');
    }
  }, [isLowAccuracy, gpsAccuracy]);

  const handleSubmit = useCallback(async () => {
    if (state.phase !== 'preview') return;
    if (!parkingId) return;

    setState({ phase: 'submitting' });

    try {
      // Get current GPS position for the verification
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Upload the photo to Storage
      const storagePath = await uploadMutation.mutateAsync({
        parkingId,
        fileUri: state.photoUri,
        takenAt: state.takenAt,
      });

      // Call the Edge Function
      const result = await submitMutation.mutateAsync({
        parking_id: parkingId,
        user_lat: pos.coords.latitude,
        user_lng: pos.coords.longitude,
        photo_taken_at: state.takenAt,
        storage_path: storagePath,
      });

      if (!result.success) {
        const code = result.error?.code ?? '';
        const message =
          ERROR_MESSAGES[code] ??
          result.error?.message ??
          'Error desconocido. Inténtalo de nuevo.';
        setState({ phase: 'error', message });
        return;
      }

      setState({
        phase: 'success',
        octanos: result.data?.octanos_earned ?? 0,
        isFirstVerifier: result.data?.is_first_verifier ?? false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al enviar la verificación.';
      setState({ phase: 'error', message });
    }
  }, [state, parkingId, uploadMutation, submitMutation]);

  // --- Permission gate ---
  if (!cameraPermission?.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-content text-base text-center mb-4">
          Necesitamos acceso a la cámara para verificar el parking.
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-pill px-6 py-3"
          onPress={requestCameraPermission}
        >
          <Text className="text-background font-bold">Permitir cámara</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Success screen ---
  if (state.phase === 'success') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-6xl mb-4">✅</Text>
        <Text className="text-content text-2xl font-bold text-center mb-2">
          ¡Verificación enviada!
        </Text>
        {state.isFirstVerifier && (
          <View className="bg-primary/20 rounded-card px-4 py-2 mb-3">
            <Text className="text-primary text-sm font-bold text-center">
              ¡Eres el primer verificador!
            </Text>
          </View>
        )}
        <Text className="text-content-muted text-center mb-6">
          Has ganado{' '}
          <Text className="text-primary font-bold">{state.octanos} Octanos</Text>
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-pill px-8 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-background font-bold">Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Error screen ---
  if (state.phase === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-4xl mb-4">⚠️</Text>
        <Text className="text-content text-lg font-bold text-center mb-3">
          No se pudo verificar
        </Text>
        <Text className="text-content-muted text-center mb-6">
          {state.message}
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-pill px-8 py-3"
          onPress={() => setState({ phase: 'camera' })}
        >
          <Text className="text-background font-bold">Intentar de nuevo</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Submitting ---
  if (state.phase === 'submitting') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FFD60A" />
        <Text className="text-content-muted mt-4">Enviando verificación…</Text>
      </SafeAreaView>
    );
  }

  // --- Preview phase ---
  if (state.phase === 'preview') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-full h-64 rounded-card bg-surface-2 items-center justify-center mb-6">
            <Text className="text-verified text-base font-semibold">
              Foto capturada
            </Text>
            <Text className="text-content-subtle text-sm mt-1">
              {new Date(state.takenAt).toLocaleTimeString('es-ES')}
            </Text>
          </View>

          <TouchableOpacity
            className="border border-border rounded-card py-2 px-4 mb-6"
            onPress={() => setState({ phase: 'camera' })}
          >
            <Text className="text-content-muted text-sm">Repetir foto</Text>
          </TouchableOpacity>
        </View>

        <View className="p-4">
          <TouchableOpacity
            className="bg-primary rounded-pill py-4 items-center"
            onPress={handleSubmit}
          >
            <Text className="text-background font-bold text-base">
              Enviar verificación
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Camera phase (default) ---
  return (
    <View className="flex-1 bg-background">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      {/* GPS accuracy overlay */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View className="mx-4 mt-2">
          {gpsAccuracy === null ? (
            <TouchableOpacity
              className="bg-background/80 rounded-card px-4 py-2 flex-row items-center"
              onPress={refreshGpsAccuracy}
            >
              <Text className="text-content-muted text-xs">
                Toca para medir precisión GPS
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              className={`rounded-card px-4 py-2 ${
                isLowAccuracy ? 'bg-rejected/80' : 'bg-verified/80'
              }`}
            >
              <Text className="text-white text-xs font-semibold">
                {isLowAccuracy
                  ? `GPS poco preciso: ${Math.round(gpsAccuracy)} m (necesitas < ${GPS_ACCURACY_THRESHOLD_M} m)`
                  : `GPS preciso: ±${Math.round(gpsAccuracy)} m`}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
      {/* Capture button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} className="pb-12 items-center">
        <TouchableOpacity
          className={`w-20 h-20 rounded-full border-4 items-center justify-center ${
            isLowAccuracy ? 'border-rejected' : 'border-primary'
          } bg-white/20`}
          onPress={handleTakePhoto}
          accessibilityRole="button"
          accessibilityLabel="Capturar foto"
        >
          <View
            className={`w-14 h-14 rounded-full ${
              isLowAccuracy ? 'bg-rejected/60' : 'bg-white/80'
            }`}
          />
        </TouchableOpacity>
        <Text className="text-white/70 text-xs mt-2">
          {isLowAccuracy ? 'GPS poco preciso' : 'Capturar foto'}
        </Text>
      </View>
    </View>
  );
}
