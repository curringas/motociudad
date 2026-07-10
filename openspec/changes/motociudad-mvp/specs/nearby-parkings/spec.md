## ADDED Requirements

### Requirement: Map centered on user location
The system SHALL display an interactive map centered on the user's current GPS location on app launch, showing verified parkings within a 2km radius as colored pins.

#### Scenario: Initial map load with location permission
- **WHEN** the user opens the app with location permission granted
- **THEN** the map SHALL center on the user's coordinates with city-level zoom
- **AND** verified parkings within 2km SHALL appear as colored pins
- **AND** the user's position SHALL be indicated by a blue dot

#### Scenario: Initial map load without location permission
- **WHEN** the user opens the app with location permission denied
- **THEN** the map SHALL center on Madrid (40.4168° N, 3.7038° W) as default
- **AND** a banner SHALL appear inviting the user to grant location permission
- **AND** a button SHALL open the system settings for the app

### Requirement: Colored pins by parking type and verification status
The system SHALL render parking pins with distinct colors according to type and verification status so users can visually distinguish parkings at a glance.

#### Scenario: Verified public parking pin
- **WHEN** a parking with `type='public'` and `status='verified'` is rendered
- **THEN** its pin SHALL appear in neon yellow with a solid border

#### Scenario: Private parking pin
- **WHEN** a parking with `type='private'` is rendered
- **THEN** its pin SHALL appear in dark grey

#### Scenario: Unverified parking pin
- **WHEN** a parking with `status='pending'` is rendered
- **THEN** its pin SHALL appear with a dashed/discontinuous border regardless of color

### Requirement: Dynamic loading on map pan
The system SHALL reload nearby parkings when the user pans the map, without a full screen refresh, so that new parkings appear as the user explores.

#### Scenario: Map panned more than 500m from last center
- **WHEN** the user drags the map more than 500 meters from the previous query center
- **THEN** the system SHALL call the `nearby_parkings` RPC with the new viewport
- **AND** the pins SHALL update without reloading the full screen
- **AND** the RPC call SHALL be debounced by 500ms to prevent saturation

#### Scenario: Viewport query performance
- **WHEN** the `nearby_parkings` RPC is called
- **THEN** it SHALL respond in under 500ms at p95

### Requirement: Pin clustering for dense areas
The system SHALL group nearby pins into numbered clusters when more than 50 parkings are visible in the current viewport, to maintain map readability.

#### Scenario: More than 50 pins in viewport
- **WHEN** the current viewport contains more than 50 parkings
- **THEN** nearby pins SHALL be grouped into numbered cluster markers
- **AND** the cluster marker SHALL show the count of grouped pins

#### Scenario: Tapping a cluster
- **WHEN** the user taps a cluster marker
- **THEN** the map SHALL zoom in to reveal the individual pins within the cluster

### Requirement: Parking detail bottom sheet
The system SHALL display a bottom sheet with parking details and action buttons when the user taps a pin, without navigating away from the map.

#### Scenario: Tapping a parking pin
- **WHEN** the user taps a parking pin on the map
- **THEN** a bottom sheet SHALL appear with: primary photo, parking name, distance from user, approximate capacity, and verification badge if verified
- **AND** two action buttons SHALL be shown: "Llévame" and "Detalles"

#### Scenario: Tapping "Llévame"
- **WHEN** the user taps the "Llévame" button in the bottom sheet
- **THEN** the system SHALL open the native maps app (Apple Maps on iOS, Google Maps on Android)
- **AND** the route SHALL be pre-configured to the selected parking coordinates
- **AND** on iOS the URL SHALL follow the pattern `maps://?daddr={lat},{lng}` with fallback to `https://maps.google.com/?q=...`
- **AND** on Android the URL SHALL follow the pattern `geo:{lat},{lng}?q={lat},{lng}({name})`

### Requirement: Empty state when no parkings nearby
The system SHALL show a helpful empty state when no parkings exist in the current viewport, guiding the user to contribute.

#### Scenario: No parkings in viewport
- **WHEN** the `nearby_parkings` RPC returns zero results for the current viewport
- **THEN** the map SHALL show a message "No hay parkings cerca, ¿quieres aportar uno?"
- **AND** a CTA button SHALL navigate to the "Aportar" tab

### Requirement: Recenter button
The system SHALL provide a "center on me" button that re-centers the map on the user's current location without automatic re-centering on physical movement.

#### Scenario: User taps recenter button
- **WHEN** the user taps the "centrar en mí" floating button
- **THEN** the map SHALL animate to center on the user's current GPS position

#### Scenario: User moves physically
- **WHEN** the user moves physically while viewing the map
- **THEN** the map SHALL NOT auto-recenter — only the blue dot position updates
