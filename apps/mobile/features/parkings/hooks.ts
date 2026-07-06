import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getNearbyParkings,
  getParkingById,
  proposeParking,
  checkForNearbyDuplicates,
} from './api';
import type { ProposeParkingInput } from './schemas';

/** Query key factory for parkings domain */
export const parkingKeys = {
  all: ['parkings'] as const,
  nearby: (
    center: { lat: number; lng: number } | null,
    radiusM: number,
    filter?: string,
    onlyVerified?: boolean,
  ) => [...parkingKeys.all, 'nearby', center, radiusM, filter, onlyVerified] as const,
  detail: (id: string) => [...parkingKeys.all, 'detail', id] as const,
};

/**
 * Fetches parkings near the given centre, debounced by 500 ms.
 * Disabled when centre is null (location not yet available).
 */
export function useNearbyParkings(
  center: { lat: number; lng: number } | null,
  radiusM = 2000,
  filter?: string,
  onlyVerified = false,
) {
  const debouncedCenter = useDebounce(center, 500);
  const debouncedRadiusM = useDebounce(radiusM, 500);

  return useQuery({
    queryKey: parkingKeys.nearby(debouncedCenter, debouncedRadiusM, filter, onlyVerified),
    queryFn: () =>
      getNearbyParkings(debouncedCenter!, debouncedRadiusM, filter, onlyVerified),
    enabled: debouncedCenter !== null,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetches the full detail for a single parking by id.
 */
export function useParkingDetail(id: string) {
  return useQuery({
    queryKey: parkingKeys.detail(id),
    queryFn: () => getParkingById(id),
    staleTime: 60_000,
  });
}

/**
 * Mutation to propose a new parking. On success, invalidates all nearby queries
 * so the new pin appears immediately.
 */
export function useProposeParking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      payload: ProposeParkingInput & { photo_storage_path?: string },
    ) => proposeParking(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingKeys.all });
    },
  });
}

/**
 * Checks whether a nearby parking already exists at the given coordinates.
 * Used during the "propose" flow to warn about duplicates.
 */
export function useCheckDuplicates() {
  return useMutation({
    mutationFn: ({
      lat,
      lng,
      radiusM,
    }: {
      lat: number;
      lng: number;
      radiusM?: number;
    }) => checkForNearbyDuplicates(lat, lng, radiusM),
  });
}
