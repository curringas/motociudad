import { Redirect } from 'expo-router';

// El panel arranca en la sección Parkings (accesible a admin y contributor).
export default function AdminIndexWeb() {
  return <Redirect href="/admin/parkings" />;
}
