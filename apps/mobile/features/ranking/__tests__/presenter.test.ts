import { describe, it, expect } from 'vitest';
import { toRankingEntryView } from '../presenter';
import type { RankingRow } from '../schemas';

const base: RankingRow = {
  id: 'u1',
  username: 'rider_x',
  display_name: 'Rider X',
  avatar_url: 'http://img',
  current_level: 4,
  city_primary: 'Sevilla',
  total_octanos: 200,
  octanos_this_month: 35,
  rank_total: 5,
  rank_month: 12,
};

describe('toRankingEntryView', () => {
  it('usa rank_total y total_octanos con la métrica "total"', () => {
    const view = toRankingEntryView(base, 'total');
    expect(view.rank).toBe(5);
    expect(view.octanos).toBe(200);
  });

  it('usa rank_month y octanos_this_month con la métrica "month"', () => {
    const view = toRankingEntryView(base, 'month');
    expect(view.rank).toBe(12);
    expect(view.octanos).toBe(35);
  });

  it('prefiere display_name y cae a username y luego a "Piloto anónimo"', () => {
    expect(toRankingEntryView(base, 'total').name).toBe('Rider X');
    expect(toRankingEntryView({ ...base, display_name: null }, 'total').name).toBe('rider_x');
    expect(
      toRankingEntryView({ ...base, display_name: null, username: null }, 'total').name,
    ).toBe('Piloto anónimo');
  });

  it('trata octanos nulos como 0', () => {
    const view = toRankingEntryView({ ...base, total_octanos: null }, 'total');
    expect(view.octanos).toBe(0);
  });
});
