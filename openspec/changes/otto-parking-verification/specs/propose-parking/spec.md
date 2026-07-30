## MODIFIED Requirements

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

### Requirement: Deferred Octanos award on admin approval of flagged proposals
The system SHALL award the +50 pending Octanos when an administrator approves a previously `flagged` proposal, mirroring the direct-approval path. This complements the existing "Deferred Octanos confirmation on proposal verification" requirement (which converts the pending award to confirmed once a real motorcyclist verifies).

#### Scenario: Admin approves a flagged proposal
- **WHEN** an administrator approves a parking that Otto had marked `flagged`
- **THEN** `ai_review_status` SHALL become `'approved'` and `parking_status` SHALL be `'pending'`
- **AND** an `octano_event` with `action_type='propose_parking'`, `points=50`, `status='pending'` SHALL be recorded for the proposer (once; idempotent)

#### Scenario: Rejected proposal never awards Octanos
- **WHEN** a proposal is `ai_review_status='rejected'`
- **THEN** no `octano_event` SHALL ever be created for it
