import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-native before importing the module under test
vi.mock('react-native', () => ({
  Linking: {
    canOpenURL: vi.fn(),
    openURL: vi.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

import { Linking, Platform } from 'react-native';
import { openInExternalMaps } from '../deeplinks';

const mockCanOpen = Linking.canOpenURL as ReturnType<typeof vi.fn>;
const mockOpenURL = Linking.openURL as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openInExternalMaps', () => {
  describe('iOS', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'ios';
    });

    it('opens Apple Maps URL when the app is available', async () => {
      mockCanOpen.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      expect(mockCanOpen).toHaveBeenCalledWith('maps://?daddr=40.4168,-3.7038');
      expect(mockOpenURL).toHaveBeenCalledWith('maps://?daddr=40.4168,-3.7038');
    });

    it('falls back to Google Maps web when Apple Maps URL cannot be opened', async () => {
      mockCanOpen.mockResolvedValue(false);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      expect(mockOpenURL).toHaveBeenCalledWith(
        'https://maps.google.com/?q=40.4168,-3.7038',
      );
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'android';
    });

    it('opens geo: URI with encoded parking name', async () => {
      mockCanOpen.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      const expectedUrl =
        `geo:40.4168,-3.7038?q=40.4168,-3.7038(${encodeURIComponent('Parking Centro')})`;
      expect(mockCanOpen).toHaveBeenCalledWith(expectedUrl);
      expect(mockOpenURL).toHaveBeenCalledWith(expectedUrl);
    });

    it('falls back to Google Maps web when geo: URI cannot be opened', async () => {
      mockCanOpen.mockResolvedValue(false);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking Centro');

      expect(mockOpenURL).toHaveBeenCalledWith(
        'https://maps.google.com/?q=40.4168,-3.7038',
      );
    });

    it('URL-encodes parking names with special characters', async () => {
      mockCanOpen.mockResolvedValue(true);
      mockOpenURL.mockResolvedValue(undefined);

      await openInExternalMaps(40.4168, -3.7038, 'Parking & Talleres Sánchez');

      const encodedName = encodeURIComponent('Parking & Talleres Sánchez');
      expect(mockOpenURL).toHaveBeenCalledWith(
        `geo:40.4168,-3.7038?q=40.4168,-3.7038(${encodedName})`,
      );
    });
  });
});
