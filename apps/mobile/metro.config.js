const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Disable package exports resolution so ESM-only packages (e.g. zustand esm/*.mjs)
// don't get picked up on web — Metro falls back to the CJS 'main' field instead.
config.resolver.unstable_enablePackageExports = false;

// On web, redirect native-only modules to web shims that expose the same public
// API (see lib/*-web). Native platforms are unaffected — these branches only fire
// when platform === 'web', so iOS/Android keep resolving the real native modules.
const WEB_MODULE_SHIMS = {
  'react-native-maps': 'lib/maps-web/index.tsx',
  'expo-camera': 'lib/camera-web/index.tsx',
  'expo-image-manipulator': 'lib/image-manipulator-web.ts',
  'expo-file-system/legacy': 'lib/file-system-web.ts',
  'expo-file-system': 'lib/file-system-web.ts',
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_MODULE_SHIMS[moduleName]) {
    return {
      filePath: path.resolve(__dirname, WEB_MODULE_SHIMS[moduleName]),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
