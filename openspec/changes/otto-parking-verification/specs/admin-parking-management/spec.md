## ADDED Requirements

### Requirement: Filter parkings by Otto AI review status
The panel SHALL allow `contributor` and `admin` to filter parkings by `ai_review_status`, with dedicated views for doubtful (`flagged`) and rejected (`rejected`) proposals, plus a view for approved-but-not-yet-community-verified parkings.

#### Scenario: Filter doubtful proposals
- **WHEN** an admin selects the "dudosos" filter
- **THEN** the list SHALL show only parkings with `ai_review_status='flagged'`

#### Scenario: Filter rejected proposals
- **WHEN** an admin selects the "rechazados" filter
- **THEN** the list SHALL show only parkings with `ai_review_status='rejected'`

#### Scenario: Filter approved-but-unverified-by-users
- **WHEN** an admin selects the "no verificados por usuarios" filter
- **THEN** the list SHALL show only parkings with `ai_review_status='approved'` AND `parking_status='pending'`

### Requirement: Admin approves a doubtful (flagged) parking
The system SHALL allow only an `admin` to approve a `flagged` parking, which publishes it into the community pipeline and awards the proposer's +50 pending Octanos. A `contributor` MUST NOT approve flagged parkings.

#### Scenario: Admin approves a flagged parking
- **WHEN** an admin approves a parking with `ai_review_status='flagged'`
- **THEN** its `ai_review_status` SHALL become `'approved'` and `parking_status` SHALL be `'pending'`
- **AND** an `octano_event` with `action_type='propose_parking'`, `points=50`, `status='pending'` SHALL be recorded for the proposer, exactly once (idempotent)
- **AND** the parking SHALL become publicly visible and community-verifiable

#### Scenario: Approving is idempotent
- **WHEN** an admin approves a parking that was already approved
- **THEN** no duplicate `octano_event` SHALL be created

#### Scenario: Contributor cannot approve flagged parkings
- **WHEN** a contributor attempts to approve a flagged parking
- **THEN** the operation SHALL be rejected
