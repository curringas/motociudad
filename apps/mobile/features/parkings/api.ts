import { supabase } from '@/lib/supabase';
import type { NearbyParking } from '@/types/domain';
import type { ProposeParkingInput } from './schemas';

/**
 * Fetches parkings within `radiusM` metres of the given centre point.
 * Delegates to the PostgreSQL function `nearby_parkings` which uses PostGIS.
 */
export async function getNearbyParkings(
  center: { lat: number; lng: number },
  radiusM = 2000,
  filter?: string,
  onlyVerified = false,
): Promise<NearbyParking[]> {
  const { data, error } = await supabase.rpc('nearby_parkings', {
    in_lat: center.lat,
    in_lng: center.lng,
    in_radius_m: radiusM,
    in_filter: filter ?? null,
    in_only_verified: onlyVerified,
    in_limit: 200,
  });

  if (error) throw error;
  return (data ?? []) as NearbyParking[];
}

/**
 * Fetches the full detail of a single parking by id.
 */
export async function getParkingById(id: string) {
  const { data, error } = await supabase
    .from('parkings')
    .select(
      `
      id,
      name,
      type,
      status,
      location,
      city,
      capacity,
      features,
      notes,
      proposed_by,
      created_at,
      parking_verifications(count),
      parking_photos(id, storage_path)
    `,
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) return null;

  // PostgREST returns GEOGRAPHY as GeoJSON: { type: 'Point', coordinates: [lng, lat] }
  const coords = (data.location as { coordinates?: [number, number] } | null)?.coordinates;
  return {
    ...data,
    lat: coords?.[1] ?? null,
    lng: coords?.[0] ?? null,
  };
}

/**
 * Propone un nuevo parking. Delega a la Edge Function propose-parking
 * que inserta el parking y registra el evento Octanos con service_role.
 * Devuelve el id del parking creado y los Octanos ganados.
 */
export async function proposeParking(
  payload: ProposeParkingInput & { photo_storage_path?: string },
): Promise<{ id: string; octanos_earned: number }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;

  if (!jwt) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    data: { id: string; octanos_earned: number };
  }>('propose-parking', {
    body: payload,
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (error) throw error;
  if (!data?.success || !data.data) {
    throw new Error('No se pudo crear el parking');
  }

  return data.data;
}

/**
 * Checks whether any parking exists within `radiusM` metres of the given coords.
 * Used to warn the user about potential duplicates before proposing.
 */
export async function checkForNearbyDuplicates(
  lat: number,
  lng: number,
  radiusM = 30,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('nearby_parkings', {
    in_lat: lat,
    in_lng: lng,
    in_radius_m: radiusM,
    in_filter: null,
    in_only_verified: false,
    in_limit: 1,
  });

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}
