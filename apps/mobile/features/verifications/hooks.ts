import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parkingKeys } from '@/features/parkings/hooks';
import {
  submitVerification,
  uploadVerificationPhoto,
  hasUserVerified,
  type VerificationPayload,
} from './api';

/** Query key factory for the verifications domain */
export const verificationKeys = {
  all: ['verifications'] as const,
  hasVerified: (parkingId: string, userId: string) =>
    [...verificationKeys.all, 'has', parkingId, userId] as const,
};

/**
 * Whether the current user has already verified this parking.
 * Disabled until both ids are known. Used to hide the verify CTA.
 */
export function useHasVerified(
  parkingId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: verificationKeys.hasVerified(parkingId ?? '', userId ?? ''),
    queryFn: () => hasUserVerified(parkingId as string, userId as string),
    enabled: !!parkingId && !!userId,
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for submitting a parking verification.
 * On success, invalidates the relevant parking detail query so the
 * verifications_count and last_verified_at update immediately.
 */
export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: VerificationPayload) => submitVerification(payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: parkingKeys.detail(variables.parking_id),
      });
      // Also refresh the nearby list so the verified badge updates on pins
      void queryClient.invalidateQueries({ queryKey: parkingKeys.all });
      // And the "has verified" flag so the verify CTA hides immediately
      void queryClient.invalidateQueries({ queryKey: verificationKeys.all });
    },
  });
}

/**
 * Mutation hook for uploading the verification photo to Supabase Storage.
 * Should be called before `useSubmitVerification`.
 */
export function useUploadVerificationPhoto() {
  return useMutation({
    mutationFn: ({
      parkingId,
      fileUri,
      takenAt,
    }: {
      parkingId: string;
      fileUri: string;
      takenAt: string;
    }) => uploadVerificationPhoto(parkingId, fileUri, takenAt),
  });
}
