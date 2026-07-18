import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-native before importing the module under test.
vi.mock('react-native', () => ({
  Linking: {
    canOpenURL: vi.fn(),
    openURL: vi.fn(),
  },
  Platform: {
    OS: 'ios',
  },
  ActionSheetIOS: {
    showActionSheetWithOptions: vi.fn(),
  },
  Alert: {
    alert: vi.fn(),
  },
}));

import { Linking, Platform, ActionSheetIOS, Alert } from 'react-native';
import { openInExternalMaps } from '../deeplinks';

const mockCanOpen = Linking.canOpenURL as ReturnType<typeof vi.fn>;
const mockOpenURL = Linking.openURL as ReturnType<typeof vi.fn>;
const mockActionSheet =
  ActionSheetIOS.showActionSheetWithOptions as ReturnType<typeof vi.fn>;
const mockAlert = Alert.alert as ReturnType<typeof vi.fn>;

const GMAPS_APP = 'comgooglemaps://?daddr=40.4168,-3.7038&directionsmode=driving';
const GMAPS_WEB =
  'https://www.google.com/maps/dir/?api=1&destination=40.4168,-3.7038';
const APPLE_MAPS = 'http://maps.apple.com/?daddr=40.4168,-3.7038&q=Motociudad';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openInExternalMaps', () => {
  it('avisa y no abre nada si faltan coordenadas', async () => {
    (Platform as { OS: string }).OS = 'android';

    await openInExternalMaps(null, -3.7038, 'Parking Centro');

    expect(mockAlert).toHaveBeenCalledWith(
      'Ubicación no disponible',
      'Este parking no tiene coordenadas guardadas.',
    );
    expect(mockOpenURL).not.toHaveBeenCalled();
    expect(mockActionSheet).not.toHaveBeenCalled();
  });

  describe('Android', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'android';
    });

    it('abre la app de Google Maps cuando está disponible', async () => {
      mockCanOpen.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      expect(mockCanOpen).toHaveBeenCalledWith(GMAPS_APP);
      expect(mockOpenURL).toHaveBeenCalledWith(GMAPS_APP);
    });

    it('cae a Google Maps web cuando la app no está instalada', async () => {
      mockCanOpen.mockResolvedValue(false);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      expect(mockOpenURL).toHaveBeenCalledWith(GMAPS_WEB);
    });
  });

  describe('iOS', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'ios';
    });

    it('muestra un action sheet con las opciones de navegación', async () => {
      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      expect(mockActionSheet).toHaveBeenCalledTimes(1);
      const options = mockActionSheet.mock.calls[0]![0] as {
        options: string[];
        cancelButtonIndex: number;
      };
      expect(options.options).toEqual([
        'Cancelar',
        'Google Maps',
        'Apple Maps',
        'Google Maps (navegador)',
      ]);
      expect(options.cancelButtonIndex).toBe(0);
    });

    it('al elegir Google Maps (índice 1) abre la app si está disponible', async () => {
      mockCanOpen.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');
      const callback = mockActionSheet.mock.calls[0]![1] as (
        i: number,
      ) => Promise<void>;
      await callback(1);

      expect(mockOpenURL).toHaveBeenCalledWith(GMAPS_APP);
    });

    it('al elegir Apple Maps (índice 2) abre maps.apple.com', async () => {
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');
      const callback = mockActionSheet.mock.calls[0]![1] as (
        i: number,
      ) => Promise<void>;
      await callback(2);

      expect(mockOpenURL).toHaveBeenCalledWith(APPLE_MAPS);
    });

    it('al elegir navegador (índice 3) abre Google Maps web', async () => {
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');
      const callback = mockActionSheet.mock.calls[0]![1] as (
        i: number,
      ) => Promise<void>;
      await callback(3);

      expect(mockOpenURL).toHaveBeenCalledWith(GMAPS_WEB);
    });
  });
});
