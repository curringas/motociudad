// Panel de administración (solo web). Layout + guard de acceso por rol.
// La seguridad real es RLS + Edge Function; este guard solo evita mostrar la UI.
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/stores/sessionStore';
import { useCurrentProfile } from '@/features/admin/hooks';
import { canAccessPanel, canManageUsers } from '@/features/admin/permissions';
import { C, Spinner, Button } from '@/features/admin/ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Denied({ title, subtitle, actionLabel, onAction }: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ maxWidth: 420, alignItems: 'center', gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed-outline" size={30} color={C.accent} />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text>
        <Button label={actionLabel} onPress={onAction} />
      </View>
    </View>
  );
}

export default function AdminLayoutWeb() {
  const router = useRouter();
  const pathname = usePathname();
  const sessionLoading = useSessionStore((s) => s.isLoading);
  const user = useSessionStore((s) => s.user);
  const { data: profile, isLoading: profileLoading, isError } = useCurrentProfile();

  if (sessionLoading || (user && profileLoading)) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Spinner label="Cargando panel…" />
      </View>
    );
  }

  if (!user) {
    return (
      <Denied
        title="Inicia sesión"
        subtitle="El panel de administración requiere una cuenta con permisos."
        actionLabel="Ir a iniciar sesión"
        onAction={() => router.replace('/login')}
      />
    );
  }

  if (isError || !profile || !canAccessPanel(profile)) {
    const suspended = profile?.suspended === true;
    return (
      <Denied
        title={suspended ? 'Cuenta suspendida' : 'Acceso denegado'}
        subtitle={
          suspended
            ? 'Tu cuenta está suspendida: solo lectura. No puedes acceder al panel.'
            : 'No tienes permisos para acceder al panel de administración.'
        }
        actionLabel="Volver al mapa"
        onAction={() => router.replace('/map')}
      />
    );
  }

  const showUsers = canManageUsers(profile);
  const sections: { href: string; label: string; icon: IconName; show: boolean }[] = [
    { href: '/admin/parkings', label: 'Parkings', icon: 'car-outline', show: true },
    { href: '/admin/users', label: 'Usuarios', icon: 'people-outline', show: showUsers },
  ];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      {/* Sidebar */}
      <View style={{ width: 220, backgroundColor: C.bg, borderRightWidth: 1, borderRightColor: C.surface, padding: 16, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 8 }}>
          <Text style={{ fontSize: 20 }}>🛠️</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>Panel</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 11, paddingHorizontal: 6, paddingBottom: 8 }}>
          {profile.display_name} · {profile.role}
        </Text>
        {sections.filter((s) => s.show).map((s) => {
          const active = pathname.startsWith(s.href);
          return (
            <Pressable
              key={s.href}
              onPress={() => router.navigate(s.href as never)}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
                backgroundColor: active ? C.surface : 'transparent',
              }}
            >
              <Ionicons name={s.icon} size={20} color={active ? C.accent : C.muted} />
              <Text style={{ color: active ? C.accent : C.muted, fontWeight: '600', fontSize: 14 }}>{s.label}</Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.navigate('/map' as never)}
          accessibilityRole="button"
          accessibilityLabel="Volver a la app"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 }}
        >
          <Ionicons name="arrow-back-outline" size={18} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 13 }}>Volver a la app</Text>
        </Pressable>
      </View>

      {/* Contenido */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        <Slot />
      </ScrollView>
    </View>
  );
}
