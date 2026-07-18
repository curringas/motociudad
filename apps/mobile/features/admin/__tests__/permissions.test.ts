import { describe, it, expect } from 'vitest';
import {
  canAccessPanel,
  canManageUsers,
  canEditParking,
  canAddPhoto,
  canChangeParkingStatus,
  canDeleteParking,
  canCreateParking,
  filterUsers,
  filterParkings,
  type ActorLike,
} from '../permissions';

const admin: ActorLike = { id: 'a1', role: 'admin', suspended: false };
const contributor: ActorLike = { id: 'c1', role: 'contributor', suspended: false };
const user: ActorLike = { id: 'u1', role: 'user', suspended: false };
const suspendedAdmin: ActorLike = { id: 'a2', role: 'admin', suspended: true };
const suspendedContrib: ActorLike = { id: 'c2', role: 'contributor', suspended: true };

describe('canAccessPanel', () => {
  it('permite admin y contributor activos', () => {
    expect(canAccessPanel(admin)).toBe(true);
    expect(canAccessPanel(contributor)).toBe(true);
  });
  it('deniega user, suspendidos y null', () => {
    expect(canAccessPanel(user)).toBe(false);
    expect(canAccessPanel(suspendedAdmin)).toBe(false);
    expect(canAccessPanel(suspendedContrib)).toBe(false);
    expect(canAccessPanel(null)).toBe(false);
    expect(canAccessPanel(undefined)).toBe(false);
  });
});

describe('canManageUsers', () => {
  it('solo admin activo', () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(contributor)).toBe(false);
    expect(canManageUsers(user)).toBe(false);
    expect(canManageUsers(suspendedAdmin)).toBe(false);
    expect(canManageUsers(null)).toBe(false);
  });
});

describe('canEditParking / canAddPhoto (por propiedad)', () => {
  const own = { proposed_by: 'c1' };
  const other = { proposed_by: 'zzz' };

  it('admin edita cualquiera', () => {
    expect(canEditParking(admin, own)).toBe(true);
    expect(canEditParking(admin, other)).toBe(true);
  });
  it('contributor solo los suyos', () => {
    expect(canEditParking(contributor, own)).toBe(true);
    expect(canEditParking(contributor, other)).toBe(false);
  });
  it('user nunca; suspendido nunca', () => {
    expect(canEditParking(user, own)).toBe(false);
    expect(canEditParking(suspendedContrib, { proposed_by: 'c2' })).toBe(false);
    expect(canEditParking(suspendedAdmin, other)).toBe(false);
  });
  it('canAddPhoto sigue la misma regla', () => {
    expect(canAddPhoto(contributor, own)).toBe(true);
    expect(canAddPhoto(contributor, other)).toBe(false);
    expect(canAddPhoto(admin, other)).toBe(true);
  });
});

describe('verificar / borrar / crear', () => {
  it('verificar y borrar: solo admin activo', () => {
    expect(canChangeParkingStatus(admin)).toBe(true);
    expect(canChangeParkingStatus(contributor)).toBe(false);
    expect(canDeleteParking(admin)).toBe(true);
    expect(canDeleteParking(contributor)).toBe(false);
    expect(canDeleteParking(suspendedAdmin)).toBe(false);
  });
  it('crear: admin o contributor activos', () => {
    expect(canCreateParking(admin)).toBe(true);
    expect(canCreateParking(contributor)).toBe(true);
    expect(canCreateParking(user)).toBe(false);
  });
});

describe('filterUsers', () => {
  const users = [
    { username: 'curro', display_name: 'Curro Martínez', role: 'admin' as const },
    { username: 'ana_moto', display_name: 'Ana López', role: 'contributor' as const },
    { username: 'pepe', display_name: 'Pepe Gómez', role: 'user' as const },
  ];

  it('sin filtros devuelve todo', () => {
    expect(filterUsers(users, { search: '', role: 'all' })).toHaveLength(3);
  });
  it('busca por username o display_name (case-insensitive)', () => {
    expect(filterUsers(users, { search: 'CURRO', role: 'all' }).map((u) => u.username)).toEqual(['curro']);
    expect(filterUsers(users, { search: 'lópez', role: 'all' }).map((u) => u.username)).toEqual(['ana_moto']);
  });
  it('filtra por rol', () => {
    expect(filterUsers(users, { search: '', role: 'contributor' }).map((u) => u.username)).toEqual(['ana_moto']);
  });
  it('combina texto y rol', () => {
    expect(filterUsers(users, { search: 'a', role: 'user' }).map((u) => u.username)).toEqual([]);
  });
});

describe('filterParkings', () => {
  const parkings = [
    { city: 'Madrid', status: 'verified' as const },
    { city: 'Madrid', status: 'pending' as const },
    { city: 'Barcelona', status: 'verified' as const },
  ];

  it('filtra por ciudad (substring, case-insensitive)', () => {
    expect(filterParkings(parkings, { city: 'madr', status: 'all' })).toHaveLength(2);
  });
  it('filtra por estado', () => {
    expect(filterParkings(parkings, { city: '', status: 'pending' })).toHaveLength(1);
  });
  it('combina ciudad y estado', () => {
    expect(filterParkings(parkings, { city: 'barcelona', status: 'verified' })).toHaveLength(1);
    expect(filterParkings(parkings, { city: 'barcelona', status: 'pending' })).toHaveLength(0);
  });
});
