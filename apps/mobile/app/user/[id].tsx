import React from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { usePublicProfile } from '@/features/profile/hooks';

/** Public profile of any user: avatar, @nick, city, level and Octanos. */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: profile, isLoading, isError } = usePublicProfile(id);

  const nick = profile?.username ?? '';
  // Respect the ranking privacy preference: hide Octanos when opted out.
  const showOctanos = profile?.ranking_visible !== false;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Perfil', headerBackTitle: 'Atrás' }} />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#FFD60A" />
          </View>
        ) : isError || !profile ? (
          <View className="items-center py-16">
            <Text className="text-content-muted text-base">
              No se pudo cargar este perfil.
            </Text>
          </View>
        ) : (
          <View className="items-center">
            <Avatar url={profile.avatar_url} name={nick} size={112} />
            <Text className="text-content text-2xl font-bold mt-4">@{nick}</Text>

            <View className="flex-row items-center gap-2 mt-1">
              {profile.current_level != null && (
                <Text className="text-content-muted text-sm">
                  Nivel {profile.current_level}
                </Text>
              )}
              {profile.city_primary ? (
                <Text className="text-content-muted text-sm">
                  · 📍 {profile.city_primary}
                </Text>
              ) : null}
            </View>

            {showOctanos ? (
              <View className="bg-surface rounded-card px-8 py-5 mt-6 items-center">
                <Text className="text-primary text-3xl font-bold">
                  ⚡ {profile.total_octanos ?? 0}
                </Text>
                <Text className="text-content-muted text-xs mt-1">Octanos</Text>
              </View>
            ) : (
              <Text className="text-content-subtle text-xs mt-6">
                Este usuario no muestra sus Octanos.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
