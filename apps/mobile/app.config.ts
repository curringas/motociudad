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
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'es.motociudad.app',
    infoPlist: {
      LSApplicationQueriesSchemes: ['comgooglemaps', 'googlemaps'],
      NSLocationWhenInUseUsageDescription:
        'MotoCiudad necesita tu ubicación para mostrarte parkings cercanos y verificar que estás en el lugar correcto.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'MotoCiudad necesita tu ubicación para mostrarte parkings cercanos y verificar que estás en el lugar correcto.',
      NSCameraUsageDescription:
        'MotoCiudad necesita la cámara para que puedas fotografiar el parking y verificar su existencia.',
      NSPhotoLibraryUsageDescription:
        'MotoCiudad necesita acceso a tus fotos para que puedas adjuntar imágenes de parkings.',
    },
  },
  android: {
    package: 'es.motociudad.app',
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
      'READ_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES',
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
        locationAlwaysAndWhenInUsePermission:
          'MotoCiudad necesita tu ubicación para mostrarte parkings cercanos.',
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
