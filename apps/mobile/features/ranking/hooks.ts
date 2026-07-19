import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchRankingPage,
  fetchCurrentUserRank,
  RANKING_PAGE_SIZE,
} from './api';
import type { RankingScope, RankingMetric } from './schemas';

// Ranking is refreshed by pg_cron every ~5 minutes; align client staleness.
const RANKING_STALE_TIME = 5 * 60_000;

export const rankingKeys = {
  all: ['ranking'] as const,
  list: (scope: RankingScope, metric: RankingMetric, city: string | null) =>
    [...rankingKeys.all, 'list', scope, metric, city] as const,
  me: (scope: RankingScope, city: string | null, userId: string) =>
    [...rankingKeys.all, 'me', scope, city, userId] as const,
};

export type UseRankingParams = {
  scope: RankingScope;
  metric: RankingMetric;
  city?: string | null;
  /** Gate the query (e.g. only run for an authenticated session). Default true. */
  enabled?: boolean;
};

/**
 * Infinite ranking list for the given scope/metric. Disabled for city scope
 * until a city is chosen, or when `enabled` is false. Pages are
 * RANKING_PAGE_SIZE rows; a short page means there is no next page.
 */
export function useRanking({
  scope,
  metric,
  city = null,
  enabled = true,
}: UseRankingParams) {
  return useInfiniteQuery({
    queryKey: rankingKeys.list(scope, metric, city),
    queryFn: ({ pageParam }) =>
      fetchRankingPage({ scope, metric, city, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === RANKING_PAGE_SIZE ? allPages.length : undefined,
    enabled: enabled && (scope !== 'city' || !!city),
    staleTime: RANKING_STALE_TIME,
  });
}

export type UseCurrentUserRankParams = {
  scope: RankingScope;
  city?: string | null;
  userId: string | undefined;
};

/** The current user's own ranking row for the active scope, or null if hidden. */
export function useCurrentUserRank({
  scope,
  city = null,
  userId,
}: UseCurrentUserRankParams) {
  return useQuery({
    queryKey: rankingKeys.me(scope, city, userId ?? 'anon'),
    queryFn: () => {
      if (!userId) throw new Error('userId is required');
      return fetchCurrentUserRank({ scope, city, userId });
    },
    enabled: !!userId && (scope !== 'city' || !!city),
    staleTime: RANKING_STALE_TIME,
  });
}
