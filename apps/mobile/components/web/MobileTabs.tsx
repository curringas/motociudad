// Web-only mobile tab bar. Mirrors app/(tabs)/_layout.tsx so that narrow web
// viewports get the same bottom-tab navigation as the native app. We CANNOT import
// the native _layout here: on web `./_layout` resolves to _layout.web.tsx (self),
// causing a require cycle — so the Tabs config is replicated instead.
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

export function MobileTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#FFD60A',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <TabIcon name="map-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Lista',
          tabBarIcon: ({ color, size }) => <TabIcon name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="contribute"
        options={{
          title: 'Aportar',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="add-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, size }) => <TabIcon name="trophy-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
