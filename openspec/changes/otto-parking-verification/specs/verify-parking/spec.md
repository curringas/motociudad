## MODIFIED Requirements

### Requirement: In-situ parking verification with photo
The system SHALL allow authenticated users (level ≥ 2 Rodador) to verify a parking in situ by taking a photo with the rear camera, confirming their presence within 100m of the parking, and earning Octanos upon success. Only parkings with `ai_review_status='approved'` SHALL be eligible for community verification; parkings that Otto marked `flagged` or `rejected` MUST NOT be verifiable.

#### Scenario: Successful verification within geofence
- **WHEN** a level ≥ 2 user taps "¿Has aparcado aquí?" on an `ai_review_status='approved'` parking proposed by another user
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

#### Scenario: Non-approved parking is not verifiable
- **WHEN** a parking has `ai_review_status` of `'flagged'` or `'rejected'`
- **THEN** the "¿Has aparcado aquí?" button SHALL NOT be shown (the parking is not publicly visible)
- **AND** if the request reaches the Edge Function directly, it SHALL be rejected and no `octano_event` SHALL be inserted
