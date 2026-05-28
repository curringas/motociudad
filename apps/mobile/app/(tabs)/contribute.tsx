import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';

import { useUserLocation } from '@/hooks/useUserLocation';
import { useUiStore } from '@/stores/uiStore';
import { useProposeParking, useCheckDuplicates } from '@/features/parkings/hooks';
import { supabase } from '@/lib/supabase';
import type { ParkingFeatures } from '@/types/domain';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MAP_STYLE_DARK = require('@/assets/map-style-dark.json') as object[];

const STEPS = ['Ubicación', 'Detalles', 'Foto'] as const;
type Step = 0 | 1 | 2;

type ParkingType = 'public' | 'private';

const FEATURE_LIST: { key: keyof ParkingFeatures; label: string }[] = [
  { key: 'covered', label: 'Cubierto' },
  { key: 'cameras', label: 'Cámaras' },
  { key: 'anchors', label: 'Anclajes' },
  { key: 'lit', label: 'Iluminado' },
  { key: 'free', label: 'Gratuito' },
  { key: 'h24', label: '24h' },
  { key: 'battery_layout', label: 'Batería' },
];

export default function ContributeScreen() {
  const router = useRouter();
  const { location } = useUserLocation();
  const mapCenter = useUiStore((s) => s.mapCenter);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const proposeMutation = useProposeParking();
  const duplicateMutation = useCheckDuplicates();

  const [step, setStep] = useState<Step>(0);
  const [submitted, setSubmitted] = useState(false);
  const [pendingOctanos, setPendingOctanos] = useState(0);

  // Step 1: Location
  const [markerCoords, setMarkerCoords] = useState({
    latitude: mapCenter?.lat ?? location?.latitude ?? 40.4168,
    longitude: mapCenter?.lng ?? location?.longitude ?? -3.7038,
  });

  // Step 2: Details
  const [name, setName] = useState('');
  const [parkingType, setParkingType] = useState<ParkingType | null>(null);
  const [features, setFeatures] = useState<ParkingFeatures>({});
  const [notes, setNotes] = useState('');

  // Step 3: Photo
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  const isStep2Valid = name.trim().length >= 3 && parkingType !== null;

  const toggleFeature = useCallback((key: keyof ParkingFeatures) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleLocationConfirm = useCallback(async () => {
    try {
      const hasDupe = await duplicateMutation.mutateAsync({
        lat: markerCoords.latitude,
        lng: markerCoords.longitude,
        radiusM: 30,
      });

      if (hasDupe) {
        Alert.alert(
          'Posible duplicado',
          'Ya existe un parking muy cerca de este punto. ¿Quieres continuar?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => setStep(1) },
          ],
        );
      } else {
        setStep(1);
      }
    } catch {
      setStep(1);
    }
  }, [markerCoords, duplicateMutation]);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) return;

      // Strip EXIF to protect user privacy
      const stripped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      setPhotoUri(stripped.uri);
    } catch (err) {
      Alert.alert('Error', 'No se pudo tomar la foto. Inténtalo de nuevo.');
    }
  }, [cameraRef]);

  const handleSubmit = useCallback(async () => {
    if (!parkingType) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      Alert.alert('Sesión', 'Debes iniciar sesión para aportar un parking.');
      return;
    }

    let photoStoragePath: string | undefined;

    // Upload photo if provided
    if (photoUri) {
      try {
        const takenAt = new Date().toISOString();
        const userId = sessionData.session.user.id;
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const storagePath = `parkings/pending/${userId}/${Date.now()}.jpg`;

        await supabase.storage
          .from('parkings-photos')
          .upload(storagePath, blob, { contentType: 'image/jpeg' });

        photoStoragePath = storagePath;
      } catch {
        // Photo upload failure is non-blocking — parking can be proposed without photo
      }
    }

    try {
      const result = await proposeMutation.mutateAsync({
        name: name.trim(),
        type: parkingType,
        latitude: markerCoords.latitude,
        longitude: markerCoords.longitude,
        city: 'Madrid', // TODO: reverse geocode from coords
        features,
        notes: notes.trim() || undefined,
        photo_storage_path: photoStoragePath,
      });

      setPendingOctanos(result.octanos_earned);
      setSubmitted(true);
    } catch (err) {
      console.error('[proposeParking]', err);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'No se pudo aportar el parking. Comprueba tu conexión e inténtalo de nuevo.',
      );
    }
  }, [
    parkingType,
    photoUri,
    name,
    markerCoords,
    features,
    notes,
    proposeMutation,
  ]);

  // --- Confirmation screen ---
  if (submitted) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-primary text-5xl mb-4">⭐</Text>
        <Text className="text-content text-2xl font-bold text-center">
          ¡Parking aportado!
        </Text>
        <Text className="text-content-muted text-sm text-center mt-3 mb-6">
          Tu parking está pendiente de verificación.{'\n'}
          Has ganado <Text className="text-primary font-bold">{pendingOctanos} Octanos</Text> (pendientes de confirmación).
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-pill px-8 py-3"
          onPress={() => {
            setSubmitted(false);
            setStep(0);
            setName('');
            setParkingType(null);
            setFeatures({});
            setNotes('');
            setPhotoUri(null);
            router.replace('/(tabs)/map');
          }}
        >
          <Text className="text-background font-bold">Volver al mapa</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Step indicator */}
      <View className="flex-row items-center justify-center pt-4 pb-2 px-6 gap-2">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <View className="items-center">
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  i === step
                    ? 'bg-primary'
                    : i < step
                    ? 'bg-verified'
                    : 'bg-surface-2'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    i === step || i < step ? 'text-background' : 'text-content-muted'
                  }`}
                >
                  {i + 1}
                </Text>
              </View>
              <Text className="text-content-muted text-xs mt-1">{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View className={`flex-1 h-px ${i < step ? 'bg-verified' : 'bg-surface-2'} mb-5`} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* ---- STEP 0: Location ---- */}
      {step === 0 && (
        <View className="flex-1">
          <Text className="text-content text-sm text-center px-4 mb-2 text-content-muted">
            Mueve el marcador exactamente donde está el parking
          </Text>
          <MapView
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            initialRegion={{
              latitude: markerCoords.latitude,
              longitude: markerCoords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            customMapStyle={MAP_STYLE_DARK}
          >
            <Marker
              coordinate={markerCoords}
              draggable
              onDragEnd={(e) =>
                setMarkerCoords(e.nativeEvent.coordinate)
              }
              pinColor="#FFD60A"
            />
          </MapView>
          <View className="p-4">
            <TouchableOpacity
              className="bg-primary rounded-pill py-4 items-center"
              onPress={handleLocationConfirm}
              disabled={duplicateMutation.isPending}
            >
              {duplicateMutation.isPending ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text className="text-background font-bold text-base">
                  Confirmar ubicación
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---- STEP 1: Details ---- */}
      {step === 1 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            className="flex-1 px-4"
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <Text className="text-content-muted text-sm mb-1 mt-4">
              Nombre del parking *
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-card px-4 py-3 text-content text-base"
              placeholder="Ej. Parking Calle Mayor"
              placeholderTextColor="#475569"
              value={name}
              onChangeText={setName}
              maxLength={120}
              accessibilityLabel="Nombre del parking"
            />

            {/* Type */}
            <Text className="text-content-muted text-sm mb-2 mt-4">
              Tipo *
            </Text>
            <View className="flex-row gap-3 mb-4">
              {(['public', 'private'] as ParkingType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`flex-1 py-3 rounded-card border items-center ${
                    parkingType === type
                      ? 'bg-primary/20 border-primary'
                      : 'bg-surface border-border'
                  }`}
                  onPress={() => setParkingType(type)}
                >
                  <Text
                    className={`font-semibold ${
                      parkingType === type ? 'text-primary' : 'text-content-muted'
                    }`}
                  >
                    {type === 'public' ? 'Público' : 'Privado'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Features */}
            <Text className="text-content-muted text-sm mb-2">
              Características
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {FEATURE_LIST.map(({ key, label }) => {
                const active = !!features[key];
                return (
                  <TouchableOpacity
                    key={key}
                    className={`rounded-pill px-3 py-2 border ${
                      active
                        ? 'bg-primary/20 border-primary'
                        : 'bg-surface border-border'
                    }`}
                    onPress={() => toggleFeature(key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={label}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        active ? 'text-primary' : 'text-content-muted'
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <Text className="text-content-muted text-sm mb-1">
              Notas adicionales
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-card px-4 py-3 text-content text-base"
              placeholder="Acceso, restricciones, etc."
              placeholderTextColor="#475569"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={500}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              accessibilityLabel="Notas adicionales"
            />

            <View className="h-6" />
          </ScrollView>

          <View className="p-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-border rounded-pill py-3 items-center"
              onPress={() => setStep(0)}
            >
              <Text className="text-content font-semibold">Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-pill py-3 items-center ${
                isStep2Valid ? 'bg-primary' : 'bg-surface-2'
              }`}
              onPress={() => setStep(2)}
              disabled={!isStep2Valid}
            >
              <Text
                className={`font-bold ${
                  isStep2Valid ? 'text-background' : 'text-content-subtle'
                }`}
              >
                Continuar
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ---- STEP 2: Photo ---- */}
      {step === 2 && (
        <View className="flex-1">
          {!cameraPermission?.granted ? (
            <View className="flex-1 items-center justify-center p-6">
              <Text className="text-content text-base text-center mb-4">
                Necesitamos acceso a la cámara para añadir una foto del parking.
              </Text>
              <TouchableOpacity
                className="bg-primary rounded-pill px-6 py-3"
                onPress={requestCameraPermission}
              >
                <Text className="text-background font-bold">
                  Permitir cámara
                </Text>
              </TouchableOpacity>
            </View>
          ) : photoUri ? (
            // Photo preview
            <View className="flex-1 items-center justify-center p-4">
              <Text className="text-verified text-base font-semibold mb-4">
                Foto lista
              </Text>
              <TouchableOpacity
                className="border border-border rounded-card py-2 px-4 mb-6"
                onPress={() => setPhotoUri(null)}
              >
                <Text className="text-content-muted text-sm">Repetir foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <CameraView
                ref={setCameraRef}
                style={{ flex: 1 }}
                facing="back"
              />
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} className="justify-end p-6">
                <TouchableOpacity
                  className="bg-white w-16 h-16 rounded-full self-center border-4 border-primary items-center justify-center"
                  onPress={handleTakePhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Capturar foto"
                >
                  <View className="w-12 h-12 rounded-full bg-white" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View className="p-4 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-border rounded-pill py-3 items-center"
              onPress={() => setStep(1)}
            >
              <Text className="text-content font-semibold">Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-pill py-3 items-center ${
                proposeMutation.isPending ? 'bg-surface-2' : 'bg-primary'
              }`}
              onPress={handleSubmit}
              disabled={proposeMutation.isPending}
            >
              {proposeMutation.isPending ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text className="text-background font-bold">
                  {photoUri ? 'Enviar con foto' : 'Enviar sin foto'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
