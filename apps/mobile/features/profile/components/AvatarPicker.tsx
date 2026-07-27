import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@/components/Avatar';
import { useUploadAvatar } from '../hooks';

type Props = {
  userId: string;
  url: string | null;
  name: string | null;
};

/**
 * Shows the current avatar and lets the user pick a new image (images only).
 * The picked file is re-encoded/resized and uploaded by `useUploadAvatar`.
 */
export function AvatarPicker({ userId, url, name }: Props) {
  const upload = useUploadAvatar(userId);

  const handlePick = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tus fotos para cambiar el avatar.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;

    upload.mutate(asset.uri, {
      onError: () =>
        Alert.alert('Error', 'No se pudo subir la imagen. Inténtalo de nuevo.'),
    });
  }, [upload]);

  return (
    <View className="items-center">
      <Avatar url={url} name={name} size={96} />
      <TouchableOpacity
        className="mt-3 bg-surface-2 rounded-pill px-4 py-2"
        onPress={handlePick}
        disabled={upload.isPending}
        accessibilityRole="button"
        accessibilityLabel="Cambiar foto de perfil"
      >
        {upload.isPending ? (
          <ActivityIndicator size="small" color="#FFD60A" />
        ) : (
          <Text className="text-content font-semibold text-sm">Cambiar foto</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
