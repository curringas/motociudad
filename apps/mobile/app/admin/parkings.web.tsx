// Sección Parkings del panel (contributor / admin).
// Listar y filtrar · crear · editar (por propiedad) · verificar/borrar (admin) · fotos.
import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrentProfile, useAdminParkings, useCreateParking, useUpdateParking, useSetParkingStatus, useSoftDeleteParking, useParkingPhotos, useUploadParkingPhoto } from '@/features/admin/hooks';
import {
  canEditParking,
  canChangeParkingStatus,
  canDeleteParking,
  canManageUsers,
  canAddPhoto,
} from '@/features/admin/permissions';
import { createParkingSchema, editParkingSchema, type AdminParking, type AdminProfile, type ParkingFilter } from '@/features/admin/schemas';
import { C, Card, Button, Field, Chips, StatusBadge, Spinner, Banner } from '@/features/admin/ui';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'verified', label: 'Verificado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'archived', label: 'Archivado' },
] as const;

const TYPE_OPTIONS = [
  { value: 'public', label: 'Público' },
  { value: 'private', label: 'Privado' },
] as const;

function pickImageFile(onPick: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) onPick(f);
  };
  input.click();
}

export default function AdminParkingsWeb() {
  const { data: profile } = useCurrentProfile();
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<ParkingFilter['status']>('all');
  const [scope, setScope] = useState<ParkingFilter['scope']>('all');
  const [creating, setCreating] = useState(false);

  const debouncedCity = useDebounce(city, 400);
  const filter: ParkingFilter = { city: debouncedCity, status, scope };
  const { data: parkings, isLoading, isError, error } = useAdminParkings(filter, profile?.id);

  const isAdmin = canManageUsers(profile); // admin activo
  const scopeOptions = isAdmin
    ? ([{ value: 'all', label: 'Todos' }] as const)
    : ([{ value: 'all', label: 'Todos' }, { value: 'mine', label: 'Solo míos' }] as const);

  return (
    <View style={{ gap: 16, maxWidth: 960, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>Parkings</Text>
        <Button label={creating ? 'Cancelar' : '+ Nuevo parking'} variant={creating ? 'secondary' : 'primary'} onPress={() => setCreating((v) => !v)} />
      </View>

      {creating && profile ? (
        <CreateParkingForm onDone={() => setCreating(false)} />
      ) : null}

      {/* Filtros */}
      <Card>
        <View style={{ gap: 12 }}>
          <Field label="Ciudad" value={city} onChangeText={setCity} placeholder="Filtrar por ciudad…" />
          <View style={{ gap: 6 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Estado</Text>
            <Chips options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          </View>
          {!isAdmin ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Ámbito</Text>
              <Chips options={scopeOptions} value={scope} onChange={setScope} />
            </View>
          ) : null}
        </View>
      </Card>

      {isLoading ? <Spinner label="Cargando parkings…" /> : null}
      {isError ? <Banner kind="error">Error al cargar: {(error as Error)?.message}</Banner> : null}
      {parkings && parkings.length === 0 ? (
        <Banner kind="info">No hay parkings que coincidan con el filtro.</Banner>
      ) : null}

      <View style={{ gap: 12 }}>
        {parkings?.map((p) => (
          <ParkingRow key={p.id} parking={p} profile={profile ?? null} />
        ))}
      </View>
    </View>
  );
}

function CreateParkingForm({ onDone }: { onDone: () => void }) {
  const createMut = useCreateParking();
  const [name, setName] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [cityVal, setCityVal] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    const parsed = createParkingSchema.safeParse({
      name,
      type,
      city: cityVal,
      latitude: Number(lat),
      longitude: Number(lng),
    });
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }
    createMut.mutate(parsed.data, {
      onSuccess: onDone,
      onError: (e) => setErr((e as Error).message),
    });
  };

  return (
    <Card>
      <View style={{ gap: 12 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>Nuevo parking</Text>
        <Banner kind="info">Crear desde el panel no otorga Octanos. El parking queda en estado pendiente.</Banner>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Nombre del parking" />
        <View style={{ gap: 6 }}>
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Tipo</Text>
          <Chips options={TYPE_OPTIONS} value={type} onChange={setType} />
        </View>
        <Field label="Ciudad" value={cityVal} onChangeText={setCityVal} placeholder="Ciudad" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Latitud" value={lat} onChangeText={setLat} placeholder="40.4168" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Longitud" value={lng} onChangeText={setLng} placeholder="-3.7038" keyboardType="numeric" />
          </View>
        </View>
        {err ? <Banner kind="error">{err}</Banner> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Crear" onPress={submit} loading={createMut.isPending} />
          <Button label="Cancelar" variant="secondary" onPress={onDone} />
        </View>
      </View>
    </Card>
  );
}

function ParkingRow({ parking, profile }: { parking: AdminParking; profile: AdminProfile | null }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'photos'>('view');
  const statusMut = useSetParkingStatus();
  const deleteMut = useSoftDeleteParking();

  const canEdit = canEditParking(profile, parking);
  const canStatus = canChangeParkingStatus(profile);
  const canDelete = canDeleteParking(profile);
  const isDeleted = parking.deleted_at !== null;

  return (
    <Card>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{parking.name}</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>
              {parking.city} · {parking.type === 'public' ? 'Público' : 'Privado'} · {parking.verifications_count} verif.
            </Text>
          </View>
          <StatusBadge status={parking.status} deleted={isDeleted} />
        </View>

        {/* Acciones */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {canEdit && !isDeleted ? (
            <Button label={mode === 'edit' ? 'Cerrar edición' : 'Editar'} variant="secondary" onPress={() => setMode(mode === 'edit' ? 'view' : 'edit')} />
          ) : null}
          {canEdit && !isDeleted ? (
            <Button label={mode === 'photos' ? 'Cerrar fotos' : 'Fotos'} variant="secondary" onPress={() => setMode(mode === 'photos' ? 'view' : 'photos')} />
          ) : null}
          {canStatus && !isDeleted && parking.status !== 'verified' ? (
            <Button label="Verificar" onPress={() => statusMut.mutate({ id: parking.id, status: 'verified' })} loading={statusMut.isPending} />
          ) : null}
          {canStatus && !isDeleted && parking.status !== 'rejected' ? (
            <Button label="Rechazar" variant="secondary" onPress={() => statusMut.mutate({ id: parking.id, status: 'rejected' })} />
          ) : null}
          {canStatus && !isDeleted && parking.status !== 'archived' ? (
            <Button label="Archivar" variant="secondary" onPress={() => statusMut.mutate({ id: parking.id, status: 'archived' })} />
          ) : null}
          {canDelete && !isDeleted ? (
            <Button label="Borrar" variant="danger" onPress={() => deleteMut.mutate(parking.id)} loading={deleteMut.isPending} />
          ) : null}
        </View>

        {mode === 'edit' && canEdit ? <EditParkingForm parking={parking} onDone={() => setMode('view')} /> : null}
        {mode === 'photos' && canEdit ? <ParkingPhotos parking={parking} profile={profile} /> : null}
      </View>
    </Card>
  );
}

function EditParkingForm({ parking, onDone }: { parking: AdminParking; onDone: () => void }) {
  const updateMut = useUpdateParking();
  const [name, setName] = useState(parking.name);
  const [type, setType] = useState<'public' | 'private'>(parking.type);
  const [cityVal, setCityVal] = useState(parking.city);
  const [capacity, setCapacity] = useState(parking.capacity != null ? String(parking.capacity) : '');
  const [notes, setNotes] = useState(parking.notes ?? '');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    const parsed = editParkingSchema.safeParse({
      name,
      type,
      city: cityVal,
      capacity: capacity === '' ? null : Number(capacity),
      notes: notes === '' ? null : notes,
    });
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Datos inválidos');
      return;
    }
    updateMut.mutate({ id: parking.id, fields: parsed.data }, { onSuccess: onDone, onError: (e) => setErr((e as Error).message) });
  };

  return (
    <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
      <Field label="Nombre" value={name} onChangeText={setName} />
      <View style={{ gap: 6 }}>
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>Tipo</Text>
        <Chips options={TYPE_OPTIONS} value={type} onChange={setType} />
      </View>
      <Field label="Ciudad" value={cityVal} onChangeText={setCityVal} />
      <Field label="Capacidad" value={capacity} onChangeText={setCapacity} placeholder="p. ej. 20" keyboardType="numeric" />
      <Field label="Notas" value={notes} onChangeText={setNotes} multiline />
      {err ? <Banner kind="error">{err}</Banner> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Guardar" onPress={submit} loading={updateMut.isPending} />
        <Button label="Cancelar" variant="secondary" onPress={onDone} />
      </View>
    </View>
  );
}

function ParkingPhotos({ parking, profile }: { parking: AdminParking; profile: AdminProfile | null }) {
  const { data: photos, isLoading } = useParkingPhotos(parking.id);
  const uploadMut = useUploadParkingPhoto();
  const [err, setErr] = useState<string | null>(null);
  const canUpload = canAddPhoto(profile, parking);

  const onUpload = () => {
    setErr(null);
    pickImageFile((file) => {
      uploadMut.mutate({ parkingId: parking.id, file }, { onError: (e) => setErr((e as Error).message) });
    });
  };

  return (
    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>Imágenes</Text>
        {canUpload ? <Button label="Añadir imagen" variant="secondary" onPress={onUpload} loading={uploadMut.isPending} /> : null}
      </View>
      {err ? <Banner kind="error">{err}</Banner> : null}
      {isLoading ? <Spinner /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos?.map((ph) => (
          <Image key={ph.id} source={{ uri: ph.url }} style={{ width: 96, height: 96, borderRadius: 8, backgroundColor: C.surface2 }} />
        ))}
        {photos && photos.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 13 }}>Sin imágenes.</Text>
        ) : null}
      </View>
    </View>
  );
}
