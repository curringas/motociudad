import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MotoCiudad',
  slug: 'motociudad',
  owner: 'curringas',
  version: '0.1.0',
  scheme: 'motociudad',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  // OTA (EAS Update): la app descarga updates de JS/assets sin recompilar.
  // 'appVersion' ata el runtime a `version` (0.1.0): un update solo llega a builds
  // con esa versión. ⚠️ Al cambiar código NATIVO, sube `version` para que los
  // builds viejos no reciban JS incompatible.
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: 'https://u.expo.dev/5cc7b479-4623-4025-ad5d-47aaff80bec2',
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.motociudad.app',
    buildNumber: '2',
    infoPlist: {
      LSApplicationQueriesSchemes: ['comgooglemaps', 'googlemaps'],
      // Solo usamos ubicación con la app en primer plano (centrar mapa + verificar
      // parking). Sin navegación ni background → declaramos únicamente WhenInUse.
      NSLocationWhenInUseUsageDescription:
        'MotoCiudad necesita tu ubicación para mostrarte parkings cercanos y verificar que estás en el lugar correcto.',
      // Sin cifrado no exento (solo HTTPS estándar): evita el prompt de export
      // compliance en cada subida a App Store Connect / TestFlight.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        'MotoCiudad necesita la cámara para que puedas fotografiar el parking y verificar su existencia.',
      NSPhotoLibraryUsageDescription:
        'MotoCiudad necesita acceso a tus fotos para elegir tu avatar y adjuntar imágenes de parkings.',
    },
  },
  android: {
    package: 'com.motociudad.app',
    versionCode: 4,
    config: {
      googleMaps: {
        // Maps SDK for Android requiere una API key; se lee de .env (gitignored).
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY,
      },
    },
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
    ],
    // Google Play policy: apps targeting Android 13+ (API 33+) must use the
    // system photo picker instead of broad media permissions. expo-image-picker
    // already uses the picker (launchImageLibraryAsync → PickVisualMedia), so we
    // strip the media/storage permissions its plugin/legacy path would merge in.
    blockedPermissions: [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        // Solo primer plano: sin locationAlwaysAndWhenInUsePermission para no
        // declarar background location que no usamos (rechazo Apple 5.1.1).
        locationWhenInUsePermission:
          'MotoCiudad necesita tu ubicación para mostrarte parkings cercanos.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'MotoCiudad necesita la cámara para fotografiar parkings.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        // Avatar del perfil. Usa el selector de fotos del sistema (Android 13+
        // / iOS PHPicker), que NO requiere permisos de media; en Android los
        // permisos amplios se bloquean arriba (blockedPermissions). En iOS el
        // config plugin añade NSPhotoLibraryUsageDescription (inofensivo).
        photosPermission:
          'MotoCiudad necesita acceso a tus fotos para elegir tu avatar y adjuntar imágenes de parkings.',
      },
    ],
  ],
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: '5cc7b479-4623-4025-ad5d-47aaff80bec2',
    },
    supabaseUrl: process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '',
    supabaseAnonKey: process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
    postHogApiKey: process.env['EXPO_PUBLIC_POSTHOG_KEY'] ?? '',
    postHogHost: process.env['EXPO_PUBLIC_POSTHOG_HOST'] ?? 'https://eu.posthog.com',
    sentryDsn: process.env['EXPO_PUBLIC_SENTRY_DSN'] ?? '',
  },
});
