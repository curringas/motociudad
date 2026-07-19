import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessionStore } from '@/stores/sessionStore';
import { useRanking, useCurrentUserRank } from '../hooks';
import { toRankingEntryView } from '../presenter';
import type { RankingScope, RankingMetric } from '../schemas';
import { RankingScopeTabs } from './RankingScopeTabs';
import { RankingMetricToggle } from './RankingMetricToggle';
import { RankingPodium } from './RankingPodium';
import { RankingList } from './RankingList';
import { RankingEmptyState } from './RankingEmptyState';

/**
 * Octanos ranking screen. Orchestrates scope (global / city) and metric
 * (total / this month) in ephemeral local state — nothing is persisted. Reads
 * the ranking materialized views via TanStack Query and highlights the
 * signed-in user's row.
 */
export function RankingScreen() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const sessionLoading = useSessionStore((s) => s.isLoading);
  const userId = useSessionStore((s) => s.user?.id);
  const [scope, setScope] = React.useState<RankingScope>('global');
  const [metric, setMetric] = React.useState<RankingMetric>('total');
  const [city, setCity] = React.useState<string | null>(null);

  // Discover the user's primary city from their global ranking row and use it
  // as the default city selection the first time it becomes available.
  const meGlobal = useCurrentUserRank({ scope: 'global', userId });
  React.useEffect(() => {
    if (city === null && meGlobal.data?.city_primary) {
      setCity(meGlobal.data.city_primary);
    }
  }, [city, meGlobal.data?.city_primary]);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRanking({ scope, metric, city, enabled: !!session });

  const meActive = useCurrentUserRank({ scope, city, userId });

  const entries = React.useMemo(
    () =>
      (data?.pages.flat() ?? []).map((row) => toRankingEntryView(row, metric)),
    [data, metric],
  );

  // Auth gate — the ranking requires a session (anon has no read access).
  // Show a sign-in prompt instead of a misleading load error.
  if (sessionLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#FFD60A" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background items-center justify-center p-8">
        <Text className="text-primary text-5xl mb-4">🏆</Text>
        <Text className="text-content text-xl font-bold text-center mb-3">
          Inicia sesión para ver el ranking
        </Text>
        <Text className="text-content-muted text-sm text-center mb-6">
          Regístrate para ganar Octanos y competir en el ranking de tu ciudad.
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-pill px-8 py-3"
          onPress={() => router.push('/login')}
          accessibilityRole="button"
        >
          <Text className="text-background font-bold">Iniciar sesión / Registrarse</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  const header = (
    <View>
      <RankingScopeTabs value={scope} onChange={setScope} />
      <RankingMetricToggle value={metric} onChange={setMetric} />
      {meActive.data && (
        <View className="bg-surface-2 rounded-card px-4 py-3 mb-4 flex-row items-center justify-between">
          <Text className="text-content-muted text-sm">Tu posición</Text>
          <Text className="text-content font-bold">
            #{metric === 'total' ? meActive.data.rank_total : meActive.data.rank_month}
            {'  ·  ⚡ '}
            {(metric === 'total'
              ? meActive.data.total_octanos
              : meActive.data.octanos_this_month) ?? 0}
          </Text>
        </View>
      )}
      <RankingPodium entries={podium} currentUserId={userId} />
    </View>
  );

  const showCityPrompt = scope === 'city' && !city;

  let body: React.ReactElement;
  if (showCityPrompt) {
    body = (
      <View className="flex-1 px-4">
        {header}
        <RankingEmptyState message="Define tu ciudad principal en tu perfil para ver el ranking de tu ciudad." />
      </View>
    );
  } else if (isLoading) {
    body = (
      <View className="flex-1 px-4">
        {header}
        <ActivityIndicator color="#FFD60A" className="mt-8" />
      </View>
    );
  } else if (isError) {
    body = (
      <View className="flex-1 px-4">
        {header}
        <RankingEmptyState message="No se pudo cargar el ranking. Inténtalo de nuevo más tarde." />
      </View>
    );
  } else {
    body = (
      <RankingList
        entries={rest}
        currentUserId={userId}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        isFetchingNextPage={isFetchingNextPage}
        ListHeaderComponent={header}
        ListEmptyComponent={
          entries.length === 0 ? (
            <RankingEmptyState message="Todavía no hay pilotos en este ranking. ¡Sé el primero!" />
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <Text className="text-content text-2xl font-bold px-4 pt-2 pb-3">
        🏆 Ranking de Octanos
      </Text>
      {body}
    </SafeAreaView>
  );
}
