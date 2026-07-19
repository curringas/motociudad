import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
  rankingRowSchema,
  type RankingRow,
  type RankingScope,
  type RankingMetric,
} from './schemas';

/** Explicit column list — never SELECT * against production (SQL convention). */
const RANKING_COLUMNS =
  'id, username, display_name, avatar_url, current_level, city_primary, total_octanos, octanos_this_month, rank_total, rank_month';

export const RANKING_PAGE_SIZE = 25;

function orderColumn(metric: RankingMetric): 'rank_total' | 'rank_month' {
  return metric === 'total' ? 'rank_total' : 'rank_month';
}

export type FetchRankingPageParams = {
  scope: RankingScope;
  metric: RankingMetric;
  city?: string | null;
  page: number;
  pageSize?: number;
};

/**
 * Reads one page of the ranking, ordered by the selected metric. Global scope
 * reads mv_ranking_global; city scope reads mv_ranking_by_city filtered by
 * city_primary. Both MVs already exclude private/flagged users. Returns [] for
 * a city scope with no city selected.
 */
export async function fetchRankingPage({
  scope,
  metric,
  city,
  page,
  pageSize = RANKING_PAGE_SIZE,
}: FetchRankingPageParams): Promise<RankingRow[]> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  if (scope === 'city') {
    if (!city) return [];
    const { data, error } = await supabase
      .from('mv_ranking_by_city')
      .select(RANKING_COLUMNS)
      .eq('city_primary', city)
      .order(orderColumn(metric), { ascending: true })
      .range(from, to);
    if (error) throw error;
    return z.array(rankingRowSchema).parse(data ?? []);
  }

  const { data, error } = await supabase
    .from('mv_ranking_global')
    .select(RANKING_COLUMNS)
    .order(orderColumn(metric), { ascending: true })
    .range(from, to);
  if (error) throw error;
  return z.array(rankingRowSchema).parse(data ?? []);
}

export type FetchCurrentUserRankParams = {
  scope: RankingScope;
  city?: string | null;
  userId: string;
};

/**
 * Reads the current user's own ranking row so the UI can highlight their
 * position even when it falls outside the loaded pages. Returns null when the
 * user is hidden from the ranking (ranking_visible = FALSE) or not yet ranked.
 */
export async function fetchCurrentUserRank({
  scope,
  city,
  userId,
}: FetchCurrentUserRankParams): Promise<RankingRow | null> {
  if (scope === 'city') {
    if (!city) return null;
    const { data, error } = await supabase
      .from('mv_ranking_by_city')
      .select(RANKING_COLUMNS)
      .eq('id', userId)
      .eq('city_primary', city)
      .maybeSingle();
    if (error) throw error;
    return data ? rankingRowSchema.parse(data) : null;
  }

  const { data, error } = await supabase
    .from('mv_ranking_global')
    .select(RANKING_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rankingRowSchema.parse(data) : null;
}
