# Feature Specification: Error Logging

**Feature Branch**: `009-error-logging`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "i want to create an error logs table in the database that trace all function in the code and whenever any error happen it must be logged to this table with detail description as possible"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every server-side error is recorded automatically (Priority: P1)

A member or admin performs any operation in the app (signing in, adding a member, uploading material metadata, submitting an assignment, scanning a QR code, etc.). If that operation fails with an unexpected error anywhere in the code path, the system automatically records a detailed error entry in a central error log — without the person doing anything extra and without changing what they see (they still get the normal friendly error message).

**Why this priority**: This is the core of the feature. Today, when something fails in production the team has no durable trace of what went wrong, where, or for whom; diagnosing issues (like the recent file-upload incident) requires reproduction guesswork. Capturing every error with full detail is the entire value proposition — everything else builds on it.

**Independent Test**: Can be fully tested by forcing a failure inside any server operation (e.g., a simulated database fault during "add member") and verifying that (a) the user still sees the standard friendly error message, and (b) a new error log entry exists containing when it happened, where in the code it happened, the error message, technical details, and who triggered it.

**Acceptance Scenarios**:

1. **Given** an admin is adding a member and an unexpected failure occurs in that operation, **When** the operation fails, **Then** an error log entry is recorded containing the timestamp, the name of the operation/function that failed, the full error message and technical details (stack/cause), and the acting admin's identity and role.
2. **Given** a student performs an action that fails unexpectedly, **When** the failure occurs, **Then** an error entry is recorded with the student's identity, their wave, and the failing operation — and the student sees only the normal generic error message, never the technical details.
3. **Given** an unauthenticated visitor triggers a server error (e.g., on a sign-in or auth-confirmation flow), **When** the failure occurs, **Then** an error entry is still recorded with the acting user marked as anonymous.
4. **Given** the error log itself cannot be written (e.g., the log store is unavailable), **When** an error occurs, **Then** the user's experience is unchanged and the failure to log is reported to the operational console instead — logging never causes or worsens a user-facing failure.

---

### User Story 2 - Administrator inspects error details to diagnose an issue (Priority: P2)

A user reports "I got an error when I tried to upload my assignment yesterday." An administrator looks up the error log, filters to the relevant time window, and finds the matching entry — which tells them exactly which operation failed, why, for which user, and with what context — without having to reproduce the problem.

**Why this priority**: Captured errors are only useful if someone can read and act on them. This story makes the log consumable for diagnosis, but it depends on Story 1 existing first, and in a pinch the team can read the raw table directly.

**Independent Test**: Seed several error entries (different times, users, operations), then verify an administrator can retrieve them, see the newest first, and read every detail field; verify a student cannot read any of them.

**Acceptance Scenarios**:

1. **Given** error entries exist, **When** an administrator views the error log, **Then** entries are presented newest-first and each shows when, where (operation/function), what (message + technical detail), who (user identity and role, or anonymous), and any captured context.
2. **Given** a student session, **When** the student attempts to read error log data by any means, **Then** access is denied and no error information is disclosed.
3. **Given** an error entry whose context included sensitive input (a password, a session token, file contents), **When** an administrator views the entry, **Then** those sensitive values are absent or redacted — they were never stored.

---

### User Story 3 - Client-side crashes are reported and recorded (Priority: P3)

A user's browser hits a rendering crash (the panel's error screen appears). The system reports that failure back so it lands in the same central error log, giving the team visibility into failures that never reach the server.

**Why this priority**: Valuable for completeness, but most failures in this app occur in server operations (Story 1). Client-side capture is additive and can ship later without reducing the value of Stories 1–2.

**Independent Test**: Force a rendering crash in a panel page, verify the standard error screen still appears, and verify a corresponding error entry exists marked as client-originated with the page and error details.

**Acceptance Scenarios**:

1. **Given** a page crashes in the browser and the panel error screen is shown, **When** the crash is reported, **Then** an error entry is recorded marked as client-side, including the page where it happened, the error message, and the signed-in user (if any).
2. **Given** the report from the browser fails to send (offline, blocked), **When** the crash occurs, **Then** the user's recovery experience (error screen with retry) is unaffected.

---

### Edge Cases

- **Logging failure must not cascade**: if writing the error entry itself fails, the original operation's user-facing behavior is unchanged and the logging failure goes to the operational console. The log write must never throw back into the calling code.
- **The error store is the thing that's down**: when the database itself is unreachable, error entries obviously cannot be persisted there; the system falls back to console/host logs without crashing.
- **Sensitive data in context**: errors raised while handling passwords, tokens, magic links, or uploaded file content must never persist those values; context capture is allow-listed/redacted, not raw.
- **Error bursts**: a failing dependency can produce hundreds of identical errors in seconds; logging each entry must not noticeably slow user operations or exhaust storage (bounded field sizes, and entries remain individually small).
- **Oversized details**: very large stack traces, messages, or context payloads are truncated to bounded sizes rather than rejected.
- **Anonymous and partially-authenticated actors**: errors before/during sign-in carry no user identity; entries record the actor as anonymous rather than failing to log.
- **Expected vs. unexpected failures**: validation rejections and permission denials shown to users by design (e.g., "Invalid email", generic denial messages) are not unexpected errors and are not logged here — only genuine failures are.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist a record of every unexpected error that occurs in any server-side operation (all user-initiated mutations, authentication/confirmation flows, and server-rendered page loads) to a central error log.
- **FR-002**: Each error record MUST include, at minimum: the moment it occurred; an identifier of the failing operation/function (specific enough to locate it in the code); the error message; full technical detail available at capture time (stack trace / underlying cause); the severity; and the source surface (admin panel, student panel, or background/system).
- **FR-003**: Each error record MUST identify the acting user when one is signed in — their identity, role, and (for students) their wave — and MUST mark the actor as anonymous otherwise.
- **FR-004**: Each error record MUST capture relevant request context (e.g., which page or action, key non-sensitive parameters) sufficient to reconstruct what the user was doing.
- **FR-005**: The system MUST never store secrets or sensitive values in error records — including passwords, session tokens, magic-link tokens, authentication cookies, and uploaded file contents. Context capture must be redacted or allow-listed.
- **FR-006**: Recording an error MUST never change the user-visible outcome of the original operation: users continue to receive the existing friendly error messages, and a failure to write the log itself MUST be swallowed (falling back to the operational console).
- **FR-007**: Error records MUST be readable by administrators only. Students and anonymous users MUST NOT be able to read, infer, or enumerate any error data. This boundary MUST be enforced server-side and covered by a test.
- **FR-008**: Error records MUST be immutable from the application: no app user (including administrators) can edit or delete entries through the app. Cleanup happens only via retention (FR-009).
- **FR-009**: Error records MUST be retained for 90 days, after which they become eligible for purge.
- **FR-010**: Free-text fields in an error record (message, technical detail, context) MUST be truncated to bounded maximum sizes so a single error cannot create an oversized entry.
- **FR-011**: Administrators MUST be able to view recorded errors newest-first with all captured detail (per User Story 2).
- **FR-012**: Client-side rendering crashes that reach a panel error screen SHOULD be reported and recorded in the same log, marked as client-originated, including the page and the signed-in user when available (per User Story 3). Failure to report MUST not affect the user's recovery experience.

### Key Entities

- **Error Log Entry**: One recorded failure. Attributes: occurrence timestamp; source surface (admin / student / system); origin (server or client); failing operation/function identifier; error message; technical detail (stack/cause, truncated); severity; acting user reference, role, and wave (all optional — absent for anonymous); request context (page/action and redacted parameters); environment indicator (production vs. development). Entries are append-only and relate optionally to an existing user; they must remain readable even after the referenced user is removed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unexpected server-side failures in covered operations produce exactly one error log entry (verified by failure-injection tests across the app's mutation and auth flows).
- **SC-002**: For any logged error, a person diagnosing it can determine where it happened (operation/function), what happened (message + technical detail), and who was affected, from the log entry alone — without reproducing the failure — in under 5 minutes.
- **SC-003**: Error capture adds no perceptible delay to user operations: operations that fail respond to the user as fast as they do today, and operations that succeed are entirely unaffected.
- **SC-004**: Zero error log entries contain a password, token, cookie value, or uploaded file content (verified by tests that inject such values into failing operations and assert their absence from the stored entry).
- **SC-005**: A logging-system outage causes zero additional user-facing failures (verified by failure-injection on the log write itself).
- **SC-006**: Non-admin access to error data is denied in 100% of attempts, covered by an automated cross-role test.

## Assumptions

- **"Trace all function in the code" is interpreted as comprehensive error capture, not call tracing**: the requirement is that an error arising from *any* function in the codebase gets logged with enough detail to locate it — not that every function invocation is traced/instrumented for performance. Performance/audit tracing of successful calls is out of scope.
- **Unexpected errors only**: by-design rejections (validation messages, generic permission denials) are existing UX, not failures, and are excluded; including them would flood the log and dilute its diagnostic value.
- **Admin-only visibility**: error details (stack traces, internal identifiers) are sensitive operational data; only administrators may read them, consistent with the app's existing trust model. No student-facing surface is involved.
- **Viewing starts minimal**: User Story 2 requires that admins can view entries newest-first with full detail; a richer search/filter/alerting experience is out of scope for this feature and can be layered on later.
- **90-day retention** is the default for operational diagnostics in this product's context; no legal/compliance driver was stated that would require longer.
- **Existing friendly error messaging is unchanged**: this feature adds recording behind the scenes; it does not redesign what end users see when something fails.
- **The existing audit log is separate**: the current admin-auth audit trail records expected security events; the error log records unexpected failures. They serve different questions and are not merged.
