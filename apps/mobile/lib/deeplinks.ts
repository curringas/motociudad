import { Linking, Platform, ActionSheetIOS, Alert } from 'react-native';

const DESTINATION_LABEL = 'Motociudad';

async function tryGoogleMapsApp(lat: number, lng: number): Promise<boolean> {
  const url = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // scheme not in LSApplicationQueriesSchemes or app not installed — fall through
  }
  return false;
}

async function openGoogleMapsWeb(lat: number, lng: number): Promise<void> {
  await Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  );
}

// Uses http://maps.apple.com/ which iOS always routes to the Maps app and
// handles coordinate parsing more reliably than the maps:// custom scheme.
async function openAppleMaps(lat: number, lng: number): Promise<void> {
  const q = encodeURIComponent(DESTINATION_LABEL);
  await Linking.openURL(`http://maps.apple.com/?daddr=${lat},${lng}&q=${q}`);
}

/**
 * Opens the given coordinates in an external maps app.
 * On iOS shows a native action sheet (Google Maps first, then Apple Maps,
 * then Google Maps in browser). On Android opens Google Maps directly.
 */
export async function openInExternalMaps(
  lat: number | null,
  lng: number | null,
  _name: string | null,
): Promise<void> {
  if (lat == null || lng == null) {
    Alert.alert('Ubicación no disponible', 'Este parking no tiene coordenadas guardadas.');
    return;
  }

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancelar', 'Google Maps', 'Apple Maps', 'Google Maps (navegador)'],
        cancelButtonIndex: 0,
        title: 'Cómo quieres llegar',
      },
      async (buttonIndex) => {
        if (buttonIndex === 1) {
          const opened = await tryGoogleMapsApp(lat, lng);
          if (!opened) await openGoogleMapsWeb(lat, lng);
        } else if (buttonIndex === 2) {
          await openAppleMaps(lat, lng);
        } else if (buttonIndex === 3) {
          await openGoogleMapsWeb(lat, lng);
        }
      },
    );
  } else {
    const opened = await tryGoogleMapsApp(lat, lng);
    if (!opened) await openGoogleMapsWeb(lat, lng);
  }
}
