# Feature Specification: Admin Management

**Feature Branch**: `004-admin-management`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "i want to create admin management feature in the admin panel as per the image. Instead of 'Users & Roles' tab named 'Admin Management' tab, then the page should list all the admins that exist; for now all admins will have one role as admin. Then I want an 'Add Admin' button the same as the screen; after clicking it a pop-up exactly like image 2 appears. After the admin is created successfully, an email with a magic link is sent to the email asking him to create his password so he can log in with it. Also on the admin management page an option to remove admins we want to have it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the list of administrators (Priority: P1)

A signed-in administrator opens the admin panel and selects the **Admin Management** entry in the navigation (the entry that previously read "Users & Roles"). They land on the Admin Management page, which lists every administrator account in a table showing each admin's name, email, role, status, and the date the account was created. The administrator viewing the page sees their own row marked so they can recognize it.

**Why this priority**: The list is the foundation of the feature — it is the surface every other action (add, remove) is launched from and confirmed against. Without it there is nothing to manage. It is the minimum viable slice.

**Independent Test**: Sign in as an administrator, open the Admin Management page, and confirm every existing administrator appears as a row with name, email, role, status, and created date, and that no student or non-administrator appears.

**Acceptance Scenarios**:

1. **Given** an authenticated administrator and a set of existing administrator accounts, **When** they open the Admin Management page, **Then** every administrator account is listed with its name, email, role, status, and created date.
2. **Given** the Admin Management page is open, **When** the administrator views the row that represents their own account, **Then** that row is visibly marked as the current user.
3. **Given** the navigation, **When** the administrator looks for the former "Users & Roles" entry, **Then** it now reads "Admin Management" and routing to it opens this page.
4. **Given** student accounts also exist in the platform, **When** the Admin Management list is shown, **Then** no student or non-administrator identity appears in it.

---

### User Story 2 - Add a new administrator (Priority: P1)

An administrator clicks **Add Admin** on the Admin Management page. A modal titled "Create New Admin" opens, collecting the new admin's first name, last name, email address, and role (the only available role is "Admin"). On submit, the system creates the new administrator account and sends an email containing a secure magic link inviting the new admin to set their own password. The modal can be dismissed with Cancel or a close control without creating anything. After a successful creation, the new administrator appears in the list.

**Why this priority**: Provisioning new administrators is the primary purpose of the feature and the second half of the MVP — viewing plus adding delivers the core value of self-service admin management without back-office seeding.

**Independent Test**: Open the modal, fill in a first name, last name, and a valid unused email, submit, and confirm (a) the new admin appears in the list, and (b) an invitation email with a password-setup magic link is dispatched to that address.

**Acceptance Scenarios**:

1. **Given** the Admin Management page, **When** the administrator clicks "Add Admin", **Then** a "Create New Admin" modal opens with fields for first name, last name, email address, and role (defaulting to / fixed at "Admin").
2. **Given** the modal with all required fields filled with valid values, **When** the administrator submits, **Then** a new administrator account is created, the modal closes, and the new admin appears in the list.
3. **Given** a successful creation, **When** the account is created, **Then** an email containing a single-use, time-limited magic link to set a password is sent to the new admin's email address.
4. **Given** the modal is open, **When** the administrator selects Cancel or the close control, **Then** the modal closes and no account is created.
5. **Given** the modal, **When** the administrator submits with a missing or invalid required field (empty name, malformed email), **Then** submission is blocked with a clear validation message and no account is created.
6. **Given** the modal, **When** the administrator submits an email that already belongs to an existing administrator, **Then** creation is rejected with a message that the email is already in use and no duplicate account is created.
7. **Given** a created admin whose invitation email could not be dispatched, **When** creation completes, **Then** the creator is told the invite was not sent (the admin remains pending) and a re-send affordance is available.
8. **Given** an administrator still in the pending-password state, **When** the creator chooses re-send invite, **Then** a fresh single-use link is issued (invalidating any prior link) and emailed; the control is not offered for already-active admins.

---

### User Story 3 - New administrator sets their password via the magic link (Priority: P1)

The newly created administrator receives the invitation email, follows the magic link, and is taken to a page where they choose a password. After setting a valid password, they can sign in to the admin panel with their email and that password. The link is single-use and expires after a limited time; an expired or already-used link cannot set a password.

**Why this priority**: Without the new admin being able to set a password and sign in, the "add" flow produces an unusable account. This story completes the provisioning loop and is required for the feature to deliver real value.

**Independent Test**: Create an admin, open the emailed magic link, set a password meeting the policy, then sign in to the admin panel with the new email and password and reach the admin dashboard.

**Acceptance Scenarios**:

1. **Given** a new administrator who received the invitation email, **When** they follow the magic link, **Then** they are presented with a page to create their password.
2. **Given** the set-password page reached via a valid link, **When** the new admin submits a password meeting the password policy, **Then** the password is set and they can subsequently sign in at the admin login with their email and that password.
3. **Given** a magic link that has expired or already been used, **When** the recipient opens it, **Then** they cannot set a password and are shown a clear message (with a path to request a new invitation).
4. **Given** a new administrator who has not yet set a password, **When** they attempt to sign in at the admin login, **Then** sign-in is denied until the password is set.

---

### User Story 4 - Remove an administrator (Priority: P2)

From the Admin Management list, an administrator removes another administrator using the row's remove action. The system asks for confirmation before removing. After confirmation, the removed administrator no longer appears in the list and can no longer sign in to the admin panel. To preserve continuity, an administrator cannot remove their own account, and the last remaining **active** administrator cannot be removed (a still-pending admin does not count toward this minimum).

**Why this priority**: Removal is essential for lifecycle management but depends on the list (US1) and is secondary to being able to create admins (US2). It rounds out the feature once the core provisioning works.

**Independent Test**: With at least two administrators, trigger remove on one (not yourself), confirm, and verify the admin disappears from the list and is denied at the admin login; separately confirm self-removal and last-admin removal are blocked.

**Acceptance Scenarios**:

1. **Given** the Admin Management list with at least two administrators, **When** the administrator triggers remove on another admin's row and confirms, **Then** that admin is removed and no longer appears in the list.
2. **Given** a removed administrator, **When** that person attempts to sign in to the admin panel, **Then** sign-in is denied.
3. **Given** the remove action is triggered, **When** the confirmation prompt appears and the administrator cancels, **Then** no admin is removed.
4. **Given** an administrator viewing their own row, **When** they attempt to remove their own account, **Then** the action is blocked with a clear message.
5. **Given** only one **active** administrator remains, **When** removal of that last active administrator is attempted, **Then** the action is blocked so the platform is never left with zero administrators able to sign in (a still-pending admin does not satisfy the minimum).

---

### Edge Cases

- What happens when an invitation email fails to send after the account is created? (The account exists but is unusable until a password is set; the creator should be informed the invite could not be delivered and be able to re-send it.)
- What happens when an administrator re-adds an email that previously belonged to a removed admin? (Treated as a fresh creation, subject to the same uniqueness rule against currently-existing admins.)
- What happens when two administrators try to remove the same admin at nearly the same time? (The first succeeds; the second sees the admin already gone, with no error state left behind.)
- How does the system represent an admin who was created but has not yet set a password? (Their status reflects a pending/invited state distinct from an active admin who has signed in.)
- What happens when the new admin requests another invitation because the first link expired? (A new single-use, time-limited link is issued and the old one stays invalid.)
- How does the list behave with many administrators on a small (320px) screen? (The table adopts a documented mobile strategy with no horizontal scroll or clipped controls.)
- What happens when email casing/whitespace differs (e.g., `Admin@x.com ` vs `admin@x.com`)? (Email is trimmed and matched case-insensitively for uniqueness and sign-in.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The admin navigation MUST present an **"Admin Management"** entry that routes to the Admin Management page. (The reference image labels this entry "Users & Roles"; that label does not exist in the current codebase, so this is delivered as a **new** navigation entry, not a literal rename.)
- **FR-002**: The Admin Management page MUST list all existing administrator accounts, each showing at least: name, email, role, status, and account creation date.
- **FR-003**: The list MUST visibly mark the row corresponding to the currently signed-in administrator.
- **FR-004**: The list MUST contain only administrator accounts and MUST NOT display students or any non-administrator identity.
- **FR-005**: For this feature, every administrator MUST be assigned the single role "Admin"; the role selector in the create flow MUST offer only "Admin".
- **FR-006**: The page MUST provide an "Add Admin" action that opens a "Create New Admin" modal collecting first name, last name, email address, and role.
- **FR-007**: The create flow MUST require first name, last name, and a syntactically valid email; submission MUST be blocked with clear validation when any required field is missing or invalid, and no account is created.
- **FR-008**: The create flow MUST reject an email that already belongs to an existing administrator, without creating a duplicate, and inform the creator the email is already in use.
- **FR-009**: On successful creation, the system MUST create the administrator account in a "pending password" state (unable to sign in until a password is set) and MUST send an email to the new admin containing a single-use, time-limited magic link to set their password.
- **FR-010**: Following a valid magic link, the new administrator MUST be able to set a password meeting the platform password policy, after which they MUST be able to sign in to the admin panel with their email and that password.
- **FR-011**: A magic link MUST be single-use and MUST expire after a limited time; an expired or already-used link MUST NOT set a password and MUST present a clear message with a way to obtain a new invitation.
- **FR-012**: The creator MUST be able to dismiss the create modal (Cancel or close control) without creating an account.
- **FR-013**: The page MUST provide a per-row remove action that requires explicit confirmation before removing an administrator.
- **FR-014**: After a confirmed removal, the administrator MUST no longer appear in the list and MUST be denied sign-in to the admin panel.
- **FR-015**: An administrator MUST NOT be able to remove their own account.
- **FR-016**: The system MUST prevent a removal that would leave the platform with zero administrators able to sign in — i.e., it MUST block removing the last remaining **active** administrator. A still-pending, never-activated administrator does **not** count toward this minimum (so the guard counts active administrators, not the raw row total).
- **FR-017**: All Admin Management actions (view, add, remove) MUST be available only to authenticated administrators and MUST be enforced server-side; a request without a valid admin session MUST be denied.
- **FR-018**: Email matching for uniqueness and sign-in MUST be case-insensitive and trimmed of surrounding whitespace.
- **FR-019**: The Admin Management page, modal, table, and controls MUST be responsive (320px through desktop), keyboard accessible, and meet the project's accessibility and brand standards, including defined loading, empty, and error states.
- **FR-020**: The system MUST allow re-sending the invitation (issuing a fresh single-use link, which invalidates any prior one) for an administrator still in the pending-password state — including when the original invite failed to deliver or expired. The re-send control MUST appear only for pending administrators.
- **FR-021**: When a new administrator is created but the invitation email cannot be dispatched, the system MUST inform the creator that the invite was not sent (the account remains in the pending-password state) and MUST surface the re-send affordance (FR-020) so delivery can be retried; the account is not silently left unreachable.

### Key Entities *(include if feature involves data)*

- **Administrator account**: An identity authorized for the admin panel. Attributes: first name, last name, email (unique among current admins), role (currently always "Admin"), status (pending-password vs active), and creation timestamp. Stored separately from students (per the existing admin/student separation).
- **Administrator invitation (magic link)**: A single-use, time-limited credential tied to a specific new administrator's email that grants a one-time ability to set the account's initial password. Has an expiry and a used/unused state.
- **Administrator role**: The permission set attached to an admin account. For this feature there is exactly one role, "Admin", conferring full administrative access.
- **Administrator status**: The lifecycle state of an admin — at minimum "pending password" (created, invitation outstanding, cannot sign in) and "active" (has set a password and can sign in).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can open the Admin Management page and see the complete, accurate list of administrators (name, email, role, status, created date) within 3 seconds on a typical mobile connection.
- **SC-002**: An administrator can create a new admin — from clicking "Add Admin" to the new admin appearing in the list — in under 60 seconds, and an invitation email is dispatched in 100% of successful creations.
- **SC-003**: 100% of attempts to create an admin with a duplicate email, missing name, or invalid email are rejected with a clear message and create no account.
- **SC-004**: A newly invited administrator can set a password via the magic link and then sign in to the admin panel on the first valid attempt; expired or reused links succeed 0% of the time at setting a password.
- **SC-005**: 100% of attempts to remove one's own account, or any removal that would leave zero **active** administrators, are blocked.
- **SC-006**: After a confirmed removal, the removed administrator is denied admin sign-in in 100% of attempts and never appears in the list again.
- **SC-007**: 0 non-administrator (e.g., student) identities ever appear in the Admin Management list, verified by automated tests.
- **SC-008**: The Admin Management page and create modal are usable with no horizontal scroll, clipping, or inaccessible controls at 320, 390, 430, 768px, and desktop widths.

## Assumptions

- **Password is set by the new admin, not the creator** *(confirmed 2026-06-03)*: The reference modal image shows a password field, but the new admin sets their own password via an emailed magic link. The magic-link self-set flow is authoritative; the create modal collects first name, last name, email, and role, and does **not** collect a creator-entered password. The password field shown in image 2 is intentionally omitted.
- **Single role for now**: All administrators share one role, "Admin", with full administrative access. The reference image shows varied roles ("Company Admin", "Manager") and an edit action; multiple roles and per-admin role editing are **out of scope** for this feature and may be introduced later. Editing existing admins (beyond removal) is likewise out of scope here.
- **Builds on existing admin auth and reset infrastructure**: This feature reuses the established admin/student separation and the managed authentication backend from the admin-auth feature, and the magic-link/password-setup mechanism is consistent with the existing admin password-reset (forgot-password) flow. The invitation link is the same class of single-use, time-limited credential.
- **Removal semantics**: "Remove" revokes the administrator's access (they can no longer sign in and disappear from the list). Whether the underlying record is hard-deleted or soft-deleted/retained for audit is an implementation choice deferred to planning; the observable behavior (gone from list, cannot sign in) is what this spec guarantees.
- **Status display**: A newly created admin who has not set a password is shown in a "pending"/"invited" state; once they set a password and can sign in, the status reflects "active". The exact labels follow the project's copy conventions.
- **Authorization scope**: Any authenticated administrator may add or remove other administrators (subject to the self-removal and last-admin guards). Finer-grained permissions among admins are out of scope while there is a single role.
- **Email delivery**: A transactional email capability is available to send invitations; deliverability beyond dispatch (spam filtering, bounce handling) is outside this feature's guaranteed scope, though the creator is informed when an invite cannot be dispatched.
- **Pagination**: If the number of administrators is small (tens), the full list is shown; if it grows large, reads remain bounded/paginated per the performance principle. A specific threshold is deferred to planning.
