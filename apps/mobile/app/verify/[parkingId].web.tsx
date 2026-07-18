// Web-only replacement for the verify flow. Verification requires being physically
// at the parking with GPS and taking a fresh photo — neither is trustworthy from a
// browser (a web "photo" is just a file upload). So on web we don't run the flow;
// we explain that verification happens in the mobile app. Native keeps the real flow.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function VerifyScreenWeb() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ maxWidth: 440, alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e293b',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="phone-portrait-outline" size={34} color="#FFD60A" />
        </View>
        <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
          Verifica desde la app móvil
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Verificar un parking requiere estar físicamente en el lugar: la app usa tu
          ubicación y una foto tomada en el momento para confirmar que existe. Por eso
          la verificación solo está disponible en la app móvil de MotoCiudad.
        </Text>
        <Pressable
          onPress={() => router.replace('/map')}
          accessibilityRole="button"
          accessibilityLabel="Volver al mapa"
          style={{ backgroundColor: '#FFD60A', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 }}
        >
          <Text style={{ color: '#0f172a', fontWeight: '800' }}>Volver al mapa</Text>
        </Pressable>
      </View>
    </View>
  );
}
