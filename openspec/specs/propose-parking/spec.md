# propose-parking Specification

## Purpose
Propuesta de un parking nuevo por parte de la comunidad: el usuario aporta ubicación,
datos y foto, y el sistema lo registra en estado `pending` acreditando Octanos vía la
Edge Function `propose-parking`.
## Requirements
### Requirement: Three-step parking proposal form
The system SHALL guide the user through a 3-step form (location, details, photo) to propose a new parking spot, so that proposals are structured and complete. On submission, the proposal SHALL be reviewed synchronously by the AI agent "Otto" (see the `otto-parking-verification` capability), and the +50 Octanos SHALL be awarded only when the parking enters the public `pending` pipeline.

#### Scenario: Proposal approved by Otto
- **WHEN** the user completes the form and Otto returns `approved`
- **THEN** the parking SHALL be created with `parking_status='pending'` and `ai_review_status='approved'`
- **AND** an `octano_event` SHALL be recorded with `action_type='propose_parking'`, `points=50`, `status='pending'`
- **AND** a confirmation screen SHALL inform the user the parking is approved and visible, pending in-situ verification by a real motorcyclist

#### Scenario: Proposal flagged by Otto (doubtful)
- **WHEN** the user completes the form and Otto returns `flagged`
- **THEN** the parking SHALL be created with `ai_review_status='flagged'` and SHALL NOT be publicly visible
- **AND** NO `octano_event` SHALL be recorded yet
- **AND** a confirmation screen SHALL inform the user the contribution is doubtful and an administrator will review it

#### Scenario: Proposal rejected by Otto
- **WHEN** the user completes the form and Otto returns `rejected`
- **THEN** the parking SHALL be recorded with `ai_review_status='rejected'` and SHALL NOT be publicly visible
- **AND** NO `octano_event` SHALL be recorded
- **AND** a screen SHALL inform the user the proposal did not pass verification because it does not appear to be a real motorcycle parking

#### Scenario: Minimal proposal without photo submitted
- **WHEN** the user completes steps 1 and 2 without uploading a photo and taps "Continuar"
- **THEN** Otto SHALL review name and notes only (text-only) and assign a verdict
- **AND** the parking SHALL be saved with `parking_status='pending'` only if Otto returns `approved`

### Requirement: Draggable pin for location selection
The system SHALL initialize the location pin at the user's current GPS position and allow dragging within a 100m radius anti-fraud constraint.

#### Scenario: Pin initialized at user location
- **WHEN** the user reaches step 1 of the proposal form with location permission granted
- **THEN** the draggable pin SHALL appear at the user's current GPS coordinates

#### Scenario: Pin dragged to confirm location
- **WHEN** the user drags the pin and taps "Confirmar ubicación"
- **THEN** the selected coordinates SHALL be used as the parking location

#### Scenario: Duplicate parking detected nearby
- **WHEN** the user confirms a location that is within 30 meters of an existing verified parking
- **THEN** the system SHALL display "¿Es este?" with the existing parking details
- **AND** the user SHALL be offered the choice to verify the existing parking or continue with the new proposal

### Requirement: Required fields validation
The system SHALL prevent form submission when mandatory fields (name, type) are missing, with clear visual feedback.

#### Scenario: Submission attempted without name
- **WHEN** the user attempts to proceed from step 2 without entering a parking name
- **THEN** the "Continuar" button SHALL remain disabled
- **AND** the name field SHALL be visually highlighted as required

#### Scenario: Submission attempted without type selection
- **WHEN** the user attempts to proceed from step 2 without selecting public or private type
- **THEN** the "Continuar" button SHALL remain disabled
- **AND** the type selector SHALL be visually highlighted as required

### Requirement: Multi-select feature chips
The system SHALL present parking characteristics as multi-select chips so users can mark only the features that apply.

#### Scenario: Feature chips displayed
- **WHEN** the user reaches step 2 of the proposal form
- **THEN** chips SHALL be displayed for: cubierto, cámaras, anclajes, iluminado, gratuito, 24h, en batería
- **AND** the user SHALL be able to select zero or more chips

#### Scenario: Selected chips persisted
- **WHEN** the user selects chips and navigates back then forward between steps
- **THEN** the selected chips SHALL remain selected

### Requirement: Photo processing before upload
The system SHALL compress, resize, and strip EXIF geolocation data from any photo before uploading it to Storage.

#### Scenario: Photo uploaded from camera or gallery
- **WHEN** the user selects or captures a photo in step 3
- **THEN** the system SHALL resize it to maximum 800px on the longest side
- **AND** SHALL remove all EXIF geolocation metadata
- **AND** SHALL compress it before uploading to the `parkings-photos` Storage bucket

### Requirement: Deferred Octanos confirmation on proposal verification
The system SHALL convert pending Octanos to confirmed and notify the proposer when another user successfully verifies their parking.

#### Scenario: Another user verifies the parking
- **WHEN** a different user successfully verifies the proposed parking
- **THEN** the +50 pending `octano_event` for the proposer SHALL change `status` to `'confirmed'`
- **AND** a new `octano_event` with `action_type='parking_verified_bonus'`, `points=30`, `status='confirmed'` SHALL be recorded for the proposer
- **AND** a push notification SHALL be sent to the proposer: "Tu propuesta {nombre} ha sido verificada (+30 bonus)"

### Requirement: Daily Octanos cap respected for proposals
The system SHALL save the parking proposal even when the proposer has reached the daily Octanos cap, but SHALL delay the Octanos award.

#### Scenario: Daily cap reached at proposal time
- **WHEN** the user submits a proposal after having earned 200 or more Octanos in the last 24 hours
- **THEN** the parking SHALL be saved with `status='pending'`
- **AND** the `octano_event` SHALL be recorded but SHALL NOT be confirmed until the next day
- **AND** a notice SHALL inform the user "Has alcanzado el límite diario de Octanos"

### Requirement: Deferred Octanos award on admin approval of flagged proposals
The system SHALL award the +50 pending Octanos when an administrator approves a previously `flagged` proposal, mirroring the direct-approval path. This complements the existing "Deferred Octanos confirmation on proposal verification" requirement (which converts the pending award to confirmed once a real motorcyclist verifies).

#### Scenario: Admin approves a flagged proposal
- **WHEN** an administrator approves a parking that Otto had marked `flagged`
- **THEN** `ai_review_status` SHALL become `'approved'` and `parking_status` SHALL be `'pending'`
- **AND** an `octano_event` with `action_type='propose_parking'`, `points=50`, `status='pending'` SHALL be recorded for the proposer (once; idempotent)

#### Scenario: Rejected proposal never awards Octanos
- **WHEN** a proposal is `ai_review_status='rejected'`
- **THEN** no `octano_event` SHALL ever be created for it

