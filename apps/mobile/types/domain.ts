// Domain types for MotoCiudad mobile app
// These are stable hand-crafted types aligned with the Supabase schema.

export type ParkingType = 'public' | 'private';

export type ParkingStatus = 'pending' | 'verified' | 'rejected' | 'archived';

export type OctanoStatus = 'pending' | 'confirmed' | 'reverted';

export type OctanoAction =
  | 'propose_parking'
  | 'parking_verified_bonus'
  | 'verify_parking'
  | 'first_verifier'
  | 'report_error'
  | 'upload_photo'
  | 'useful_comment'
  | 'propose_poi'
  | 'weekly_streak'
  | 'invite_friend';

export type NearbyParking = {
  id: string;
  name: string;
  type: ParkingType;
  status: ParkingStatus;
  lat: number;
  lng: number;
  distance_meters: number;
  city: string;
  capacity: number | null;
  features: Record<string, boolean>;
  verifications_count: number;
  last_verified_at: string | null;
};

export type ParkingFeatures = {
  covered?: boolean;
  cameras?: boolean;
  anchors?: boolean;
  lit?: boolean;
  free?: boolean;
  h24?: boolean;
  battery_layout?: boolean;
};

export type Viewport = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type UserProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  octanos_total: number;
  level_id: number;
  created_at: string;
};

export type OctanoEvent = {
  id: string;
  user_id: string;
  action: OctanoAction;
  amount: number;
  status: OctanoStatus;
  reference_id: string | null;
  created_at: string;
};

export type ParkingPhoto = {
  id: string;
  parking_id: string;
  uploaded_by: string;
  storage_path: string;
  public_url: string | null;
  taken_at: string | null;
  created_at: string;
};

export type ParkingVerification = {
  id: string;
  parking_id: string;
  verified_by: string;
  user_lat: number;
  user_lng: number;
  distance_to_parking_m: number;
  is_first_verifier: boolean;
  created_at: string;
};
