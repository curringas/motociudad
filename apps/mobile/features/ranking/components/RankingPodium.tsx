import React from 'react';
import { View, Text } from 'react-native';
import type { RankingEntryView } from '../presenter';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

type Props = {
  /** Top entries, already ordered; only the first three are shown. */
  entries: RankingEntryView[];
  /** Id of the signed-in user, to highlight them on the podium. */
  currentUserId?: string | undefined;
};

/** Top-3 podium for the ranking. Renders nothing when there are no entries. */
export function RankingPodium({ entries, currentUserId }: Props) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <View className="flex-row justify-around items-end mb-6" accessibilityLabel="Podio del ranking">
      {top.map((entry, index) => {
        const isCurrent = entry.id === currentUserId;
        return (
          <View
            key={entry.id}
            className={`items-center rounded-card px-3 py-4 mx-1 flex-1 ${
              isCurrent ? 'bg-primary/15 border border-primary' : 'bg-surface'
            } ${index === 0 ? 'pb-6' : ''}`}
          >
            <Text className="text-3xl mb-1">{MEDALS[index]}</Text>
            <Text className="text-content text-sm font-semibold text-center" numberOfLines={1}>
              {entry.name}
            </Text>
            <Text className="text-primary text-base font-bold mt-1">⚡ {entry.octanos}</Text>
          </View>
        );
      })}
    </View>
  );
}
