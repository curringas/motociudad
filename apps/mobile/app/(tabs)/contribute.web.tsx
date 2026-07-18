// Web-only replacement for the "Aportar" (propose parking) screen. Proposing is a
// contribution action best done in the mobile app (on-site: precise location + a photo
// taken at the moment). A browser photo is just a file upload and the native duplicate
// confirmation (Alert with buttons) isn't supported by react-native-web — so on web we
// show an informational screen instead. Native keeps the full 3-step wizard.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ContributeScreenWeb() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ maxWidth: 460, alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e293b',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="phone-portrait-outline" size={34} color="#FFD60A" />
        </View>
        <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
          Aporta un parking desde la app móvil
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Proponer un parking se hace desde la app móvil: allí ajustas la ubicación exacta
          sobre el mapa y añades una foto tomada en el momento. Desde el navegador puedes
          consultar el mapa, buscar y ver los detalles, pero para aportar usa la app.
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
