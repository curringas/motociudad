// Primitivas de UI compartidas por el panel admin (web). Estilos en línea.
// TEMA CLARO (decisión consciente; la app móvil sigue oscura).
// OpenSpec: changes/admin-comments-management (D5).
import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';

export const C = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surface2: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#FFD60A',
  onAccent: '#111827',
  danger: '#dc2626',
  success: '#16a34a',
  info: '#2563eb',
} as const;

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <ActivityIndicator color={C.accent} />
      {label ? <Text style={{ color: C.muted }}>{label}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const bg =
    variant === 'primary' ? C.accent : variant === 'danger' ? 'transparent' : variant === 'ghost' ? 'transparent' : C.surface;
  const border = variant === 'danger' ? C.danger : variant === 'secondary' ? C.border : 'transparent';
  const fg = variant === 'primary' ? C.onAccent : variant === 'danger' ? C.danger : C.text;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        backgroundColor: bg,
        borderWidth: border === 'transparent' ? 0 : 1,
        borderColor: border,
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 14,
        opacity: isDisabled ? 0.5 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: C.surface2,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 10,
          color: C.text,
          paddingVertical: 9,
          paddingHorizontal: 12,
          fontSize: 14,
          minHeight: multiline ? 72 : undefined,
        }}
      />
    </View>
  );
}

/** Buscador sin etiqueta (icono lupa + input). */
export function SearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        minWidth: 180,
        flex: 1,
      }}
    >
      <Text style={{ color: C.muted, fontSize: 14 }}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={{ flex: 1, color: C.text, paddingVertical: 9, fontSize: 14 }}
        accessibilityLabel={placeholder ?? 'Buscar'}
      />
    </View>
  );
}

/** Segmented control (chips) — reemplaza <select> en RN-web. Sirve de tabs. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            style={{
              backgroundColor: active ? C.accent : C.surface2,
              borderWidth: 1,
              borderColor: active ? C.accent : C.border,
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: active ? C.onAccent : C.muted, fontWeight: '700', fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Casilla de selección para acciones en bloque. */
export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: checked ? C.accent : '#cbd5e1',
        backgroundColor: checked ? C.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Text style={{ color: C.onAccent, fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
    </Pressable>
  );
}

/** Barra de acciones en bloque (aparece con selección). */
export function BulkBar({
  count,
  children,
  onClear,
}: {
  count: number;
  children: React.ReactNode;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#FFD60A',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{count} seleccionados</Text>
      {children}
      <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Limpiar selección" style={{ marginLeft: 'auto' }}>
        <Text style={{ color: C.muted, fontSize: 12 }}>Limpiar</Text>
      </Pressable>
    </View>
  );
}

/** Paginación por offset: "N–M de T" + páginas. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number; // 0-indexed
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = (label: string, target: number, disabled: boolean, active = false) => (
    <Pressable
      key={label + target}
      onPress={() => !disabled && onPage(target)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Página ${label}`}
      style={{
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: active ? C.accent : C.border,
        backgroundColor: active ? C.accent : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: active ? C.onAccent : C.text, fontSize: 12, fontWeight: active ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>
        {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
      </Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {btn('‹', page - 1, page <= 0)}
        {Array.from({ length: pages }).slice(0, 6).map((_, i) => btn(String(i + 1), i, false, i === page))}
        {btn('›', page + 1, page >= pages - 1)}
      </View>
    </View>
  );
}

/** Badge genérico. */
export function Badge({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#fef3c7', fg: '#b45309', label: 'Pendiente' },
  verified: { bg: '#dcfce7', fg: '#15803d', label: 'Verificado' },
  rejected: { bg: '#fee2e2', fg: '#b91c1c', label: 'Rechazado' },
  archived: { bg: '#f1f5f9', fg: '#64748b', label: 'Archivado' },
};

export function StatusBadge({ status, deleted }: { status: string; deleted?: boolean }) {
  const s = deleted
    ? { bg: '#fee2e2', fg: '#b91c1c', label: 'Borrado' }
    : STATUS_STYLE[status] ?? { bg: C.surface2, fg: C.muted, label: status };
  return <Badge bg={s.bg} fg={s.fg} label={s.label} />;
}

/** Badge del estado de moderación de un comentario. */
export function CommentStatusBadge({ status }: { status: string }) {
  const s =
    status === 'approved'
      ? { bg: '#dcfce7', fg: '#15803d', label: 'Aprobado' }
      : status === 'pending_review'
      ? { bg: '#fef3c7', fg: '#b45309', label: 'Pendiente' }
      : { bg: '#fee2e2', fg: '#b91c1c', label: 'Rechazado' };
  return <Badge bg={s.bg} fg={s.fg} label={s.label} />;
}

const ROLE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  admin: { bg: '#fef9c3', fg: '#a16207', label: 'Admin' },
  contributor: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Contributor' },
  user: { bg: '#f1f5f9', fg: '#475569', label: 'Usuario' },
};

export function RoleBadge({ role }: { role: string }) {
  const r = ROLE_STYLE[role] ?? ROLE_STYLE.user!;
  return <Badge bg={r.bg} fg={r.fg} label={r.label} />;
}

export function Banner({ kind, children }: { kind: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const color = kind === 'error' ? C.danger : kind === 'success' ? C.success : C.info;
  const bg = kind === 'error' ? '#fef2f2' : kind === 'success' ? '#f0fdf4' : '#eff6ff';
  return (
    <View
      style={{
        backgroundColor: bg,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <Text style={{ color: C.text, fontSize: 13 }}>{children}</Text>
    </View>
  );
}
