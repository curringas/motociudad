import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import {
  citySearchResponseSchema,
  myProfileSchema,
  publicProfileSchema,
  type CitySuggestion,
  type MyProfile,
  type PublicProfile,
  type UpdateProfileInput,
} from './schemas';

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_SIZE = 512;

/** Friendly message when a nick collides (unique_violation) or is malformed. */
export const NICK_TAKEN_MESSAGE = 'Ese nick ya está en uso. Prueba con otro.';
const NICK_FORMAT_MESSAGE =
  'El nombre de usuario no tiene un formato válido (3–30, letras, números y _ . -).';

const PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, city_primary, current_level, total_octanos, octanos_this_month, ranking_visible';

/** Reads the signed-in user's own profile row, or null when unauthenticated. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', uid)
    .single();
  if (error) throw error;
  return myProfileSchema.parse(data);
}

/** Reads any user's public profile by id. */
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, username, display_name, avatar_url, city_primary, current_level, total_octanos, ranking_visible',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return publicProfileSchema.parse(data);
}

/**
 * Case-insensitive availability pre-check for live feedback. The DB unique
 * index is the source of truth; this only avoids an obvious round-trip.
 */
export async function checkNickAvailable(
  nick: string,
  currentUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('username', nick)
    .neq('id', currentUserId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length === 0;
}

/**
 * Updates the profile row via RLS (`users_self_update`). The single "nick"
 * value is written to both `username` and `display_name` so it drives the
 * public identity everywhere. Maps DB constraint errors to friendly messages.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<void> {
  const nick = input.nick.trim();
  const { error } = await supabase
    .from('users')
    .update({
      username: nick,
      display_name: nick,
      city_primary: input.city,
    })
    .eq('id', userId);

  if (error) {
    if (error.code === '23505') throw new Error(NICK_TAKEN_MESSAGE);
    if (error.code === '23514') throw new Error(NICK_FORMAT_MESSAGE);
    throw error;
  }
}

/** Reads image bytes cross-platform (web blob vs native base64). */
async function readImageBytes(uri: string): Promise<Blob | Uint8Array> {
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    return await resp.blob();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Re-encodes and resizes the picked image (dropping EXIF and any embedded
 * payload), uploads it to the user's own avatar folder and stores the versioned
 * public URL in `avatar_url`. Returns that URL.
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_MAX_SIZE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  const bytes = await readImageBytes(manipulated.uri);
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  // Cache-busting version so the CDN/browser fetches the new image.
  const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data
    .publicUrl;
  const versioned = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: versioned })
    .eq('id', userId);
  if (updateError) throw updateError;

  return versioned;
}

/** Searches cities via the `city-search` Edge Function. */
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.functions.invoke('city-search', {
    body: { q },
  });
  if (error) throw error;
  return citySearchResponseSchema.parse(data).results;
}

/** A verifier of a parking, for the "who verified" modal. */
export type ParkingVerifier = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_first_verifier: boolean;
  created_at: string;
};

/** Lists the users who verified a parking, first verifier first. */
export async function fetchParkingVerifiers(
  parkingId: string,
): Promise<ParkingVerifier[]> {
  const { data, error } = await supabase
    .from('parking_verifications')
    .select(
      'verified_by, is_first_verifier, created_at, verifier:verified_by(username, display_name, avatar_url)',
    )
    .eq('parking_id', parkingId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const verifier = row.verifier as
      | { username: string | null; display_name: string | null; avatar_url: string | null }
      | null;
    return {
      id: row.verified_by as string,
      username: verifier?.username ?? null,
      display_name: verifier?.display_name ?? null,
      avatar_url: verifier?.avatar_url ?? null,
      is_first_verifier: Boolean(row.is_first_verifier),
      created_at: row.created_at as string,
    };
  });
}
