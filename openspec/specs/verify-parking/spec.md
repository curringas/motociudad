# verify-parking Specification

## Purpose
Verificación in situ de un parking (geofence ≤100 m + foto ≤5 min) que confirma que el
dato es real y acredita Octanos con reglas anti-abuso, gestionada por la Edge Function
`validate-verification`.
## Requirements
### Requirement: In-situ parking verification with photo
The system SHALL allow authenticated users (level ≥ 2 Rodador) to verify a parking in situ by taking a photo with the rear camera, confirming their presence within 100m of the parking, and earning Octanos upon success.

#### Scenario: Successful verification within geofence
- **WHEN** a level ≥ 2 user taps "¿Has aparcado aquí?" on a parking proposed by another user
- **AND** their GPS location is within 100 meters of the parking
- **AND** they take a photo and submit
- **THEN** the verification SHALL be recorded in `parking_verifications`
- **AND** an `octano_event` with `action_type='verify_parking'`, `points=25`, `status='confirmed'` SHALL be inserted
- **AND** a confirmation message SHALL appear showing the total Octanos earned

#### Scenario: First verifier bonus
- **WHEN** the submitted verification is the first for that parking
- **THEN** an additional `octano_event` with `action_type='first_verifier'`, `points=15`, `status='confirmed'` SHALL be inserted
- **AND** the parking `status` SHALL change from `'pending'` to `'verified'`
- **AND** `last_verified_at` SHALL be updated to `now()`

### Requirement: Geofence enforcement (GEOFENCE_FAIL)
The system SHALL reject verification attempts where the user's GPS location is more than 100 meters from the parking.

#### Scenario: User too far from parking
- **WHEN** the user's GPS location is more than 100 meters from the parking at submission time
- **THEN** the Edge Function SHALL return error code `GEOFENCE_FAIL`
- **AND** the client SHALL display "Estás demasiado lejos del parking"
- **AND** no `octano_event` SHALL be inserted

#### Scenario: GPS accuracy insufficient
- **WHEN** the device GPS reports accuracy worse than 50 meters at submission time
- **THEN** the submit button SHALL be disabled on the client
- **AND** a warning SHALL appear "Espera a tener señal GPS precisa"

### Requirement: Photo freshness enforcement (STALE_PHOTO)
The system SHALL reject verifications where the photo was taken more than 5 minutes before submission, to prevent pre-captured photo abuse.

#### Scenario: Photo taken more than 5 minutes ago
- **WHEN** the `photo_taken_at` timestamp is more than 5 minutes before `now()` at Edge Function evaluation time
- **THEN** the Edge Function SHALL return error code `STALE_PHOTO`
- **AND** the client SHALL display a request to take a new photo
- **AND** no `octano_event` SHALL be inserted

#### Scenario: Photo timestamp set at capture, not upload
- **WHEN** the network fails during upload and the user retries
- **THEN** the original `photo_taken_at` from the capture moment SHALL be preserved in the payload
- **AND** the 5-minute window SHALL be calculated from the original capture time

### Requirement: Self-verification prevention (SELF_VERIFICATION_FORBIDDEN)
The system SHALL prevent users from verifying their own proposed parkings.

#### Scenario: Proposer attempts to verify own parking
- **WHEN** the user who proposed the parking attempts to verify it
- **THEN** the "¿Has aparcado aquí?" button SHALL NOT be shown on the parking detail screen
- **AND** if the request is made directly to the Edge Function, it SHALL return error code `SELF_VERIFICATION_FORBIDDEN`
- **AND** no `octano_event` SHALL be inserted

### Requirement: Duplicate verification prevention (ALREADY_VERIFIED)
The system SHALL prevent a user from verifying the same parking more than once.

#### Scenario: User already verified this parking
- **WHEN** the user attempts to verify a parking they have already verified in a previous session
- **THEN** the Edge Function SHALL return error code `ALREADY_VERIFIED`
- **AND** the client SHALL display an informative message
- **AND** no `octano_event` SHALL be inserted

### Requirement: Daily Octanos cap enforcement (DAILY_CAP_REACHED)
The system SHALL reject verification Octanos when the user has already earned 200 or more Octanos in the last 24 hours.

#### Scenario: Daily cap already reached
- **WHEN** the sum of `octano_events.points` with `status='confirmed'` for the user in the last 24 hours is ≥ 200
- **THEN** the Edge Function SHALL return error code `DAILY_CAP_REACHED`
- **AND** the client SHALL indicate when the counter resets
- **AND** no `octano_event` SHALL be inserted

### Requirement: Transactional consistency for verification recording
The system SHALL insert all verification records atomically: photo, verification, and Octanos events must either all succeed or all fail together.

#### Scenario: Successful verification transaction
- **WHEN** all validations pass
- **THEN** in a single database transaction:
  - An INSERT into `parking_photos` with `is_verification=true` SHALL execute
  - An INSERT into `parking_verifications` SHALL execute
  - One or two INSERTs into `octano_events` SHALL execute (base + optional first_verifier bonus)
  - An UPDATE to `parkings.last_verified_at` and optionally `status` SHALL execute
- **AND** if any step fails, all changes SHALL be rolled back

### Requirement: Rear camera enforcement
The system SHALL force the use of the rear camera during photo capture for verification, preventing selfies.

#### Scenario: Camera opened for verification
- **WHEN** the user taps "¿Has aparcado aquí?" and the camera opens
- **THEN** the rear camera SHALL be active by default
- **AND** the camera SHALL NOT offer a camera flip button during verification capture

### Requirement: EXIF geolocation stripped before upload
The system SHALL remove GPS metadata from verification photos before uploading to Storage to protect user privacy.

#### Scenario: Photo submitted for verification
- **WHEN** the user captures a verification photo
- **THEN** the client SHALL strip all EXIF geolocation fields before uploading the image to Supabase Storage
- **AND** the Storage path SHALL be recorded in `parking_photos.storage_path`

### Requirement: Level-up check after successful verification
The system SHALL check if the user has crossed a level threshold after a successful verification and trigger the appropriate celebratory animation.

#### Scenario: User crosses a level threshold
- **WHEN** a verification completes successfully and the user's total_octanos crosses a level boundary
- **THEN** the client SHALL display the level-up celebratory animation
- **AND** `users.current_level` SHALL be updated to the new level

