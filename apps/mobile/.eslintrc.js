// ESLint config for the mobile app.
// Uses the official Expo preset (eslint-config-expo) in classic (eslintrc) format,
// matching ESLint 8. `root: true` stops ESLint from searching ancestor directories.
module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: [
    'node_modules/',
    'ios/',
    'android/',
    '.expo/',
    'dist/',
    'web-build/',
    'babel.config.js',
    'metro.config.js',
  ],
};
