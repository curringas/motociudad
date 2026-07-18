// El panel de administración es solo web. En nativo mostramos un aviso.
// (En web se resuelve _layout.web.tsx en su lugar.)
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayoutNative() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <Ionicons name="desktop-outline" size={34} color="#FFD60A" />
        <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
          El panel de administración solo está disponible en la web
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Abre MotoCiudad en el navegador para gestionar usuarios y parkings.
        </Text>
      </View>
    </SafeAreaView>
  );
}
