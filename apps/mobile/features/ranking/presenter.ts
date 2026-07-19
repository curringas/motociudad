import type { RankingRow, RankingMetric } from './schemas';

/** Flat, render-ready shape derived from a RankingRow for the active metric. */
export type RankingEntryView = {
  id: string;
  rank: number | null;
  name: string;
  octanos: number;
  level: number | null;
  avatarUrl: string | null;
  city: string | null;
};

/**
 * Maps a raw ranking row to the fields a row/podium renders, resolving the
 * position and Octanos count for the selected metric (total vs. this month).
 */
export function toRankingEntryView(
  row: RankingRow,
  metric: RankingMetric,
): RankingEntryView {
  return {
    id: row.id,
    rank: metric === 'total' ? row.rank_total : row.rank_month,
    name: row.display_name ?? row.username ?? 'Piloto anónimo',
    octanos: (metric === 'total' ? row.total_octanos : row.octanos_this_month) ?? 0,
    level: row.current_level,
    avatarUrl: row.avatar_url,
    city: row.city_primary,
  };
}
