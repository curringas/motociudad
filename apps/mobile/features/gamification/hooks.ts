import { useQuery } from '@tanstack/react-query';
import { getOctanosSummary } from './api';

export const gamificationKeys = {
  all: ['octanos'] as const,
  summary: (userId: string) => [...gamificationKeys.all, userId] as const,
};

/**
 * Fetches the current user's Octanos summary. Disabled until userId is known.
 */
export function useOctanosSummary(userId: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.summary(userId ?? 'anon'),
    queryFn: () => {
      if (!userId) throw new Error('userId is required');
      return getOctanosSummary(userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
