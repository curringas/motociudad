// Lógica de autorización DERIVADA para la UI del panel (ocultar/deshabilitar).
// NO es la fuente de verdad: la seguridad real vive en RLS + Edge Function.
// Estas funciones son puras (sin dependencias de RN/Supabase) para poder
// probarlas en un entorno node (vitest.web.config.ts).
import type { AdminProfile, AdminParking, UserFilter, ParkingFilter } from './schemas';

/** Identidad mínima necesaria para derivar permisos. */
export type ActorLike = Pick<AdminProfile, 'id' | 'role' | 'suspended'>;
export type ParkingOwnership = Pick<AdminParking, 'proposed_by'>;

/** admin o contributor, en ambos casos NO suspendido. */
export function canAccessPanel(actor: ActorLike | null | undefined): boolean {
  if (!actor || actor.suspended) return false;
  return actor.role === 'admin' || actor.role === 'contributor';
}

/** Solo admin activo gestiona usuarios y ve la sección Usuarios. */
export function canManageUsers(actor: ActorLike | null | undefined): boolean {
  return !!actor && !actor.suspended && actor.role === 'admin';
}

/** Admin edita cualquier parking; contributor solo los suyos (por propiedad). */
export function canEditParking(
  actor: ActorLike | null | undefined,
  parking: ParkingOwnership,
): boolean {
  if (!actor || actor.suspended) return false;
  if (actor.role === 'admin') return true;
  return actor.role === 'contributor' && parking.proposed_by === actor.id;
}

/** Añadir imágenes sigue la misma regla de propiedad que editar. */
export function canAddPhoto(
  actor: ActorLike | null | undefined,
  parking: ParkingOwnership,
): boolean {
  return canEditParking(actor, parking);
}

/** Verificar / cambiar el status de un parking: solo admin activo. */
export function canChangeParkingStatus(actor: ActorLike | null | undefined): boolean {
  return !!actor && !actor.suspended && actor.role === 'admin';
}

/** Borrar / archivar (deleted_at): solo admin activo. */
export function canDeleteParking(actor: ActorLike | null | undefined): boolean {
  return canChangeParkingStatus(actor);
}

/** Crear parkings desde el panel: admin o contributor activo. */
export function canCreateParking(actor: ActorLike | null | undefined): boolean {
  return canAccessPanel(actor);
}

// ── Filtros puros (búsqueda/estado en cliente) ───────────────

/** Filtra usuarios por texto (username/display_name) y por rol. */
export function filterUsers<T extends Pick<AdminProfile, 'username' | 'display_name' | 'role'>>(
  users: readonly T[],
  filter: Pick<UserFilter, 'search' | 'role'>,
): T[] {
  const q = filter.search.trim().toLowerCase();
  return users.filter((u) => {
    const matchesRole = filter.role === 'all' || u.role === filter.role;
    const matchesText =
      q === '' ||
      u.username.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q);
    return matchesRole && matchesText;
  });
}

/** Filtra parkings por ciudad (substring) y por estado. */
export function filterParkings<T extends Pick<AdminParking, 'city' | 'status'>>(
  parkings: readonly T[],
  filter: Pick<ParkingFilter, 'city' | 'status'>,
): T[] {
  const c = filter.city.trim().toLowerCase();
  return parkings.filter((p) => {
    const matchesCity = c === '' || p.city.toLowerCase().includes(c);
    const matchesStatus = filter.status === 'all' || p.status === filter.status;
    return matchesCity && matchesStatus;
  });
}
