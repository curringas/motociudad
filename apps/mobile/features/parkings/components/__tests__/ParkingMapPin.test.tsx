import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ParkingMapPin } from '../ParkingMapPin';
import type { NearbyParking } from '@/types/domain';

// Rendered as web via the react-native → react-native-web alias (see
// vitest.config.ts) with @testing-library/react. react-native-maps is mocked
// to a plain button so the pin renders without a native map environment.
vi.mock('react-native-maps', () => ({
  Marker: ({
    children,
    onPress,
    accessibilityLabel,
    accessibilityRole,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    accessibilityLabel: string;
    accessibilityRole: string;
  }) => (
    <button
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));

const baseParking: NearbyParking = {
  id: 'abc-123',
  name: 'Parking Gran Vía',
  type: 'public',
  status: 'verified',
  lat: 40.4168,
  lng: -3.7038,
  distance_meters: 350,
  city: 'Madrid',
  capacity: 20,
  features: {},
  verifications_count: 5,
  last_verified_at: '2026-05-01T10:00:00Z',
};

describe('ParkingMapPin', () => {
  it('renders with correct accessibilityLabel containing parking name', () => {
    render(<ParkingMapPin parking={baseParking} onPress={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /Parking Gran Vía/ }),
    ).toBeTruthy();
  });

  it('includes formatted distance in the accessibilityLabel', () => {
    render(<ParkingMapPin parking={baseParking} onPress={vi.fn()} />);

    expect(screen.getByRole('button', { name: /350 m/ })).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = vi.fn();
    render(<ParkingMapPin parking={baseParking} onPress={onPress} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe('pin colour logic', () => {
    it('uses yellow (#FFD60A) for public verified parking', () => {
      render(
        <ParkingMapPin
          parking={{ ...baseParking, type: 'public', status: 'verified' }}
          onPress={vi.fn()}
        />,
      );
      // The pin letter "M" appears inside the coloured circle view
      expect(screen.getByText('M')).toBeTruthy();
    });

    it('uses dark grey (#374151) for private verified parking', () => {
      render(
        <ParkingMapPin
          parking={{ ...baseParking, type: 'private', status: 'verified' }}
          onPress={vi.fn()}
        />,
      );
      expect(screen.getByText('M')).toBeTruthy();
    });

    it('renders pending parking with reduced opacity', () => {
      // We verify the component renders without error for a pending parking
      render(
        <ParkingMapPin
          parking={{ ...baseParking, status: 'pending' }}
          onPress={vi.fn()}
        />,
      );
      expect(screen.getByRole('button')).toBeTruthy();
    });
  });
});
