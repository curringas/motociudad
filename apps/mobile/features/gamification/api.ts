import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { levelForOctanos, type LevelProgress } from './levels';
import {
  userOctanosSchema,
  userLevelSchema,
  octanoPointsRowSchema,
} from './schemas';

export type OctanosSummary = {
  confirmed: number;
  pending: number;
  level: LevelProgress;
};

/**
 * Reads the current user's Octanos summary. All reads are RLS-permitted:
 * own `users` row, public `user_levels` catalog, and own pending `octano_events`.
 * Never writes to octano_events.
 */
export async function getOctanosSummary(userId: string): Promise<OctanosSummary> {
  const [userRes, levelsRes, pendingRes] = await Promise.all([
    supabase.from('users').select('total_octanos').eq('id', userId).single(),
    supabase
      .from('user_levels')
      .select('level, name, min_octanos')
      .order('min_octanos', { ascending: true }),
    supabase
      .from('octano_events')
      .select('points')
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ]);

  if (userRes.error) throw userRes.error;
  if (levelsRes.error) throw levelsRes.error;
  if (pendingRes.error) throw pendingRes.error;

  const confirmed = userOctanosSchema.parse(userRes.data).total_octanos;
  const levels = z.array(userLevelSchema).parse(levelsRes.data);
  const pending = z
    .array(octanoPointsRowSchema)
    .parse(pendingRes.data ?? [])
    .reduce((sum, row) => sum + row.points, 0);

  return { confirmed, pending, level: levelForOctanos(confirmed, levels) };
}
