import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
  adminProfileSchema,
  adminParkingSchema,
  type AdminProfile,
  type AdminParking,
  type UserFilter,
  type ParkingFilter,
  type SetRoleInput,
  type CreateParkingInput,
  type EditParkingInput,
} from './schemas';

// Columnas del perfil que usa el panel.
const PROFILE_COLUMNS =
  'id, username, display_name, role, suspended, suspended_reason, current_level, total_octanos, octanos_this_month';

// Columnas del listado de parkings del panel.
const PARKING_COLUMNS =
  'id, name, type, status, city, address, district, capacity, notes, features, proposed_by, verifications_count, deleted_at, created_at';

const STORAGE_BUCKET = 'parkings-photos';

/** Perfil del usuario autenticado (incluye role/suspended). */
export async function getProfile(userId: string): Promise<AdminProfile> {
  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw error;
  return adminProfileSchema.parse(data);
}

/** Lista usuarios con búsqueda (username/display_name) y filtro por rol. */
export async function listUsers(filter: UserFilter): Promise<AdminProfile[]> {
  let query = supabase.from('users').select(PROFILE_COLUMNS).order('created_at', { ascending: false });

  const search = filter.search.trim();
  if (search !== '') {
    query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
  }
  if (filter.role !== 'all') {
    query = query.eq('role', filter.role);
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return z.array(adminProfileSchema).parse(data ?? []);
}

/** Nombre del nivel del catálogo user_levels para un nivel dado. */
export async function getLevelName(level: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_levels')
    .select('name')
    .eq('level', level)
    .maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}

/**
 * Cambia rol/suspensión vía la Edge Function privilegiada. Nunca UPDATE directo
 * (el trigger trg_users_privileged_fields lo rechazaría igualmente).
 */
export async function setUserRole(input: SetRoleInput): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) throw new Error('Usuario no autenticado');

  const { error } = await supabase.functions.invoke('admin-set-role', {
    body: input,
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? 'No se pudo actualizar el usuario');
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
      }
    }
    throw new Error(error.message);
  }
}

/**
 * Lista parkings. Admin ve todos (incluidos borrados/archivados vía
 * parkings_read_admin); contributor puede acotar a los suyos con scope='mine'.
 */
export async function listParkings(
  filter: ParkingFilter,
  actorId: string,
): Promise<AdminParking[]> {
  let query = supabase.from('parkings').select(PARKING_COLUMNS).order('created_at', { ascending: false });

  if (filter.scope === 'mine') {
    query = query.eq('proposed_by', actorId);
  }
  const city = filter.city.trim();
  if (city !== '') {
    query = query.ilike('city', `%${city}%`);
  }
  if (filter.status !== 'all') {
    query = query.eq('status', filter.status);
  }

  const { data, error } = await query.limit(300);
  if (error) throw error;
  return z.array(adminParkingSchema).parse(data ?? []);
}

/**
 * Crea un parking desde el panel. NO genera Octanos (inserción directa, sin
 * pasar por la Edge Function propose-parking). proposed_by = el creador.
 */
export async function createParking(
  input: CreateParkingInput,
  actorId: string,
): Promise<AdminParking> {
  const { data, error } = await supabase
    .from('parkings')
    .insert({
      proposed_by: actorId,
      name: input.name,
      type: input.type,
      status: 'pending',
      city: input.city,
      address: input.address ?? null,
      district: input.district ?? null,
      capacity: input.capacity ?? null,
      notes: input.notes ?? null,
      features: input.features ?? {},
      // PostGIS geography vía EWKT (lng lat).
      location: `SRID=4326;POINT(${input.longitude} ${input.latitude})`,
    })
    .select(PARKING_COLUMNS)
    .single();
  if (error) throw error;
  return adminParkingSchema.parse(data);
}

/** Edita campos de un parking (sin tocar status ni ubicación). */
export async function updateParking(
  id: string,
  fields: EditParkingInput,
): Promise<AdminParking> {
  const { data, error } = await supabase
    .from('parkings')
    .update(fields)
    .eq('id', id)
    .select(PARKING_COLUMNS)
    .single();
  if (error) throw error;
  return adminParkingSchema.parse(data);
}

/** Cambia el status (verificar/rechazar/archivar). Solo admin (RLS + trigger). */
export async function setParkingStatus(
  id: string,
  status: 'verified' | 'rejected' | 'archived' | 'pending',
): Promise<void> {
  const { error } = await supabase.from('parkings').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Borrado lógico (deleted_at). Solo admin (RLS + trigger). */
export async function softDeleteParking(id: string): Promise<void> {
  const { error } = await supabase
    .from('parkings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export type ParkingPhoto = { id: string; storage_path: string; url: string };

/** Fotos de un parking con su URL pública. */
export async function listParkingPhotos(parkingId: string): Promise<ParkingPhoto[]> {
  const { data, error } = await supabase
    .from('parking_photos')
    .select('id, storage_path')
    .eq('parking_id', parkingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
  }));
}

/**
 * Sube una imagen a Storage y registra la fila en parking_photos.
 * `file` es un File/Blob del navegador. Respeta la propiedad vía RLS.
 */
export async function uploadParkingPhoto(
  parkingId: string,
  actorId: string,
  file: Blob,
): Promise<void> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `parkings/${parkingId}/${actorId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('parking_photos').insert({
    parking_id: parkingId,
    uploaded_by: actorId,
    storage_path: path,
    is_verification: false,
  });
  if (insertError) throw insertError;
}
