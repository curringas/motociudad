## ADDED Requirements

### Requirement: Otto AI review of parking proposals
The system SHALL run an AI review ("Otto") synchronously when a parking is proposed, evaluating whether the name, notes, and photo correspond to a real motorcycle parking spot, and SHALL assign exactly one AI review verdict: `approved`, `flagged`, or `rejected`.

#### Scenario: Photo and text clearly describe a motorcycle parking
- **WHEN** a user proposes a parking whose name, notes, and photo coherently describe a motorcycle parking spot
- **THEN** Otto SHALL set `ai_review_status = 'approved'`
- **AND** the parking SHALL enter the community pipeline with `parking_status = 'pending'`
- **AND** `ai_reviewed_at` SHALL be set and `ai_review_source` SHALL be `'provider'` (or `'prefilter'` if resolved by deterministic pre-filters)

#### Scenario: Content clearly is not a motorcycle parking
- **WHEN** the photo or text clearly does not correspond to a motorcycle parking (e.g. an unrelated photo, gibberish name)
- **THEN** Otto SHALL set `ai_review_status = 'rejected'` with an `ai_review_reason`
- **AND** the parking SHALL NOT be publicly visible nor community-verifiable
- **AND** no `octano_event` SHALL be created

#### Scenario: Content is doubtful
- **WHEN** Otto cannot confidently approve or reject the proposal
- **THEN** Otto SHALL set `ai_review_status = 'flagged'` with an `ai_review_reason`
- **AND** the parking SHALL NOT be publicly visible nor community-verifiable until an administrator approves it
- **AND** no `octano_event` SHALL be created yet

### Requirement: Independent AI review status
The system SHALL store Otto's verdict in an `ai_review_status` field on `parkings` that is INDEPENDENT of `parking_status` (community verification). The enum `parking_ai_review_status` SHALL be `approved | flagged | rejected` and MUST NOT reuse or alter the `parking_status` enum.

#### Scenario: AI review and community verification are orthogonal
- **WHEN** a parking is `ai_review_status = 'approved'`
- **THEN** its `parking_status` SHALL follow the community lifecycle independently (`pending` → `verified` on first in-situ verification)

#### Scenario: Safe default prevents accidental publication
- **WHEN** a parking row exists without an explicit AI verdict having been written
- **THEN** its `ai_review_status` SHALL default to `'flagged'` so it is never publicly visible by accident

### Requirement: Failsafe to flagged on AI error or timeout
The system SHALL degrade gracefully: if the vision/text provider errors or times out, the proposal SHALL be preserved as `flagged` rather than blocking the user or losing the proposal.

#### Scenario: Provider times out
- **WHEN** the AI provider does not respond within the configured timeout during a proposal
- **THEN** `ai_review_status` SHALL be set to `'flagged'` with `ai_review_source = 'failsafe'`
- **AND** the user SHALL receive the doubtful-result message, not an error

### Requirement: Text-only review when no photo is provided
The system SHALL allow proposing a parking without a photo and SHALL have Otto review using name and notes only.

#### Scenario: Proposal without photo
- **WHEN** a user proposes a parking without uploading a photo
- **THEN** Otto SHALL evaluate name and notes only (no image)
- **AND** SHALL assign one of `approved` / `flagged` / `rejected` from the text alone

### Requirement: Admin email notification on flagged and rejected
The system SHALL send an email to the administrator, via the project's own SMTP, for every parking that Otto marks `flagged` or `rejected`. Email delivery SHALL be best-effort and MUST NOT change the verdict or fail the proposal response.

#### Scenario: Flagged proposal notifies admin
- **WHEN** Otto marks a proposal as `flagged`
- **THEN** an email SHALL be sent to the configured admin address describing the parking and reason

#### Scenario: Rejected proposal notifies admin
- **WHEN** Otto marks a proposal as `rejected`
- **THEN** an email SHALL be sent to the configured admin address describing the parking and reason

#### Scenario: Email failure does not break the verdict
- **WHEN** the SMTP send fails
- **THEN** the proposal SHALL still be recorded with its verdict and the user SHALL still receive their in-app message

### Requirement: Proposer feedback during and after review
The system SHALL show the proposer an in-progress indicator during the synchronous review and a verdict-specific message afterward, branded as the AI agent "Otto".

#### Scenario: In-progress indicator
- **WHEN** the proposal is being reviewed
- **THEN** the UI SHALL show "Nuestro agente motero de IA Otto está verificando tu aportación…"

#### Scenario: Approved message
- **WHEN** the verdict is `approved`
- **THEN** the UI SHALL show that the parking is approved and visible, and that +50 Octanos are pending until a real motorcyclist verifies it

#### Scenario: Rejected message
- **WHEN** the verdict is `rejected`
- **THEN** the UI SHALL show that the parking did not pass verification because it does not appear to be a real motorcycle parking

#### Scenario: Flagged message
- **WHEN** the verdict is `flagged`
- **THEN** the UI SHALL show that the contribution is doubtful, an administrator will review it, and it will be available in a few hours

### Requirement: Vision provider is server-side and OpenAI-compatible
The system SHALL call the vision/text provider only from the Edge Function (never from the client), using an OpenAI-compatible request shape consistent with the existing comment-moderation module. Provider credentials MUST NOT be exposed in client code.

#### Scenario: Review runs server-side
- **WHEN** a proposal triggers Otto
- **THEN** the provider call SHALL occur inside the Edge Function with service-role privileges
- **AND** no provider API key SHALL be present in client bundles
