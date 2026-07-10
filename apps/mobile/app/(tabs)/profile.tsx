import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/sessionStore';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user } = useSessionStore();
  const router = useRouter();

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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <View className="flex-1 p-6">
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-surface-2 items-center justify-center mb-3">
            <Text className="text-primary text-3xl font-bold">
              {user.email?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text className="text-content text-lg font-bold">
            {user.email ?? 'Usuario'}
          </Text>
        </View>

        <TouchableOpacity
          className="border border-rejected/50 rounded-card p-4 items-center"
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Text className="text-rejected font-semibold">Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
