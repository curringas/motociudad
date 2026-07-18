import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '@/stores/sessionStore';
import { parkingKeys } from '@/features/parkings/hooks';
import {
  getProfile,
  getLevelName,
  listUsers,
  setUserRole,
  listParkings,
  createParking,
  updateParking,
  setParkingStatus,
  softDeleteParking,
  listParkingPhotos,
  uploadParkingPhoto,
} from './api';
import type {
  UserFilter,
  ParkingFilter,
  SetRoleInput,
  CreateParkingInput,
  EditParkingInput,
} from './schemas';

export const adminKeys = {
  all: ['admin'] as const,
  profile: (userId: string | undefined) => [...adminKeys.all, 'profile', userId ?? 'anon'] as const,
  users: (filter: UserFilter) => [...adminKeys.all, 'users', filter] as const,
  levelName: (level: number) => [...adminKeys.all, 'level', level] as const,
  parkings: (filter: ParkingFilter, actorId: string) =>
    [...adminKeys.all, 'parkings', actorId, filter] as const,
  photos: (parkingId: string) => [...adminKeys.all, 'photos', parkingId] as const,
};

/** Perfil (con role/suspended) del usuario autenticado. */
export function useCurrentProfile() {
  const userId = useSessionStore((s) => s.user?.id);
  return useQuery({
    queryKey: adminKeys.profile(userId),
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useAdminUsers(filter: UserFilter, enabled = true) {
  return useQuery({
    queryKey: adminKeys.users(filter),
    queryFn: () => listUsers(filter),
    enabled,
    staleTime: 15_000,
  });
}

export function useLevelName(level: number | undefined) {
  return useQuery({
    queryKey: adminKeys.levelName(level ?? -1),
    queryFn: () => getLevelName(level!),
    enabled: level !== undefined,
    staleTime: 5 * 60_000,
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetRoleInput) => setUserRole(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'users'] });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'profile'] });
    },
  });
}

export function useAdminParkings(filter: ParkingFilter, actorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: adminKeys.parkings(filter, actorId ?? 'anon'),
    queryFn: () => listParkings(filter, actorId!),
    enabled: enabled && !!actorId,
    staleTime: 15_000,
  });
}

function invalidateParkings(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'parkings'] });
  // El mapa/lista de la app también dependen de parkings.
  void queryClient.invalidateQueries({ queryKey: parkingKeys.all });
}

export function useCreateParking() {
  const queryClient = useQueryClient();
  const actorId = useSessionStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (input: CreateParkingInput) => {
      if (!actorId) throw new Error('Usuario no autenticado');
      return createParking(input, actorId);
    },
    onSuccess: () => invalidateParkings(queryClient),
  });
}

export function useUpdateParking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: EditParkingInput }) =>
      updateParking(id, fields),
    onSuccess: () => invalidateParkings(queryClient),
  });
}

export function useSetParkingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'verified' | 'rejected' | 'archived' | 'pending' }) =>
      setParkingStatus(id, status),
    onSuccess: () => invalidateParkings(queryClient),
  });
}

export function useSoftDeleteParking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteParking(id),
    onSuccess: () => invalidateParkings(queryClient),
  });
}

export function useParkingPhotos(parkingId: string | undefined) {
  return useQuery({
    queryKey: adminKeys.photos(parkingId ?? ''),
    queryFn: () => listParkingPhotos(parkingId!),
    enabled: !!parkingId,
    staleTime: 15_000,
  });
}

export function useUploadParkingPhoto() {
  const queryClient = useQueryClient();
  const actorId = useSessionStore((s) => s.user?.id);
  return useMutation({
    mutationFn: ({ parkingId, file }: { parkingId: string; file: Blob }) => {
      if (!actorId) throw new Error('Usuario no autenticado');
      return uploadParkingPhoto(parkingId, actorId, file);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.photos(variables.parkingId) });
    },
  });
}
