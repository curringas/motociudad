// Desktop/tablet left icon rail (web-only). Mirrors the native tab bar's
// destinations, icons and dark palette (see app/(tabs)/_layout.tsx).
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Item = { href: string; label: string; icon: IconName };

const ITEMS: Item[] = [
  { href: '/map', label: 'Mapa', icon: 'map-outline' },
  { href: '/list', label: 'Lista', icon: 'list-outline' },
  { href: '/contribute', label: 'Aportar', icon: 'add-circle-outline' },
  { href: '/ranking', label: 'Ranking', icon: 'trophy-outline' },
  { href: '/profile', label: 'Perfil', icon: 'person-outline' },
];

const ACTIVE = '#FFD60A';
const INACTIVE = '#94a3b8';

export function NavRail({ expanded = false }: { expanded?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        width: expanded ? 208 : 76,
        backgroundColor: '#0f172a',
        borderRightWidth: 1,
        borderRightColor: '#1e293b',
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'stretch',
        gap: 4,
      }}
    >
      <View style={{ paddingHorizontal: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 22 }}>🏍️</Text>
        {expanded ? (
          <Text style={{ color: '#f8fafc', fontSize: 18, fontWeight: '800' }}>MotoCiudad</Text>
        ) : null}
      </View>

      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Pressable
            key={item.href}
            onPress={() => router.navigate(item.href as never)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: expanded ? 14 : 0,
              justifyContent: expanded ? 'flex-start' : 'center',
              backgroundColor: active ? '#1e293b' : 'transparent',
              borderRadius: 12,
            }}
          >
            <Ionicons name={item.icon} size={24} color={active ? ACTIVE : INACTIVE} />
            {expanded ? (
              <Text style={{ color: active ? ACTIVE : INACTIVE, fontSize: 15, fontWeight: '600' }}>
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
