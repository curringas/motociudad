// Sección Comentarios del panel (gestión completa, solo admin).
// Lista approved + pending_review; por defecto pendientes. Búsqueda + filtro por
// ciudad, selección múltiple + acciones en bloque, paginación.
// OpenSpec: changes/admin-comments-management.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Redirect } from 'expo-router';
import { useDebounce } from '@/hooks/useDebounce';
import { formatRelativeTime } from '@/features/comments/presenter';
import {
  useCurrentProfile,
  useAdminComments,
  useAdminCommentCities,
  useApproveComments,
  useDeleteComments,
} from '@/features/admin/hooks';
import { ADMIN_COMMENTS_PAGE_SIZE } from '@/features/admin/api';
import { canManageUsers } from '@/features/admin/permissions';
import type { CommentStatusFilter } from '@/features/admin/schemas';
import { CommentRow } from '@/features/admin/components/CommentRow';
import {
  C, Chips, SearchInput, Checkbox, BulkBar, Pagination, Button, Banner, Spinner,
} from '@/features/admin/ui';

const STATUS_TABS: readonly { value: CommentStatusFilter; label: string }[] = [
  { value: 'pending_review', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'all', label: 'Todos' },
];

export default function AdminCommentsWeb() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const isAdmin = canManageUsers(profile);

  const [status, setStatus] = useState<CommentStatusFilter>('pending_review');
  const [city, setCity] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  // Reset de página al cambiar cualquier filtro.
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [status, city, debouncedSearch]);

  const filter = { status, city: city || null, search: debouncedSearch, page };
  const { data, isLoading, isError, error } = useAdminComments(filter, isAdmin);
  const { data: cities = [] } = useAdminCommentCities(isAdmin);
  const approve = useApproveComments();
  const del = useDeleteComments();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const cityOptions = useMemo(
    () => [{ value: '', label: 'Todas' }, ...cities.map((c) => ({ value: c, label: c }))],
    [cities],
  );

  if (!profileLoading && !isAdmin) return <Redirect href="/admin/parkings" />;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) =>
      allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)),
    );

  const run = (fn: Promise<unknown>, done: () => void) => {
    setErr(null);
    fn.then(done).catch((e) => setErr((e as Error).message));
  };
  const approveIds = (ids: string[]) => run(approve.mutateAsync(ids), () => setSelected(new Set()));
  const deleteIds = (ids: string[]) => {
    if (typeof window !== 'undefined' &&
        !window.confirm(`¿Eliminar ${ids.length} comentario(s)? Se retiran sus Octanos. No se puede deshacer.`)) return;
    run(del.mutateAsync(ids), () => setSelected(new Set()));
  };

  const busy = approve.isPending || del.isPending;
  const selectedIds = Array.from(selected);

  return (
    <View style={{ gap: 14, maxWidth: 860, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>Comentarios</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>
          Gestiona los comentarios: aprueba los pendientes o elimínalos.
        </Text>
      </View>

      {/* Toolbar */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chips options={STATUS_TABS} value={status} onChange={setStatus} />
          <SearchInput value={search} onChangeText={setSearch} placeholder="Buscar por texto, autor o parking…" />
        </View>
        {cities.length > 0 ? (
          <Chips options={cityOptions} value={city} onChange={setCity} />
        ) : null}
      </View>

      {err ? <Banner kind="error">{err}</Banner> : null}

      {/* Selección + bloque */}
      {rows.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Checkbox checked={allVisibleSelected} onToggle={toggleAll} label="Seleccionar todos" />
          <Text style={{ color: C.muted, fontSize: 12 }}>Seleccionar todos</Text>
        </View>
      ) : null}
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button label={`Aprobar (${selected.size})`} onPress={() => approveIds(selectedIds)} loading={approve.isPending} />
        <Button label={`Eliminar (${selected.size})`} variant="danger" onPress={() => deleteIds(selectedIds)} loading={del.isPending} />
      </BulkBar>

      {/* Listado */}
      {isLoading ? (
        <Spinner label="Cargando comentarios…" />
      ) : isError ? (
        <Banner kind="error">Error al cargar: {(error as Error)?.message}</Banner>
      ) : rows.length === 0 ? (
        <Banner kind="info">No hay comentarios que coincidan.</Banner>
      ) : (
        <View>
          {rows.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              checked={selected.has(c.id)}
              onToggle={() => toggle(c.id)}
              onApprove={() => approveIds([c.id])}
              onDelete={() => deleteIds([c.id])}
              busy={busy}
            />
          ))}
        </View>
      )}

      <Pagination page={page} pageSize={ADMIN_COMMENTS_PAGE_SIZE} total={total} onPage={setPage} />
    </View>
  );
}
