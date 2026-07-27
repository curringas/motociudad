import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { UserChip } from '@/components/UserChip';
import { useParkingVerifiers } from '../hooks';

type Props = {
  parkingId: string;
  visible: boolean;
  onClose: () => void;
};

/** Bottom modal listing the users who verified a parking. */
export function VerifiersModal({ parkingId, visible, onClose }: Props) {
  const { data: verifiers, isLoading } = useParkingVerifiers(parkingId, visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background rounded-t-card p-6 max-h-[70%]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-content text-lg font-bold">Quién ha verificado</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text className="text-content-muted text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#FFD60A" />
          ) : (verifiers ?? []).length === 0 ? (
            <Text className="text-content-muted text-sm py-4">
              Este parking aún no tiene verificaciones.
            </Text>
          ) : (
            <ScrollView>
              {(verifiers ?? []).map((v) => (
                <View key={v.id} className="py-2">
                  <UserChip
                    userId={v.id}
                    name={v.display_name || v.username}
                    avatarUrl={v.avatar_url}
                    size={40}
                    subtitle={v.is_first_verifier ? 'Primer verificador' : null}
                    onPress={onClose}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
