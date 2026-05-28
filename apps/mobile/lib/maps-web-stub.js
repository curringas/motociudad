// Stub for react-native-maps on web.
// With Metro CJS interop, `import MapView from 'react-native-maps'` resolves to
// module.exports directly (no __esModule flag), so module.exports must BE the component.
// Named imports `{ Marker, PROVIDER_DEFAULT }` resolve to module.exports.X.
const React = require('react');
const { View, Text } = require('react-native');

function MapView({ style, children }) {
  return React.createElement(
    View,
    { style: [{ backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }, style] },
    React.createElement(Text, { style: { color: '#475569', fontSize: 12 } }, 'Mapa (solo móvil)'),
    children,
  );
}
MapView.displayName = 'MapView';

function Marker() { return null; }
Marker.displayName = 'Marker';

// Named exports as properties so `import { Marker, PROVIDER_DEFAULT } from 'react-native-maps'` works
MapView.Marker = Marker;
MapView.PROVIDER_DEFAULT = null;
MapView.PROVIDER_GOOGLE = 'google';
MapView.default = MapView;

module.exports = MapView;
