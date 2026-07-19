import React from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import type { RankingEntryView } from '../presenter';
import { RankingRow } from './RankingRow';

type Props = {
  entries: RankingEntryView[];
  currentUserId?: string | undefined;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
};

/**
 * Paginated ranking list. Loads more when the user reaches the end; renders a
 * footer spinner while the next page is loading.
 */
export function RankingList({
  entries,
  currentUserId,
  onEndReached,
  isFetchingNextPage = false,
  ListHeaderComponent = null,
  ListEmptyComponent = null,
}: Props) {
  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RankingRow entry={item} highlighted={item.id === currentUserId} />
      )}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-4">
            <ActivityIndicator color="#FFD60A" />
          </View>
        ) : null
      }
    />
  );
}
