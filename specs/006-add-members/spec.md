# Feature Specification: Add Members

**Feature Branch**: `006-add-members`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "we want to build a feature in admin panel allowing admin to add members. The admin clicks the Members tab; the page lists all members in a table with an 'Add Members' button top-right. Add Members offers two options: add by form, or bulk upload a predefined template. The single form collects full name, WhatsApp mobile, and email, then a dropdown to select the wave (for now two dummy waves, one Offline and one Online; later a create-wave tab will feed this). Bulk upload accepts a predefined CSV with the same fields (name, WhatsApp number, email); the data must have no empty fields or it is rejected; the template must be downloadable from the members page. After uploading the CSV, show which wave the members will be assigned to; on submit, generate a QR-code link for each member (built from their name/number/email, following the Google-Sheet formula style), then send each member an onboarding email with an invitation link; clicking it asks them to set a password so they can log in to the student panel. On the student home, show the member's QR code image; scanning it opens a page containing the member's information."

## Clarifications

### Session 2026-06-04

- Q: When a member's QR code is scanned, what should open? → A: An **internal Meska-hosted member-information page**. The Google-Sheet/Google-Form formula in the request is treated only as the reference for *how* a QR is generated (URL-encoding member data into a QR image), not as the scan destination.
- Q: Who may view the member-information page reached by scanning a QR? → A: **Admins only** — the viewer must be a signed-in administrator; the page is not publicly accessible.
- Q: How does student login work after this feature? → A: **Email + password.** The member's email is their login identifier ("Student ID"), and the password is the one they set via the onboarding link. The onboarding email MUST tell the member that their login ID is their email.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the list of members (Priority: P1)

A signed-in administrator opens the admin panel and selects the **Members** entry in the navigation. They land on the Members page, which lists every member in a table showing each member's full name, WhatsApp mobile, email, assigned wave, and status. A prominent **Add Members** action sits at the top-right of the page, and a **Download CSV template** affordance is available on the page so the admin can obtain the bulk-upload template.

**Why this priority**: The list is the foundation every other action (add single, bulk upload, view a member) launches from and is confirmed against. Without it there is nothing to manage. It is the minimum viable slice.

**Independent Test**: Sign in as an administrator, open the Members page, and confirm every existing member appears as a row with full name, WhatsApp mobile, email, wave, and status, that the "Add Members" action is visible top-right, and that a CSV template can be downloaded.

**Acceptance Scenarios**:

1. **Given** an authenticated administrator and a set of existing members, **When** they open the Members page, **Then** every member is listed with full name, WhatsApp mobile, email, assigned wave, and status.
2. **Given** the Members page is open, **When** the administrator looks at the top-right of the page, **Then** an "Add Members" action is present.
3. **Given** the Members page, **When** the administrator looks for the bulk template, **Then** a "Download CSV template" affordance is available and downloads a CSV with exactly the columns full name, WhatsApp number, and email.
4. **Given** no members exist yet, **When** the administrator opens the Members page, **Then** a clear empty state is shown (no broken or blank table) alongside the "Add Members" action.
5. **Given** a request without a valid admin session, **When** the Members page or its data is requested, **Then** access is denied.

---

### User Story 2 - Add a single member via the form (Priority: P1)

An administrator clicks **Add Members** and chooses **Add by form**. A form opens collecting the member's full name, WhatsApp mobile, email, and a wave selected from a dropdown that currently offers two waves — **Offline** and **Online**. On submit, the system validates the inputs, creates the member assigned to the chosen wave, generates a QR code for that member, and sends an onboarding email inviting the member to set a password. After a successful creation the new member appears in the list.

**Why this priority**: Provisioning a single member is the primary purpose of the feature and the core of the MVP — viewing plus adding delivers self-service member management without back-office seeding. The single-add path exercises the full creation pipeline (validate → create → assign wave → generate QR → send onboarding email) on one record.

**Independent Test**: Open the form, enter a full name, a WhatsApp mobile, a valid unused email, pick a wave, submit, and confirm (a) the member appears in the list under the chosen wave, (b) a QR code is generated for the member, and (c) an onboarding email with a set-password link is dispatched to that email.

**Acceptance Scenarios**:

1. **Given** the Members page, **When** the administrator clicks "Add Members" and chooses "Add by form", **Then** a form opens with fields for full name, WhatsApp mobile, email, and a wave dropdown offering "Offline" and "Online".
2. **Given** the form with all fields filled with valid values, **When** the administrator submits, **Then** a member is created and assigned to the selected wave, the form closes, and the member appears in the list.
3. **Given** a successful creation, **When** the member record is created, **Then** a QR code is generated for that member and an onboarding email containing a single-use, time-limited set-password link is sent to the member's email.
4. **Given** the form, **When** the administrator submits with any required field empty, whitespace-only, or with a malformed email, **Then** submission is blocked with a clear validation message and no member is created.
5. **Given** the form, **When** the administrator submits an email that already belongs to an existing member, **Then** creation is rejected with a message that the email is already in use and no duplicate is created.
6. **Given** the form is open, **When** the administrator selects Cancel or the close control, **Then** the form closes and no member is created.
7. **Given** a created member whose onboarding email could not be dispatched, **When** creation completes, **Then** the administrator is told the invite was not sent (the member remains pending) and a re-send affordance is available.

---

### User Story 3 - Member sets a password and logs in to the student panel (Priority: P1)

A newly created member receives the onboarding email. The email states that their login identifier is their email address and provides an invitation link. Following the link takes the member to a page where they choose a password. After setting a valid password, the member can sign in to the student panel using their email and that password. The link is single-use and expires after a limited time; an expired or already-used link cannot set a password.

**Why this priority**: Without the member being able to set a password and sign in, the add flow produces an unusable account. This story completes the provisioning loop and is required for the feature to deliver real value to the member.

**Independent Test**: Create a member, open the emailed invitation link, set a password meeting the policy, then sign in to the student panel with the member's email and that password and reach the student home.

**Acceptance Scenarios**:

1. **Given** a newly created member, **When** the onboarding email is sent, **Then** it contains an invitation link and clearly states that the member's login ID is their email address.
2. **Given** a member who follows a valid invitation link, **When** they open it, **Then** they are presented with a page to set their password.
3. **Given** the set-password page reached via a valid link, **When** the member submits a password meeting the password policy, **Then** the password is set and they can subsequently sign in to the student panel with their email and that password.
4. **Given** an invitation link that has expired or already been used, **When** the recipient opens it, **Then** they cannot set a password and are shown a clear message with a path to request a new invitation.
5. **Given** a member who has not yet set a password, **When** they attempt to sign in to the student panel, **Then** sign-in is denied until the password is set.

---

### User Story 4 - Bulk upload members via CSV (Priority: P2)

An administrator clicks **Add Members** and chooses **Bulk upload**. They first download the predefined CSV template (also available directly on the Members page), fill it with rows of full name, WhatsApp number, and email, and upload it. The system validates that no required cell is empty or whitespace-only and that emails are well-formed; if any row fails, the upload is rejected with clear feedback identifying the problem and no members are created. On a valid file, the administrator is shown which wave the members will be assigned to (chosen from the same Offline/Online dropdown) before confirming. On submit, the system creates all members in the chosen wave, generates a QR code for each, and sends each an onboarding email.

**Why this priority**: Bulk import is essential for real cohorts but builds on the single-add creation pipeline (US2) and the list (US1). It is the highest-value follow-on once single creation works, but the feature is already viable without it.

**Independent Test**: Download the template, fill several valid rows, upload, confirm the wave shown for assignment, submit, and verify all members appear in the list under that wave, each with a generated QR code and a dispatched onboarding email; separately upload a file with a blank cell and confirm the whole upload is rejected with a clear message and no members created.

**Acceptance Scenarios**:

1. **Given** the Members page or the Add Members chooser, **When** the administrator requests the template, **Then** a predefined CSV with exactly the columns full name, WhatsApp number, and email is downloaded.
2. **Given** a filled template, **When** the administrator uploads it and every required cell is non-empty (not blank or whitespace-only) and every email is well-formed, **Then** the file is accepted for the next step.
3. **Given** an uploaded file where any required cell is empty or whitespace-only, **When** validation runs, **Then** the upload is rejected with a clear message identifying the failing row(s)/field(s) and no members are created.
4. **Given** an accepted file, **When** the administrator proceeds, **Then** they are shown the wave (Offline or Online) that the uploaded members will be assigned to and can change the selection before confirming.
5. **Given** the wave confirmed, **When** the administrator submits, **Then** every uploaded member is created in that wave, a QR code is generated for each, and an onboarding email is sent to each.
6. **Given** an uploaded file containing an email that already belongs to an existing member or a duplicate email within the same file, **When** validation runs, **Then** the conflict is reported and the duplicate is not created (the administrator is told which rows were affected).

---

### User Story 5 - Member views their QR code on the student home (Priority: P2)

After logging in to the student panel, the member sees their personal QR code image on the student home. The QR encodes a link to that member's information page.

**Why this priority**: The QR is the member's identity artifact for in-person scanning. It depends on member creation (US2/US4) and the member being able to log in (US3), so it follows them.

**Independent Test**: Log in as a member who was created with a QR code, open the student home, and confirm the member's QR code image is displayed.

**Acceptance Scenarios**:

1. **Given** a member who has set a password and signed in, **When** they open the student home, **Then** their QR code image is displayed.
2. **Given** the student home QR image, **When** it is rendered, **Then** it encodes a link that resolves to that member's information page (not any other member's).
3. **Given** a member's QR code is not yet available, **When** they open the student home, **Then** a clear placeholder/empty state is shown instead of a broken image.

---

### User Story 6 - Admin opens a member's information page by scanning the QR (Priority: P3)

A member's QR code, when scanned, resolves to a Meska-hosted member-information page. The page shows that member's information and is accessible only to a signed-in administrator; an unauthenticated viewer is sent to sign in and cannot see member PII.

**Why this priority**: The information page is the scan destination and the payoff of the QR, but it depends on QR generation (US2/US4) and the admin session model. It rounds out the feature once members and QR codes exist.

**Independent Test**: Scan (or open) a member's QR link while signed in as an administrator and confirm the member's information page renders the correct member's details; repeat while not signed in and confirm access is denied/redirected to sign-in.

**Acceptance Scenarios**:

1. **Given** a member's QR link, **When** a signed-in administrator opens it, **Then** the member-information page renders that specific member's details (full name, WhatsApp mobile, email, assigned wave, status).
2. **Given** a member's QR link, **When** a viewer who is not a signed-in administrator opens it, **Then** the member information is not shown and the viewer is directed to authenticate.
3. **Given** a QR link for a member that no longer exists, **When** it is opened by an administrator, **Then** a clear "not found" state is shown rather than another member's data.

---

### Edge Cases

- What happens when the onboarding email fails to send after the member is created? (The member exists but is unusable until a password is set; the administrator is informed delivery failed and can re-send the invitation.)
- What happens when a bulk file has a blank cell in only one row? (The entire upload is rejected; no members from that file are created until it is corrected.)
- What happens when a bulk file contains the same email twice, or an email already used by an existing member? (The conflicting rows are reported and not created; non-conflicting rows are handled per the upload's all-or-nothing rule — see Assumptions.)
- What happens when email casing/whitespace differs (e.g., `A@x.com ` vs `a@x.com`)? (Email is trimmed and matched case-insensitively for uniqueness and login.)
- How does the member-information page behave when opened by a student (their own or another member's QR)? (It is admin-only; a student is denied/redirected and cannot view member PII.)
- What happens when an uploaded file is not the predefined template (wrong/missing columns, wrong format)? (The upload is rejected with a clear message; no members are created.)
- How does the members table behave with many members on a small (320px) screen? (It adopts a documented mobile strategy with no page-level horizontal scroll or clipped controls.)
- What happens when a WhatsApp number is provided in an unexpected format? (The number is accepted if non-empty per the stated validation; format normalization beyond "non-empty" is out of scope unless specified — see Assumptions.)
- What happens when an invitation link expires before the member sets a password? (A new single-use, time-limited link can be issued; the old one stays invalid.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The admin navigation MUST present a **"Members"** entry that routes to the Members page.
- **FR-002**: The Members page MUST list all existing members, each showing at least full name, WhatsApp mobile, email, assigned wave, and status.
- **FR-003**: The Members page MUST present an **"Add Members"** action positioned at the top-right of the page.
- **FR-004**: The Members page MUST provide a **"Download CSV template"** affordance that downloads a predefined CSV containing exactly the columns full name, WhatsApp number, and email.
- **FR-005**: The "Add Members" action MUST offer two paths: **add by form** (single member) and **bulk upload** (CSV).
- **FR-006**: The single-add form MUST collect full name, WhatsApp mobile, email, and a wave chosen from a dropdown.
- **FR-007**: The wave dropdown MUST currently offer two waves — **"Offline"** and **"Online"** — and MUST be structured so additional waves can be sourced from a future wave-creation capability without redesign.
- **FR-008**: The single-add flow MUST require all four fields and MUST block submission with a clear validation message — creating no member — when any required field is empty, whitespace-only, or the email is malformed.
- **FR-009**: The single-add flow MUST reject an email that already belongs to an existing member, without creating a duplicate, and inform the administrator the email is already in use.
- **FR-010**: On a successful single add, the system MUST create the member assigned to the selected wave in a "pending password" state (cannot log in until a password is set).
- **FR-011**: The bulk-upload flow MUST accept an uploaded CSV in the predefined template shape (columns: full name, WhatsApp number, email).
- **FR-012**: The bulk-upload flow MUST validate that no required cell is empty or whitespace-only and that every email is well-formed; if any required cell fails this check, the upload MUST be rejected with a clear message identifying the failing row(s)/field(s) and MUST create no members.
- **FR-013**: After a CSV passes validation, the system MUST show the administrator which wave the uploaded members will be assigned to (selectable from the same Offline/Online dropdown) and MUST require confirmation before creating members.
- **FR-014**: On bulk submit, the system MUST create every uploaded member assigned to the confirmed wave, each in a "pending password" state.
- **FR-015**: The bulk-upload flow MUST detect emails that duplicate an existing member or duplicate another row in the same file, report the affected rows, and not create duplicates.
- **FR-016**: On creation of any member (single or bulk), the system MUST generate a QR code for that member. The QR MUST encode a link that resolves to that member's information page. (The Google-Sheet formula supplied in the request is the reference for *how* a QR image is produced from member data, not the scan destination.)
- **FR-017**: On creation of any member (single or bulk), the system MUST send that member an onboarding email containing a single-use, time-limited link to set a password; the email MUST state that the member's login identifier is their email address.
- **FR-018**: Following a valid onboarding link, the member MUST be able to set a password meeting the platform password policy, after which they MUST be able to sign in to the student panel using their email and that password.
- **FR-019**: An onboarding link MUST be single-use and MUST expire after a limited time; an expired or already-used link MUST NOT set a password and MUST present a clear message with a way to obtain a new invitation.
- **FR-020**: A member who has not set a password MUST be denied student-panel sign-in until the password is set.
- **FR-021**: The student panel sign-in MUST accept a member's **email** as the login identifier together with the password the member set; the previous "Student ID" identifier is satisfied by the email.
- **FR-022**: After signing in, a member MUST see their own QR code image on the student home; the image MUST encode the link to that member's own information page.
- **FR-023**: The member-information page reached via a QR link MUST display that specific member's information (full name, WhatsApp mobile, email, assigned wave, status).
- **FR-024**: The member-information page MUST be accessible only to a signed-in administrator; a viewer without a valid admin session MUST be denied and directed to authenticate, and MUST NOT see member PII.
- **FR-025**: Email matching for uniqueness and login MUST be case-insensitive and trimmed of surrounding whitespace.
- **FR-026**: The system MUST allow re-sending the onboarding invitation (issuing a fresh single-use link that invalidates any prior one) for a member still in the pending-password state, including when the original invite failed to deliver or expired.
- **FR-027**: When a member is created but the onboarding email cannot be dispatched, the system MUST inform the administrator the invite was not sent (the member stays pending) and MUST surface the re-send affordance so delivery can be retried.
- **FR-028**: All member-management actions (view list, add by form, bulk upload, download template, view member-information page) MUST be available only to authenticated administrators and MUST be enforced server-side; a request without a valid admin session MUST be denied.
- **FR-029**: Every member MUST belong to exactly one wave, and members MUST be associated with their wave so that wave-scoped access (per the wave-isolation principle) can be enforced — a member's student-panel view MUST be limited to data for the wave they are enrolled in.
- **FR-030**: The Members page, the add form, the bulk-upload flow, the student-home QR display, and the member-information page MUST be responsive (320px through desktop), keyboard accessible, and meet the project's accessibility and brand standards, including defined loading, empty, and error states.

### Key Entities *(include if feature involves data)*

- **Member**: A person enrolled as a student in a wave and able to log in to the student panel. Attributes: full name, WhatsApp mobile, email (unique among current members; also the login identifier), assigned wave, status (pending-password vs active), an associated QR code, and a creation timestamp. Members are distinct from administrators.
- **Wave**: A cohort a member is enrolled in. For this feature there are two seeded waves — **"Offline"** and **"Online"** — modeled so additional waves can be added later by a wave-creation capability. Attributes: name and type/mode (offline vs online).
- **Member onboarding invitation**: A single-use, time-limited link tied to a specific member's email granting a one-time ability to set the member's initial password. Has an expiry and a used/unused state.
- **Member QR code**: An image/link artifact generated per member at creation, encoding a URL that resolves to that member's information page; displayed on the member's student home.
- **Member-information page**: An admin-only view, reached by scanning/opening a member's QR link, that shows that member's information.
- **Bulk-upload template / batch**: The predefined CSV (columns: full name, WhatsApp number, email) used to import multiple members at once and assign them to a single chosen wave.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can open the Members page and see the complete, accurate list of members (full name, WhatsApp mobile, email, wave, status) within 3 seconds on a typical mobile connection.
- **SC-002**: An administrator can add a single member — from opening the form to the member appearing in the list — in under 60 seconds, and both a QR code and an onboarding email are produced for 100% of successful single creations.
- **SC-003**: 100% of single-add attempts with an empty/whitespace-only field, a malformed email, or a duplicate email are rejected with a clear message and create no member.
- **SC-004**: 100% of bulk uploads containing any empty or whitespace-only required cell are rejected with a clear message identifying the problem, and create no members.
- **SC-005**: For a valid bulk upload, 100% of uploaded members are created under the confirmed wave, each with a generated QR code and a dispatched onboarding email.
- **SC-006**: A newly created member can set a password via the onboarding link and then sign in to the student panel with their email on the first valid attempt; expired or reused links succeed 0% of the time at setting a password.
- **SC-007**: 100% of attempts to open a member-information page without a signed-in admin session are denied (no member PII shown).
- **SC-008**: A signed-in member sees their own QR code on the student home in 100% of sessions where a QR code exists, and the QR resolves to that member's own information page (never another member's).
- **SC-009**: The Members page, add form, bulk-upload flow, student-home QR display, and member-information page are usable with no page-level horizontal scroll, clipping, or inaccessible controls at 320, 390, 430, 768px, and desktop widths.
- **SC-010**: A downloadable CSV template is always available from the Members page and matches exactly the columns the upload validator expects (full name, WhatsApp number, email).

## Assumptions

- **QR scan destination is an internal page, not the Google Form** *(clarified 2026-06-04)*: The Google-Sheet/Google-Form formula in the request demonstrates *how* a QR image is generated from member data (URL-encoding fields into a QR-image service). The actual scan target is a Meska-hosted member-information page. The external Google Form is not the destination and is out of scope.
- **Member-information page is admin-only** *(clarified 2026-06-04)*: Viewing a member's information by scanning the QR requires a signed-in administrator. There is no public member-info view in this feature.
- **Login is email + password** *(clarified 2026-06-04)*: The member's email is the login identifier and the password is the one set via the onboarding link. The onboarding email explicitly tells the member their login ID is their email. The existing student sign-in "Student ID" is satisfied by the member's email; reconciling the current name/Session-Room join UI with email+password login is handled as part of this feature's plan.
- **Member = student**: "Members" added here are students of the platform who log in to the student panel; they are stored separately from administrators (consistent with the existing admin/student separation).
- **Two seeded ("dummy") waves**: "Offline" and "Online" are seeded for now. A future create-wave capability will add more; the wave selector is modeled to read available waves rather than hard-coding only these two in the UI logic, even though only two exist today.
- **"No empty space" means no blank/whitespace-only required cells**: Validation rejects rows where a required field is missing, empty, or whitespace-only (values are trimmed). It does not forbid internal spaces inside a legitimately multi-word name. Email must additionally be syntactically valid.
- **WhatsApp number validation is "non-empty"**: Beyond being present and trimmed, the WhatsApp number is not format-normalized or verified for deliverability in this feature; stricter phone validation is out of scope unless added later.
- **Bulk upload is all-or-nothing on hard failures**: A file with any empty/whitespace-only required cell or malformed email is rejected wholesale (no partial import). Duplicate-email handling (existing member or in-file duplicate) reports the affected rows and does not create those duplicates; the precise partial-vs-whole behavior for duplicate-only conflicts is finalized in planning, but no member is ever created from an invalid row.
- **Reuses existing auth & email infrastructure**: The set-password onboarding link is the same class of single-use, time-limited credential used by the existing admin invitation/reset flow, and a transactional email capability is available to send onboarding emails. Deliverability beyond dispatch (spam filtering, bounce handling) is outside this feature's guaranteed scope, though the admin is informed when an invite cannot be dispatched.
- **Removal/editing of members is out of scope**: This feature covers listing, adding (single + bulk), QR generation, onboarding, and the admin member-information page. Editing or removing existing members is not included and may be introduced later.
- **Pagination**: If members number in the tens, the full list is shown; if it grows large, reads remain bounded/paginated per the performance principle. A specific threshold is deferred to planning.
- **First backend feature obligations**: Per the constitution's wave-isolation principle, this feature's plan MUST specify PII handling, retention, encryption in transit/at rest, authentication/session management, and audit logging as applicable to member data.
