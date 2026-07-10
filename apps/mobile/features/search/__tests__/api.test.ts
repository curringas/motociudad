import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-location so no native module is loaded under Vitest.
vi.mock('expo-location', () => ({
  geocodeAsync: vi.fn(),
}));

import * as Location from 'expo-location';
import { geocodeAddress } from '../api';

const mockGeocode = Location.geocodeAsync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('geocodeAddress', () => {
  it('devuelve el primer resultado cuando el geocoder encuentra la dirección', async () => {
    mockGeocode.mockResolvedValue([
      { latitude: 40.4168, longitude: -3.7038 },
      { latitude: 1, longitude: 2 },
    ]);

    const result = await geocodeAddress('Gran Vía, Madrid');

    expect(result).toEqual({ latitude: 40.4168, longitude: -3.7038 });
    expect(mockGeocode).toHaveBeenCalledWith('Gran Vía, Madrid');
  });

  it('devuelve null cuando el geocoder no encuentra nada', async () => {
    mockGeocode.mockResolvedValue([]);

    expect(await geocodeAddress('asdfghjkl')).toBeNull();
  });

  it('devuelve null y no llama al geocoder con query vacía', async () => {
    expect(await geocodeAddress('   ')).toBeNull();
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it('propaga el error cuando el geocoder lanza', async () => {
    mockGeocode.mockRejectedValue(new Error('geocoder down'));

    await expect(geocodeAddress('Madrid')).rejects.toThrow('geocoder down');
  });
});
