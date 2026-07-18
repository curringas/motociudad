// Web-only responsive navigation shell. Mobile width => the same Tabs as native;
// tablet/desktop => a left NavRail + routed content. Native never resolves this file.
import React from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { useBreakpoint } from '@/lib/responsive';
import { NavRail } from '@/components/web/NavRail';
import { MobileTabs } from '@/components/web/MobileTabs';

export default function WebTabsLayout() {
  const bp = useBreakpoint();

  if (bp === 'mobile') {
    return <MobileTabs />;
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0f172a' }}>
      <NavRail expanded={bp === 'desktop'} />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}
