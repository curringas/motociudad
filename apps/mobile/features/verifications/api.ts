import { supabase } from '@/lib/supabase';

export type VerificationPayload = {
  parking_id: string;
  user_lat: number;
  user_lng: number;
  photo_taken_at: string; // ISO 8601 timestamp
  storage_path: string;
};

export type VerificationError = {
  code: string;
  message: string;
};

export type VerificationResult = {
  success: boolean;
  error?: VerificationError;
  data?: {
    octanos_earned: number;
    is_first_verifier: boolean;
    new_status: string;
  };
};

/**
 * Known error codes returned by the validate-verification Edge Function.
 * Use these constants instead of raw strings to avoid typos.
 */
export const VERIFICATION_ERROR_CODES = {
  GEOFENCE_FAIL: 'GEOFENCE_FAIL',
  STALE_PHOTO: 'STALE_PHOTO',
  SELF_VERIFICATION_FORBIDDEN: 'SELF_VERIFICATION_FORBIDDEN',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
  DAILY_CAP_REACHED: 'DAILY_CAP_REACHED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
} as const;

/**
 * Submits a verification request to the `validate-verification` Edge Function.
 *
 * All business-rule enforcement (geofence, anti-abuse, cap) happens server-side.
 * The client is responsible only for collecting accurate GPS coords, a fresh
 * photo, and uploading the photo to Storage before calling this function.
 */
export async function submitVerification(
  payload: VerificationPayload,
): Promise<VerificationResult> {
  const { data, error } = await supabase.functions.invoke<VerificationResult>(
    'validate-verification',
    { body: payload },
  );

  if (error) {
    // Network or invocation error — not a business-rule error
    throw new Error(error.message);
  }

  return data as VerificationResult;
}

/**
 * Uploads a photo to the parkings-photos Storage bucket.
 * Returns the storage path of the uploaded object.
 *
 * @param parkingId - Target parking id (used to namespace the path)
 * @param fileUri - Local file URI from expo-image-manipulator
 * @param takenAt - ISO timestamp when the photo was captured (used in the filename)
 */
export async function uploadVerificationPhoto(
  parkingId: string,
  fileUri: string,
  takenAt: string,
): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Usuario no autenticado');

  // Fetch the local file as a blob
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const timestamp = new Date(takenAt).getTime();
  const storagePath = `parkings/${parkingId}/${userId}/${timestamp}.jpg`;

  const { error } = await supabase.storage
    .from('parkings-photos')
    .upload(storagePath, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  return storagePath;
}
