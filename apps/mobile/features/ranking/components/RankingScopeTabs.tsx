import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { RankingScope } from '../schemas';

type Props = {
  value: RankingScope;
  onChange: (scope: RankingScope) => void;
};

const OPTIONS: { scope: RankingScope; label: string }[] = [
  { scope: 'global', label: 'Global' },
  { scope: 'city', label: 'Mi ciudad' },
];

/** Segmented control to switch the ranking scope (global vs. city). */
export function RankingScopeTabs({ value, onChange }: Props) {
  return (
    <View className="flex-row bg-surface rounded-pill p-1 mb-3">
      {OPTIONS.map(({ scope, label }) => {
        const active = value === scope;
        return (
          <Pressable
            key={scope}
            onPress={() => onChange(scope)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Ranking ${label}`}
            className={`flex-1 rounded-pill py-2 items-center ${active ? 'bg-primary' : ''}`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-background' : 'text-content-muted'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
