import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import type { NearbyParking } from '@/types/domain';
import { formatDistance } from '@/lib/distance';

type Props = {
  parking: NearbyParking;
  onPress: () => void;
};

function getPinColor(parking: NearbyParking): string {
  return parking.type === 'public' ? '#FFD60A' : '#374151';
}

/**
 * Custom map pin for Apple Maps / Google Maps.
 *
 * Uses only inline styles (no NativeWind) so that iOS can capture a correct
 * static snapshot immediately at mount time with tracksViewChanges={false}.
 * NativeWind class resolution happens asynchronously and would produce a blank
 * snapshot if used here.
 */
const ParkingMapPin = memo(function ParkingMapPin({ parking, onPress }: Props) {
  const pinColor = getPinColor(parking);
  const pinOpacity = parking.status === 'pending' ? 0.6 : 1;
  const textColor = parking.type === 'public' ? '#0f172a' : '#ffffff';
  const label = `${parking.name}, ${formatDistance(parking.distance_meters)}`;

  return (
    <Marker
      identifier={parking.id}
      coordinate={{ latitude: parking.lat, longitude: parking.lng }}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      tracksViewChanges={false}
    >
      <View style={{ opacity: pinOpacity, alignItems: 'center' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: 'white',
            backgroundColor: pinColor,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: textColor }}>M</Text>
        </View>
        <View style={{ width: 2, height: 6, backgroundColor: pinColor }} />
      </View>
    </Marker>
  );
});

export { ParkingMapPin };
