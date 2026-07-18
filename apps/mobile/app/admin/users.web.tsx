// Sección Usuarios del panel (solo admin).
// Listar/buscar/filtrar · detalle (perfil, rol, estado, nivel, Octanos) ·
// cambiar rol y suspender/reactivar (vía Edge Function admin-set-role).
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrentProfile, useAdminUsers, useSetUserRole, useLevelName } from '@/features/admin/hooks';
import { canManageUsers } from '@/features/admin/permissions';
import type { AdminProfile, UserFilter, UserRole } from '@/features/admin/schemas';
import { C, Card, Button, Field, Chips, RoleBadge, StatusBadge, Spinner, Banner } from '@/features/admin/ui';

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Usuario' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'admin', label: 'Admin' },
] as const;

const ROLE_OPTIONS = [
  { value: 'user', label: 'Usuario' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'admin', label: 'Admin' },
] as const;

export default function AdminUsersWeb() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserFilter['role']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);
  const filter: UserFilter = { search: debouncedSearch, role };
  const isAdmin = canManageUsers(profile);
  const { data: users, isLoading, isError, error } = useAdminUsers(filter, isAdmin);

  // El layout ya bloquea a no-admin, pero reforzamos: contributor no ve esta sección.
  if (!profileLoading && !isAdmin) {
    return <Redirect href="/admin/parkings" />;
  }

  return (
    <View style={{ gap: 16, maxWidth: 960, width: '100%', alignSelf: 'center' }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>Usuarios</Text>

      <Card>
        <View style={{ gap: 12 }}>
          <Field label="Buscar" value={search} onChangeText={setSearch} placeholder="username o nombre…" />
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Rol</Text>
            <Chips options={ROLE_FILTER_OPTIONS} value={role} onChange={setRole} />
          </View>
        </View>
      </Card>

      {isLoading ? <Spinner label="Cargando usuarios…" /> : null}
      {isError ? <Banner kind="error">Error al cargar: {(error as Error)?.message}</Banner> : null}
      {users && users.length === 0 ? <Banner kind="info">No hay usuarios que coincidan.</Banner> : null}

      <View style={{ gap: 12 }}>
        {users?.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === profile?.id}
            expanded={selectedId === u.id}
            onToggle={() => setSelectedId(selectedId === u.id ? null : u.id)}
          />
        ))}
      </View>
    </View>
  );
}

function UserRow({ user, isSelf, expanded, onToggle }: {
  user: AdminProfile;
  isSelf: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`Detalle de ${user.username}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
              {user.display_name} <Text style={{ color: C.muted, fontWeight: '400' }}>@{user.username}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <RoleBadge role={user.role} />
              {user.suspended ? <StatusBadge status="rejected" /> : null}
            </View>
          </View>
          <Text style={{ color: C.muted }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded ? <UserDetail user={user} isSelf={isSelf} /> : null}
    </Card>
  );
}

function UserDetail({ user, isSelf }: { user: AdminProfile; isSelf: boolean }) {
  const { data: levelName } = useLevelName(user.current_level);
  const setRoleMut = useSetUserRole();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const changeRole = (newRole: UserRole) => {
    if (newRole === user.role) return;
    setErr(null);
    setRoleMut.mutate({ userId: user.id, role: newRole }, { onError: (e) => setErr((e as Error).message) });
  };

  const toggleSuspend = () => {
    setErr(null);
    setRoleMut.mutate(
      { userId: user.id, suspended: !user.suspended, suspendedReason: user.suspended ? undefined : reason || undefined },
      { onError: (e) => setErr((e as Error).message) },
    );
  };

  return (
    <View style={{ gap: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginTop: 12 }}>
      {/* Perfil / métricas */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <Metric label="Nivel" value={levelName ? `${user.current_level} · ${levelName}` : String(user.current_level)} />
        <Metric label="Octanos" value={String(user.total_octanos)} />
        <Metric label="Octanos (mes)" value={String(user.octanos_this_month)} />
        <Metric label="Estado" value={user.suspended ? 'Suspendido' : 'Activo'} />
      </View>
      {user.suspended && user.suspended_reason ? (
        <Text style={{ color: C.muted, fontSize: 13 }}>Motivo: {user.suspended_reason}</Text>
      ) : null}

      {isSelf ? (
        <Banner kind="info">No puedes cambiar tu propio rol ni tu suspensión.</Banner>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Rol</Text>
            <Chips options={ROLE_OPTIONS} value={user.role} onChange={changeRole} />
          </View>

          <View style={{ gap: 8 }}>
            {!user.suspended ? (
              <Field label="Motivo de suspensión (opcional)" value={reason} onChangeText={setReason} placeholder="p. ej. spam reiterado" />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label={user.suspended ? 'Reactivar' : 'Suspender'}
                variant={user.suspended ? 'primary' : 'danger'}
                onPress={toggleSuspend}
                loading={setRoleMut.isPending}
              />
            </View>
          </View>
        </>
      )}

      {err ? <Banner kind="error">{err}</Banner> : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: C.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
