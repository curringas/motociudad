import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parkingKeys } from '@/features/parkings/hooks';
import {
  submitVerification,
  uploadVerificationPhoto,
  type VerificationPayload,
} from './api';

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
