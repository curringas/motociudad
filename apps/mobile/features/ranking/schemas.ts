import { z } from 'zod';

/** Scope of the ranking: whole app or a single city. */
export const rankingScopes = ['global', 'city'] as const;
export type RankingScope = (typeof rankingScopes)[number];

/** Metric the ranking is ordered by: all-time total or rolling 30-day window. */
export const rankingMetrics = ['total', 'month'] as const;
export type RankingMetric = (typeof rankingMetrics)[number];

/**
 * A row of a ranking materialized view (mv_ranking_global / mv_ranking_by_city).
 * The generator types every MV column as nullable; `id` is in practice always
 * present, so we require it and tolerate the rest being null.
 */
export const rankingRowSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  current_level: z.number().int().nullable(),
  city_primary: z.string().nullable(),
  total_octanos: z.number().int().nullable(),
  octanos_this_month: z.number().int().nullable(),
  rank_total: z.number().int().nullable(),
  rank_month: z.number().int().nullable(),
});

export type RankingRow = z.infer<typeof rankingRowSchema>;
