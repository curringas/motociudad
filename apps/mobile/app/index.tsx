import { Redirect } from 'expo-router';

/**
 * Root index — immediately redirects to the main map tab.
 */
export default function Index() {
  return <Redirect href="/(tabs)/map" />;
}
