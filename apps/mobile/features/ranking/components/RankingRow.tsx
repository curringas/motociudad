import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import type { RankingEntryView } from '../presenter';

type Props = {
  entry: RankingEntryView;
  /** Highlights the row when it belongs to the signed-in user. */
  highlighted?: boolean;
};

/** A single ranking list row: position, avatar, name, level and Octanos. Tappable → profile. */
export function RankingRow({ entry, highlighted = false }: Props) {
  const router = useRouter();
  return (
    <TouchableOpacity
      className={`flex-row items-center rounded-card px-4 py-3 mb-2 ${
        highlighted ? 'bg-primary/15 border border-primary' : 'bg-surface'
      }`}
      onPress={() => router.push(`/user/${entry.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Puesto ${entry.rank ?? '-'}, ${entry.name}, ${entry.octanos} Octanos. Ver perfil`}
    >
      <Text className="text-content-muted text-base font-bold w-9">
        {entry.rank ?? '–'}
      </Text>
      <Avatar url={entry.avatarUrl} name={entry.name} size={36} />
      <View className="flex-1 ml-2">
        <Text className="text-content text-base font-semibold" numberOfLines={1}>
          {entry.name}
          {highlighted ? '  ·  Tú' : ''}
        </Text>
        {entry.level != null && (
          <Text className="text-content-muted text-xs mt-0.5">
            Nivel {entry.level}
            {entry.city ? `  ·  ${entry.city}` : ''}
          </Text>
        )}
      </View>
      <Text className="text-primary text-base font-bold ml-2">
        ⚡ {entry.octanos}
      </Text>
    </TouchableOpacity>
  );
}
