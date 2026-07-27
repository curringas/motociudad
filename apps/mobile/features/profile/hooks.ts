import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  checkNickAvailable,
  fetchParkingVerifiers,
  getMyProfile,
  getPublicProfile,
  searchCities,
  updateProfile,
  uploadAvatar,
} from './api';
import type { UpdateProfileInput } from './schemas';

/** Query key factory for the profile domain. */
export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  public: (id: string) => [...profileKeys.all, 'public', id] as const,
  nick: (nick: string) => [...profileKeys.all, 'nick', nick] as const,
  city: (q: string) => [...profileKeys.all, 'city', q] as const,
  verifiers: (parkingId: string) =>
    [...profileKeys.all, 'verifiers', parkingId] as const,
};

/** The signed-in user's own profile. */
export function useMyProfile(enabled = true) {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
    enabled,
    staleTime: 30_000,
  });
}

/** Any user's public profile by id. */
export function usePublicProfile(id: string | undefined) {
  return useQuery({
    queryKey: profileKeys.public(id ?? ''),
    queryFn: () => getPublicProfile(id as string),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Debounced availability check for a candidate nick (source of truth is the DB). */
export function useNickAvailability(
  debouncedNick: string,
  currentUserId: string | undefined,
  isValidFormat: boolean,
) {
  return useQuery({
    queryKey: profileKeys.nick(debouncedNick.toLowerCase()),
    queryFn: () => checkNickAvailable(debouncedNick, currentUserId as string),
    enabled: !!currentUserId && isValidFormat && debouncedNick.length >= 3,
    staleTime: 10_000,
  });
}

/** Debounced city typeahead backed by the `city-search` Edge Function. */
export function useCitySearch(debouncedQuery: string) {
  return useQuery({
    queryKey: profileKeys.city(debouncedQuery.trim().toLowerCase()),
    queryFn: () => searchCities(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 60_000,
  });
}

/** Verifiers of a parking (for the "who verified" modal). */
export function useParkingVerifiers(parkingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.verifiers(parkingId ?? ''),
    queryFn: () => fetchParkingVerifiers(parkingId as string),
    enabled: !!parkingId && enabled,
    staleTime: 30_000,
  });
}

function invalidateIdentity(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: profileKeys.all });
  // The new nick/avatar shows up in ranking and comments.
  void queryClient.invalidateQueries({ queryKey: ['ranking'] });
  void queryClient.invalidateQueries({ queryKey: ['comments'] });
}

/** Saves nick + city; refreshes profile, ranking and comments on success. */
export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(userId, input),
    onSuccess: () => invalidateIdentity(queryClient),
  });
}

/** Uploads a new avatar; refreshes profile, ranking and comments on success. */
export function useUploadAvatar(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uri: string) => uploadAvatar(userId, uri),
    onSuccess: () => invalidateIdentity(queryClient),
  });
}
