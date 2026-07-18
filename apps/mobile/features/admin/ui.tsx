// Primitivas de UI compartidas por el panel admin (web). Estilos en línea,
// mismo dark palette que el resto de la web (NavRail, ParkingSidePanel).
import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';

export const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  surface2: '#0b1220',
  border: '#334155',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#FFD60A',
  danger: '#f87171',
  success: '#4ade80',
  info: '#60a5fa',
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
    variant === 'primary' ? C.accent : variant === 'danger' ? 'transparent' : variant === 'ghost' ? 'transparent' : C.surface2;
  const border = variant === 'danger' ? C.danger : variant === 'secondary' ? C.border : 'transparent';
  const fg = variant === 'primary' ? C.bg : variant === 'danger' ? C.danger : C.text;
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
        placeholderTextColor="#64748b"
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

/** Segmented control (chips) — reemplaza <select> en RN-web. */
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
            <Text style={{ color: active ? C.bg : C.muted, fontWeight: '700', fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#3f3f1a', fg: '#fde047', label: 'Pendiente' },
  verified: { bg: '#14331f', fg: C.success, label: 'Verificado' },
  rejected: { bg: '#3a1717', fg: C.danger, label: 'Rechazado' },
  archived: { bg: '#1f2937', fg: C.muted, label: 'Archivado' },
};

export function StatusBadge({ status, deleted }: { status: string; deleted?: boolean }) {
  const s = deleted
    ? { bg: '#3a1717', fg: C.danger, label: 'Borrado' }
    : STATUS_STYLE[status] ?? { bg: C.surface2, fg: C.muted, label: status };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
      <Text style={{ color: s.fg, fontSize: 12, fontWeight: '700' }}>{s.label}</Text>
    </View>
  );
}

const ROLE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  admin: { bg: '#3f2a14', fg: C.accent, label: 'Admin' },
  contributor: { bg: '#14243a', fg: C.info, label: 'Contributor' },
  user: { bg: C.surface2, fg: C.muted, label: 'Usuario' },
};

export function RoleBadge({ role }: { role: string }) {
  const r = ROLE_STYLE[role] ?? ROLE_STYLE.user!;
  return (
    <View style={{ backgroundColor: r.bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
      <Text style={{ color: r.fg, fontSize: 12, fontWeight: '700' }}>{r.label}</Text>
    </View>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const color = kind === 'error' ? C.danger : kind === 'success' ? C.success : C.info;
  return (
    <View
      style={{
        backgroundColor: C.surface2,
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
