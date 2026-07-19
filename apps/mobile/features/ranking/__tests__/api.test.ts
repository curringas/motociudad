import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client so no network/native module is loaded under Vitest.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '@/lib/supabase';
import {
  fetchRankingPage,
  fetchCurrentUserRank,
  RANKING_PAGE_SIZE,
} from '../api';
import type { RankingRow } from '../schemas';

const mockFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

const rowA: RankingRow = {
  id: 'user-a',
  username: 'rider_a',
  display_name: 'Rider A',
  avatar_url: null,
  current_level: 3,
  city_primary: 'Madrid',
  total_octanos: 100,
  octanos_this_month: 40,
  rank_total: 1,
  rank_month: 2,
};
const rowB: RankingRow = { ...rowA, id: 'user-b', display_name: 'Rider B', rank_total: 2, rank_month: 1 };

/** Chainable Supabase query-builder mock resolving to a preset result. */
function createBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchRankingPage', () => {
  it('lee mv_ranking_global ordenado por rank_total en scope global + métrica total', async () => {
    const builder = createBuilder({ data: [rowA, rowB], error: null });
    mockFrom.mockReturnValue(builder);

    const rows = await fetchRankingPage({ scope: 'global', metric: 'total', page: 0 });

    expect(mockFrom).toHaveBeenCalledWith('mv_ranking_global');
    expect(builder.order).toHaveBeenCalledWith('rank_total', { ascending: true });
    expect(builder.range).toHaveBeenCalledWith(0, RANKING_PAGE_SIZE - 1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('user-a');
  });

  it('ordena por rank_month cuando la métrica es "month"', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await fetchRankingPage({ scope: 'global', metric: 'month', page: 0 });

    expect(builder.order).toHaveBeenCalledWith('rank_month', { ascending: true });
  });

  it('pagina con el offset correcto en páginas posteriores', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await fetchRankingPage({ scope: 'global', metric: 'total', page: 2 });

    expect(builder.range).toHaveBeenCalledWith(50, 74);
  });

  it('en scope ciudad filtra por city_primary sobre mv_ranking_by_city', async () => {
    const builder = createBuilder({ data: [rowA], error: null });
    mockFrom.mockReturnValue(builder);

    await fetchRankingPage({ scope: 'city', metric: 'total', city: 'Madrid', page: 0 });

    expect(mockFrom).toHaveBeenCalledWith('mv_ranking_by_city');
    expect(builder.eq).toHaveBeenCalledWith('city_primary', 'Madrid');
  });

  it('en scope ciudad sin ciudad devuelve [] y no consulta', async () => {
    const rows = await fetchRankingPage({ scope: 'city', metric: 'total', page: 0 });

    expect(rows).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('propaga el error de Supabase', async () => {
    const builder = createBuilder({ data: null, error: new Error('db down') });
    mockFrom.mockReturnValue(builder);

    await expect(
      fetchRankingPage({ scope: 'global', metric: 'total', page: 0 }),
    ).rejects.toThrow('db down');
  });
});

describe('fetchCurrentUserRank', () => {
  it('devuelve la fila del usuario en scope global', async () => {
    const builder = createBuilder({ data: rowA, error: null });
    mockFrom.mockReturnValue(builder);

    const row = await fetchCurrentUserRank({ scope: 'global', userId: 'user-a' });

    expect(mockFrom).toHaveBeenCalledWith('mv_ranking_global');
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-a');
    expect(row?.id).toBe('user-a');
  });

  it('devuelve null cuando el usuario está oculto o sin rankear', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const row = await fetchCurrentUserRank({ scope: 'global', userId: 'ghost' });

    expect(row).toBeNull();
  });

  it('en scope ciudad sin ciudad devuelve null sin consultar', async () => {
    const row = await fetchCurrentUserRank({ scope: 'city', userId: 'user-a' });

    expect(row).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
