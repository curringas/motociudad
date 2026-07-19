import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  message: string;
};

/** Neutral empty state for the ranking (no city, no ranked users, etc.). */
export function RankingEmptyState({ message }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16" accessibilityLabel={message}>
      <Text className="text-4xl mb-3">🏁</Text>
      <Text className="text-content-muted text-center text-base">{message}</Text>
    </View>
  );
}
