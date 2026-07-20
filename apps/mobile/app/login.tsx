import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Introduce tu email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;

        const needsEmailConfirmation = !signUpData.session;
        if (needsEmailConfirmation) {
          Alert.alert(
            '¡Cuenta creada!',
            'Revisa tu email para confirmar la cuenta antes de continuar.',
            [{ text: 'OK' }],
          );
          setLoading(false);
          return;
        }

        // Email confirmation disabled — session already active, continue normally
      }
      if (redirect) {
        router.replace(redirect as `/${string}`);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/map');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / título */}
          <Text style={{ color: '#FFD60A', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
            MotoCiudad
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 40 }}>
            {mode === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
          </Text>

          {/* Email */}
          <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Email</Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#334155',
            }}
            placeholder="tu@email.com"
            placeholderTextColor="#475569"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Contraseña</Text>
          <TextInput
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              marginBottom: 32,
              borderWidth: 1,
              borderColor: '#334155',
            }}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#475569"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Botón principal */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FFD60A',
              borderRadius: 999,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 16,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={{ color: '#0f172a', fontWeight: 'bold', fontSize: 16 }}>
                {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle modo */}
          <TouchableOpacity
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={{ alignItems: 'center', marginBottom: 24 }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <Text style={{ color: '#FFD60A', fontWeight: '600' }}>
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Cancelar */}
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/map');
              }
            }}
            style={{ alignItems: 'center' }}
            accessibilityRole="button"
          >
            <Text style={{ color: '#64748b', fontSize: 14 }}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
