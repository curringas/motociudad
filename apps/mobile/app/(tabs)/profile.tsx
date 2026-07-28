import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/sessionStore';
import { supabase } from '@/lib/supabase';
import { OctanosSummary } from '@/features/gamification/components/OctanosSummary';
import { AvatarPicker } from '@/features/profile/components/AvatarPicker';
import { EditProfileForm } from '@/features/profile/components/EditProfileForm';
import { useMyProfile } from '@/features/profile/hooks';

export default function ProfileScreen() {
  const { user } = useSessionStore();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { data: profile, isLoading } = useMyProfile(!!user);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!user) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-content text-xl font-bold text-center">
            Inicia sesión para ver tu perfil
          </Text>
          <Text className="text-content-muted text-sm text-center mt-2 mb-8">
            Regístrate para ganar Octanos y subir en el ranking.
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-pill px-8 py-3"
            onPress={() => router.push('/login')}
            accessibilityRole="button"
          >
            <Text className="text-background font-bold text-base">
              Iniciar sesión / Registrarse
            </Text>
          </TouchableOpacity>
          <OsmAttribution />
        </View>
      </SafeAreaView>
    );
  }

  const nick = profile?.username ?? '';

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color="#FFD60A" />
          </View>
        ) : (
          <>
            <View className="items-center mb-6">
              <AvatarPicker userId={user.id} url={profile?.avatar_url ?? null} name={nick} />
              <Text className="text-content text-xl font-bold mt-3">@{nick}</Text>
              <View className="flex-row items-center gap-2 mt-1">
                {profile?.current_level != null && (
                  <Text className="text-content-muted text-sm">
                    Nivel {profile.current_level}
                  </Text>
                )}
                {profile?.city_primary ? (
                  <Text className="text-content-muted text-sm">
                    · 📍 {profile.city_primary}
                  </Text>
                ) : null}
              </View>
              <Text className="text-content-subtle text-xs mt-1">{user.email}</Text>
            </View>

            {editing ? (
              <View className="bg-surface rounded-card p-4 mb-6">
                <Text className="text-content font-bold text-base mb-4">Editar perfil</Text>
                <EditProfileForm
                  userId={user.id}
                  email={user.email ?? null}
                  initialNick={nick}
                  initialCity={profile?.city_primary ?? null}
                  onSaved={() => setEditing(false)}
                />
                <TouchableOpacity
                  className="mt-3 items-center py-2"
                  onPress={() => setEditing(false)}
                  accessibilityRole="button"
                >
                  <Text className="text-content-muted text-sm">Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                className="bg-surface-2 rounded-pill py-3 items-center mb-6"
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Editar perfil"
              >
                <Text className="text-content font-semibold">Editar perfil</Text>
              </TouchableOpacity>
            )}

            <OctanosSummary userId={user.id} />

            <TouchableOpacity
              className="border border-rejected/50 rounded-card p-4 items-center"
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
            >
              <Text className="text-rejected font-semibold">Cerrar sesión</Text>
            </TouchableOpacity>

            <OsmAttribution />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * ODbL attribution for the parking data seeded from OpenStreetMap. Required by
 * the OSM licence and shown wherever the user reaches settings (mobile + web).
 */
function OsmAttribution() {
  return (
    <Text
      className="text-content-muted text-xs text-center mt-8"
      accessibilityRole="text"
    >
      Datos de parkings © OpenStreetMap contributors
    </Text>
  );
}
