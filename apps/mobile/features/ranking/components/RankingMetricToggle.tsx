import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { RankingMetric } from '../schemas';

type Props = {
  value: RankingMetric;
  onChange: (metric: RankingMetric) => void;
};

const OPTIONS: { metric: RankingMetric; label: string }[] = [
  { metric: 'total', label: 'Totales' },
  { metric: 'month', label: 'Este mes' },
];

/** Segmented control to switch the ranking metric (all-time vs. this month). */
export function RankingMetricToggle({ value, onChange }: Props) {
  return (
    <View className="flex-row self-center mb-4">
      {OPTIONS.map(({ metric, label }, index) => {
        const active = value === metric;
        return (
          <Pressable
            key={metric}
            onPress={() => onChange(metric)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Octanos ${label}`}
            className={`px-4 py-1.5 border-t border-b border-primary ${
              index === 0 ? 'rounded-l-pill border-l' : 'rounded-r-pill border-r'
            } ${active ? 'bg-primary' : ''}`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-background' : 'text-primary'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
