# Feature Specification: Admin Forgot Password & Reset

**Feature Branch**: `003-admin-forgot-password`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "apply the forgot password logic in the admin panel so admins can change their passwords send a link after that direct them to a change password page then after submit password should be changed"

## User Scenarios & Testing *(mandatory)*

<!--
  Builds directly on 002-admin-auth: administrators are a population separate from
  students, authenticated through the managed auth backend, and the admin sign-in
  accepts administrators only. This feature adds a self-service password-recovery
  path for that same administrator population.
-->

### User Story 1 - Administrator requests a password-reset link (Priority: P1)

An administrator who cannot sign in (forgotten password) opens the admin sign-in page, follows a "Forgot password?" affordance, enters the email associated with their administrator account, and submits. The system sends a password-reset link to that email and shows a confirmation that a link has been sent if the email belongs to an administrator account.

**Why this priority**: This is the entry point of the whole recovery flow; without it an administrator who forgets their password is permanently locked out. It is the minimum viable slice.

**Independent Test**: From the admin sign-in, open the forgot-password form, submit the seeded administrator's email, and confirm a reset link is delivered to that email and a neutral confirmation is shown.

**Acceptance Scenarios**:

1. **Given** the admin sign-in page, **When** the administrator selects "Forgot password?", **Then** a form is shown that asks for their account email.
2. **Given** the forgot-password form, **When** an administrator submits the email of an existing administrator account, **Then** a single-use, time-limited reset link is sent to that email and a neutral confirmation message is shown.
3. **Given** the forgot-password form, **When** any email is submitted (admin, student, or unknown), **Then** the same neutral confirmation message is shown so the response never reveals whether an administrator account exists for that email.

---

### User Story 2 - Administrator sets a new password from the reset link (Priority: P1)

After receiving the email, the administrator clicks the reset link and is taken to a change-password page. They enter a new password (and confirm it), submit, and on success their password is changed and they are told they can now sign in with it.

**Why this priority**: This completes the recovery — the link is worthless without a page that accepts and applies a new password. Together with US1 it forms the complete, demonstrable end-to-end flow.

**Independent Test**: Use a valid, unexpired reset link, open the change-password page, submit a valid new password twice (entry + confirmation), confirm success, then sign in at the admin login with the new password and reach the dashboard.

**Acceptance Scenarios**:

1. **Given** a valid, unexpired reset link, **When** the administrator opens it, **Then** they land on a change-password page that asks for a new password and a confirmation of it.
2. **Given** the change-password page reached via a valid link, **When** the administrator submits a new password that meets the password rules and matches its confirmation, **Then** the password is changed and a success state is shown directing them to sign in.
3. **Given** a just-changed password, **When** the administrator signs in at the admin login with the new password, **Then** authentication succeeds and the old password no longer works.

---

### User Story 3 - Recovery never leaks account existence and stays admin-only (Priority: P2)

The recovery flow protects the administrator population: it does not disclose whether a given email maps to an administrator, and it does not provide a reset path to non-administrator (e.g., student) identities. Only administrator accounts receive an actionable reset link.

**Why this priority**: It preserves the admin/student separation and anti-enumeration guarantees established in 002-admin-auth. It hardens US1/US2 but those flows are demonstrable without it, so it follows them.

**Independent Test**: Submit (a) a valid student email, (b) an unknown email, and (c) a valid admin email to the forgot-password form; confirm all three return the identical neutral confirmation, and that only (c) actually results in a usable reset link.

**Acceptance Scenarios**:

1. **Given** an email belonging to a student account, **When** it is submitted to the admin forgot-password form, **Then** the neutral confirmation is shown and no usable admin reset link is issued for it.
2. **Given** an email matching no account, **When** it is submitted, **Then** the same neutral confirmation is shown and no link is issued.
3. **Given** an email belonging to an administrator account, **When** it is submitted, **Then** the same neutral confirmation is shown and a usable reset link is issued only in this case.

---

### User Story 4 - Reset links are single-use, expiring, and fail safely (Priority: P2)

Reset links cannot be reused or used after they expire, and an invalid, expired, already-used, or tampered link leads to a clear, non-actionable error rather than a password change.

**Why this priority**: This is the integrity boundary of the feature — without it a leaked or stale link is a standing account-takeover risk. It is essential hardening but layered on top of the working flow.

**Independent Test**: (a) Use a link after its expiry window; (b) use a link a second time after a successful reset; (c) open a malformed/tampered link — confirm each is rejected with a clear message and no password change occurs.

**Acceptance Scenarios**:

1. **Given** a reset link whose validity window has passed, **When** the administrator opens it, **Then** the change-password form is not usable and a clear "link expired" message offers to request a new link.
2. **Given** a reset link that was already used to change the password, **When** it is opened again, **Then** it is rejected and no further change is possible.
3. **Given** a malformed or tampered link, **When** it is opened, **Then** it is rejected with a clear error and no password change occurs.

---

### Edge Cases

- **New password fails the rules**: submitting a too-short/weak new password is blocked with a clear validation message before any change is applied.
- **Confirmation mismatch**: the new password and its confirmation must match; a mismatch is blocked with a clear message.
- **New password equals current password**: handled per the auth backend's policy; the user receives a clear message and is not left in an ambiguous state.
- **Multiple requests**: requesting several links in succession is rate-limited; superseded links need not remain valid, and the user still sees the neutral confirmation each time.
- **Whitespace / letter-case in email**: the submitted email is trimmed and matched case-insensitively, consistent with admin sign-in.
- **Link opened while already signed in**: the change-password page still functions for the account the link belongs to; on success, other active sessions for that account are ended.
- **Empty email on the request form / empty fields on the change-password form**: blocked with clear validation before submission.
- **Reset of a non-existent admin via a guessed link**: impossible — links are unguessable, single-use, and bound to a specific administrator account.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide, from the admin sign-in surface, a clearly labeled way to begin password recovery ("Forgot password?") that leads to a form requesting the administrator's account email.
- **FR-002**: System MUST require a non-empty email on the recovery request form and block submission with clear validation when it is missing.
- **FR-003**: System MUST issue a password-reset link **only** for an email that belongs to an existing administrator account; non-administrator (e.g., student) and unknown emails MUST NOT receive a usable admin reset link.
- **FR-004**: System MUST return the **same** neutral confirmation message for every recovery request regardless of whether the email maps to an administrator, so the response never discloses account existence or role.
- **FR-005**: Reset links MUST be unguessable, bound to a single administrator account, **single-use**, and valid only for a bounded time window; after expiry or first successful use the link MUST no longer permit a password change.
- **FR-006**: Following a valid, unexpired link MUST direct the administrator to a change-password page that collects a new password and a confirmation of it.
- **FR-007**: System MUST require the new password and its confirmation to be present, to match each other, and to satisfy the platform's password rules; any violation MUST be blocked with a clear validation message and MUST NOT change the password.
- **FR-008**: On a valid submission, System MUST change the administrator's stored credential so that the new password authenticates and the previous password no longer does.
- **FR-009**: System MUST reject invalid, expired, already-used, or tampered links with a clear, non-actionable error that offers to request a new link, and MUST NOT change any password in those cases.
- **FR-010**: The recovery and change-password flows MUST apply only to the administrator population and MUST NOT expose, enumerate, or alter student credentials, preserving the admin/student separation.
- **FR-011**: System MUST store credentials securely (never as recoverable plaintext); the reset flow MUST never display, email, or otherwise transmit an existing or new password in readable form beyond the user's own entry.
- **FR-012**: On a successful password change, System MUST invalidate other active sessions for that administrator account so a previously compromised session cannot persist.
- **FR-013**: System MUST direct the administrator, after a successful change, to the admin sign-in so they can authenticate with the new password; the flow MUST remain within the admin panel context and never cross into the student panel.
- **FR-014**: System MUST rate-limit recovery requests and reset attempts to resist enumeration and abuse, while still returning the neutral confirmation to the requester.
- **FR-015**: System MUST record recovery events (request issued, reset succeeded, reset rejected) for traceability without ever storing a password or returning the internal reason to the client.

### Key Entities *(include if feature involves data)*

- **Administrator account**: The identity whose password is being recovered; the only population eligible for the admin reset flow (separate from students, per 002-admin-auth).
- **Password-reset link / token**: An unguessable, single-use, time-limited credential bound to one administrator account that authorizes exactly one password change.
- **Change-password submission**: The new-password + confirmation input applied to the administrator account once a valid link is presented.
- **Recovery event (audit)**: A record that a reset was requested, succeeded, or was rejected — category only, never the password and never returned to the client.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator who forgot their password can request a link, set a new password, and sign in with it end-to-end in under 5 minutes without assistance.
- **SC-002**: 100% of recovery requests — for admin, student, and unknown emails — return an identical neutral confirmation, so the response never reveals whether an administrator account exists.
- **SC-003**: 100% of reset links are rejected after their validity window passes and after their first successful use (no reuse), verified by automated tests.
- **SC-004**: 0 student credentials are exposed or altered through the admin recovery flow, verified by automated tests.
- **SC-005**: After a successful reset, the new password authenticates in 100% of cases and the previous password is rejected in 100% of cases.
- **SC-006**: 100% of change-password submissions that violate the password rules or whose confirmation does not match are blocked before any credential change occurs.
- **SC-007**: After a successful reset, other active sessions for that administrator are invalidated in 100% of cases.

## Assumptions

- **Builds on 002-admin-auth**: The administrator population, the managed authentication backend (the project's Supabase cloud project as system of record for credentials and tokens), the admin/student separation, and the anti-enumeration philosophy from `002-admin-auth` are reused; this feature only adds the self-service recovery path.
- **Email delivery**: The managed auth backend's transactional email/recovery capability is used to deliver reset links; standing up a separate email service is out of scope.
- **Scope is the email-link flow**: This feature covers the *unauthenticated* "forgot password" recovery flow described by the user (request link → change-password page → password changed). An in-app "change my password while already signed in" surface is out of scope unless added later.
- **Password rules**: New-password strength follows the auth backend's configured policy (minimum length and basic strength); a project-specific stronger policy is out of scope here unless specified.
- **Link lifetime**: Reset links are single-use and expire after a bounded window (industry-standard short window, e.g., on the order of an hour); the exact duration follows the auth backend's configured default.
- **Students unaffected**: Student authentication and any future student password recovery are out of scope; this feature touches only administrator credentials.
- **English / LTR / mobile-first & accessible**: All new screens (forgot-password form, change-password page, success/error states) follow the constitution — English-only LTR, responsive from 320px, touch-friendly, keyboard-accessible with visible focus, and WCAG 2.1 AA contrast.
- **Centralized copy & brand tokens**: All new user-facing strings come from the shared strings module and all styling uses the shared brand tokens (no inline literals, no hex literals), per CLAUDE.md.
