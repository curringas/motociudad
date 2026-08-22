## MODIFIED Requirements

### Requirement: Map centered on user location
The system SHALL display an interactive map centered on the user's current GPS location on app launch, showing verified parkings within a 2km radius as colored pins. Only parkings with `ai_review_status='approved'` SHALL be eligible for public display; parkings Otto marked `flagged` or `rejected` MUST NOT appear on the public map or list (they remain visible to their proposer and to administrators only).

#### Scenario: Initial map load with location permission
- **WHEN** the user opens the app with location permission granted
- **THEN** the map SHALL center on the user's coordinates with city-level zoom
- **AND** verified, `ai_review_status='approved'` parkings within 2km SHALL appear as colored pins
- **AND** the user's position SHALL be indicated by a blue dot

#### Scenario: Initial map load without location permission
- **WHEN** the user opens the app with location permission denied
- **THEN** the map SHALL center on Madrid (40.4168° N, 3.7038° W) as default
- **AND** a banner SHALL appear inviting the user to grant location permission
- **AND** a button SHALL open the system settings for the app

#### Scenario: Non-approved parkings excluded from public results
- **WHEN** the `nearby_parkings` RPC (or the underlying view/RLS) resolves results for a non-owner, non-admin user
- **THEN** parkings with `ai_review_status` of `'flagged'` or `'rejected'` SHALL be excluded
