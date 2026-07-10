import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RankingScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-primary text-4xl mb-4">🏆</Text>
        <Text className="text-content text-xl font-bold text-center">
          Ranking de Octanos
        </Text>
        <Text className="text-content-muted text-sm text-center mt-2">
          Próximamente. Gana Octanos verificando parkings y sube en el ranking de tu ciudad.
        </Text>
      </View>
    </SafeAreaView>
  );
}
