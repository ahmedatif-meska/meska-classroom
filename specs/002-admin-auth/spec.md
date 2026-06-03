# Feature Specification: Admin Authentication & Account Separation

**Feature Branch**: `002-admin-auth`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "first I will login as an admin user with role admin who has full control (id ahmedatif@meska.ai, password set via `SEED_ADMIN_PASSWORD`). Create this user in the database (Supabase cloud). This is a multi-tenant app — use best-practice schema design and JWT if needed. The most important rule: in the database the admin users must be separated from the student users. After applying this, make the username and password on the admin login mandatory, and the admin login must accept admin users only."

## Clarifications

### Session 2026-06-03

- Q: Students will log in to the student panel with Student ID + password (admin-created accounts). How should student credentials be stored and authenticated? → A: **Supabase Auth (role-based)** — students are authenticated through Supabase Auth like admins, using a synthesized email derived from their Student ID and an immutable `role='student'` claim. Admin↔student separation is preserved by the role claim plus separate profile tables (`admin_profiles` vs `students`), not by a separate credential store. Implementation of student login is a **future student-auth feature**; this clarification fixes its direction.
- Q: Who creates student accounts? → A: **Administrators provision students** (Student ID + initial password). There is no student self-registration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrator signs in and gains full control (Priority: P1)

A provisioned administrator opens the admin portal, enters their email/username and password, and on success is taken to the admin dashboard where they have full control over administrative capabilities.

**Why this priority**: This is the core of the feature and the entry point for all administrative work. Without it there is no administrator access and nothing else can be exercised. It is the minimum viable slice.

**Independent Test**: Seed the bootstrap administrator, submit the correct email and password on the admin login, and confirm the user lands on the admin dashboard with an authenticated admin session.

**Acceptance Scenarios**:

1. **Given** the bootstrap administrator account exists, **When** the administrator submits the correct email and correct password, **Then** they are authenticated and redirected to the admin dashboard/home.
2. **Given** an authenticated administrator, **When** they access an admin-only area, **Then** access is granted because their session carries the administrator role.
3. **Given** no valid admin session, **When** an unauthenticated visitor requests an admin-only area directly, **Then** access is denied and they are routed to the admin sign-in.

---

### User Story 2 - Admin login accepts administrators only (Priority: P1)

The admin login authenticates only identities that hold the administrator role. A student account (or any non-administrator), even with otherwise-valid credentials, is rejected at the admin login. Incorrect passwords and unknown identities are also rejected.

**Why this priority**: This is the explicit security rule of the request ("accept admin users only") and protects the administrative surface from non-admin access. It is non-negotiable.

**Independent Test**: Attempt the admin login with (a) a valid student credential, (b) a wrong password for the admin, and (c) an unknown email — and confirm all three are denied with a generic failure message and no admin session is created.

**Acceptance Scenarios**:

1. **Given** a valid student account, **When** its credentials are submitted at the admin login, **Then** authentication is denied and no admin session is created.
2. **Given** the administrator account, **When** an incorrect password is submitted, **Then** authentication is denied with a generic message that does not reveal whether the email or the password was wrong.
3. **Given** an email that matches no account, **When** it is submitted at the admin login, **Then** authentication is denied with the same generic message.

---

### User Story 3 - Mandatory email and password on the admin login (Priority: P2)

The admin login form requires both the email/username and the password. An attempt with either field empty is blocked with clear validation before any authentication is attempted.

**Why this priority**: Enforcing mandatory fields is the second explicit instruction and improves both security and UX, but it builds on the sign-in flow (US1) and the admin-only rule (US2), so it follows them.

**Independent Test**: Submit the admin login with an empty email, then with an empty password, then with both empty, and confirm each attempt is blocked with a visible validation message and no network authentication call is made.

**Acceptance Scenarios**:

1. **Given** the admin login form, **When** the user submits with an empty email, **Then** submission is blocked and a validation message marks the email as required.
2. **Given** the admin login form, **When** the user submits with an empty password, **Then** submission is blocked and a validation message marks the password as required.
3. **Given** the admin login form, **When** both fields are filled, **Then** the form submits and an authentication attempt proceeds.

---

### User Story 4 - Administrators and students are stored separately (Priority: P1)

Administrator accounts and student accounts are persisted as separate, distinguishable populations in the data store, so the two never share a single undifferentiated record set and one population cannot be mistaken for or resolved through the other.

**Why this priority**: The user named this "the most important rule." It is the structural guarantee that makes the admin-only rule (US2) enforceable and keeps tenant/student data isolated from administrative identities.

**Independent Test**: Inspect the data store after seeding and confirm administrator records and student records live in distinct, role-separated structures; confirm that a query over the student population never returns the administrator and vice versa.

**Acceptance Scenarios**:

1. **Given** the seeded administrator and at least one student, **When** the administrator population is listed, **Then** the student does not appear in it.
2. **Given** the same data, **When** the student population is listed, **Then** the administrator does not appear in it.
3. **Given** a multi-tenant data set, **When** data scoped to one tenant is read, **Then** records belonging to other tenants are not returned.

---

### Edge Cases

- What happens when the admin submits leading/trailing whitespace or differing letter-case in the email? (Email match should be case-insensitive and trimmed.)
- How does the system handle repeated failed admin sign-in attempts? (Generic failures; the system should not leak which field was wrong and should resist brute force.)
- What happens when an authenticated admin session expires or is revoked while the admin is using an admin-only area? (Next protected action is denied and the admin is returned to sign-in.)
- What happens if the bootstrap administrator already exists when seeding runs again? (Seeding is idempotent — it does not create a duplicate or overwrite a rotated password.)
- What happens when a student credential is correct for the student panel but is replayed against the admin login? (Denied — see US2.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an admin sign-in that authenticates an identity by email/username and password.
- **FR-002**: System MUST require both the email/username and the password to be present (non-empty) before an admin sign-in attempt is accepted, and MUST block submission with clear validation when either is missing.
- **FR-003**: System MUST grant admin authentication only to identities that hold the administrator role; an identity without the administrator role MUST be rejected at the admin sign-in even when its credentials are otherwise valid.
- **FR-004**: System MUST reject admin sign-in attempts that use an incorrect password or an unknown identity, returning a single generic failure message that does not disclose whether the email or the password was incorrect.
- **FR-005**: System MUST persist administrator accounts separately from student accounts so the two populations are distinguishable and isolated, and so a read over one population never returns members of the other.
- **FR-006**: System MUST provision an initial ("bootstrap") administrator account with identity `ahmedatif@meska.ai` and full-control privileges, so the platform has at least one administrator from first launch. Provisioning MUST be idempotent (re-running it does not duplicate the account).
- **FR-007**: System MUST grant the administrator role full control over the platform's administrative capabilities.
- **FR-008**: System MUST isolate tenant-scoped data server-side so that records belonging to one tenant are not accessible to users of another tenant.
- **FR-009**: On successful admin sign-in, System MUST direct the administrator to the admin dashboard/home.
- **FR-010**: System MUST maintain an authenticated admin session and MUST deny access to admin-only areas to any request lacking a valid admin session.
- **FR-011**: System MUST store credentials securely (never as recoverable plaintext) and MUST NOT expose administrator credentials or identities to student-facing surfaces.
- **FR-012**: The administrator's panel context MUST remain the admin panel on successful sign-in (links and navigation resolve to admin home), never crossing into the student panel.

### Key Entities *(include if feature involves data)*

- **Administrator account**: An identity authorized to access the admin panel. Holds an email/username, a securely stored credential, and the administrator role (full control). Stored separately from students.
- **Student account**: An identity belonging to the learner population, scoped to a tenant, **admin-created**, and authenticating at the **student panel** with Student ID + password (its own login surface). Distinguished from administrators by the `role` claim and a separate profile table; never authenticates at the admin login. (Student login itself is delivered by a future feature.)
- **Administrator role / privileges**: The full-control permission set attached to administrator accounts and carried in the authenticated session.
- **Tenant**: The isolation boundary for student-scoped data; every tenant-scoped record belongs to exactly one tenant and is not readable across tenants.
- **Admin session**: The authenticated state proving the current request is made by an administrator; required for every admin-only area.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The bootstrap administrator can sign in with the correct email and password and reach the admin dashboard on the first attempt, in under 30 seconds end to end.
- **SC-002**: 100% of admin sign-in attempts made with non-administrator (e.g., student) credentials are denied.
- **SC-003**: 100% of admin sign-in attempts with an empty email and/or empty password are blocked before any authentication call is made.
- **SC-004**: 0 student-population records are returned by any administrator-population read, and 0 administrator records are returned by any student-population read (no cross-population leakage), verified by automated tests.
- **SC-005**: 0% cross-tenant leakage — attempts to read another tenant's data return no records, verified by automated tests.
- **SC-006**: Admin sign-in failures (wrong password, unknown email, non-admin identity) are indistinguishable to the caller — they return the same generic message in 100% of cases.

## Assumptions

- **Admin scope**: "Full control" is interpreted as a platform super-administrator whose authority is not limited to a single tenant. Per-tenant administrator roles are out of scope for this feature unless reintroduced later.
- **Provisioning model**: Administrators are provisioned by the platform (seed/back-office), not via public self-registration. **Administrators provision student accounts** (Student ID + initial password); students do not self-register. Students sign in to the **student panel** with their **Student ID + password** (delivered by a future student-auth feature) — a flow separate from, and never accepted by, the admin login.
- **Identity platform**: A managed authentication backend (the project's Supabase cloud project) is the system of record for credentials, roles, and session tokens; secure password hashing and token issuance are handled by that platform rather than re-implemented.
- **Separation mechanism**: Admin/student separation is realized by an immutable, server-set `role` claim plus distinct role-scoped profile tables (`admin_profiles` vs `students`) with server-enforced access rules — satisfying "admins must be separated from students" while both populations share the managed credential store. Each login surface accepts only its own role (admin login rejects students; student login rejects admins). Consistent with the constitution's wave-isolation principle for student data.
- **Multi-tenancy**: "Tenant" is the organizational isolation boundary for student-scoped data; isolation is enforced server-side on every tenant-scoped read.
- **Credentials are bootstrap/rotatable**: The provided email and password are initial values intended to be rotated after first launch; secrets (service keys, passwords) are treated as confidential and are not committed to the repository.
- **Builds on existing panels**: This feature adds real authentication behind the existing Admin sign-in surface from the classroom-foundation feature. Student authentication (Student ID + password) and admin-driven student provisioning are **out of scope here** and land in a separate student-auth feature; this feature only establishes the separated identity foundation they build on.
