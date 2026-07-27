import { z } from 'zod';

/**
 * Nick (@handle) format: 3–30 chars, letters/digits and the separators _ . -
 * Mirrors the DB CHECK constraint `users_username_format_chk`.
 */
export const NICK_REGEX = /^[A-Za-z0-9_.-]{3,30}$/;

export const nickSchema = z
  .string()
  .trim()
  .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
  .max(30, 'El nombre de usuario no puede superar los 30 caracteres')
  .regex(
    /^[A-Za-z0-9_.-]+$/,
    'Solo letras, números y los símbolos _ . -',
  );

/** A city suggestion returned by the `city-search` Edge Function. */
export const citySuggestionSchema = z.object({
  name: z.string(),
  region: z.string().nullable(),
  country: z.string(),
  country_code: z.string(),
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
});
export type CitySuggestion = z.infer<typeof citySuggestionSchema>;

export const citySearchResponseSchema = z.object({
  results: z.array(citySuggestionSchema),
});

/** The signed-in user's own profile row. */
export const myProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  city_primary: z.string().nullable(),
  current_level: z.number().int().nullable(),
  total_octanos: z.number().int().nullable(),
  octanos_this_month: z.number().int().nullable(),
  ranking_visible: z.boolean().nullable(),
});
export type MyProfile = z.infer<typeof myProfileSchema>;

/** A public profile as seen by other users. */
export const publicProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  city_primary: z.string().nullable(),
  current_level: z.number().int().nullable(),
  total_octanos: z.number().int().nullable(),
  ranking_visible: z.boolean().nullable(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** Input for the profile edit form. `city` is null when the user clears it. */
export type UpdateProfileInput = {
  nick: string;
  city: string | null;
};
