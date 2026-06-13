# Feature Specification: Student Password Reset, Attendance Tracking & Gamification Points

**Feature Branch**: `012-attendance-points-student-reset`

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "feature 1: allow forgot password logic in the student login the same as admin, but the change happens to the student account. feature 2: admin Attendance tab tracking attendance of students per wave per week; move the Scan QR button from Members to Attendance; scan a student, pick an offline wave (most recent first) and a week, press Attend, see a success popup with Next/Back, one attendance per user per day, repeat-scan shows already-attended; online waves take attendance via CSV (email-only, fixed template); all data shown in an attendance table. feature 3: a Points tab — gamification points to keep members active; admin sees an editable points table; student points start at zero; +10 per attendance, +20 per assignment upload, +30 per feedback; on feedback submit show a thank-you popup with the awarded points."

This feature bundles **three independent capabilities**. Each is its own prioritized user-story group below and can be built, tested, and shipped on its own.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student can reset a forgotten password (Priority: P1)

A member (student) who has forgotten their password can recover access to their account on their own, without an admin having to re-provision them. They request a reset from the student sign-in page, receive a reset email, follow the link, and set a new password — mirroring the existing admin recovery experience, but operating on the student account.

**Why this priority**: Account lockout with no self-service recovery is an immediate, high-friction support burden and the most fundamental gap of the three. It is fully independent of attendance and points.

**Independent Test**: From the student sign-in page, request a reset for a known member email, complete the emailed link flow, set a new password, and sign in with it. Requesting a reset for an unknown / non-member email reveals nothing about whether the account exists.

**Acceptance Scenarios**:

1. **Given** a member with an existing account, **When** they open the student sign-in page, **Then** they see a "Forgot password?" entry point.
2. **Given** a member on the reset-request screen, **When** they submit their account email, **Then** they see a generic confirmation that a reset link was sent (regardless of whether the email matched an account), and a member account receives the reset email.
3. **Given** a member who received the reset email, **When** they follow the link and confirm, **Then** they reach a screen to set a new password.
4. **Given** a member on the set-new-password screen, **When** they submit a valid new password, **Then** their account password is updated, existing sessions are invalidated, and they can sign in with the new password.
5. **Given** an email that belongs to no member (or belongs only to an admin), **When** a reset is requested for it, **Then** no member reset email is sent and the requester still sees the same generic confirmation (no account enumeration).
6. **Given** an expired or already-used reset link, **When** the member follows it, **Then** they see a clear error and a path to request a fresh link.

---

### User Story 2 - Admin records offline attendance by scanning a student (Priority: P1)

An admin runs an in-person (offline) session. They open the Attendance tab, scan a student's QR code, and land on that student's info screen. There they choose the offline wave and the specific week the session belongs to, then press **Attend**. A success popup confirms the student is marked present and offers **Next** (scan another attendee) or **Back** (return to the admin home). Each student can be counted present at most once per day; re-scanning a student already marked today shows an "already attended" notice instead of double-counting.

**Why this priority**: This is the core of the attendance feature and the day-of-session workflow the admin performs live. It must be reliable and fast.

**Independent Test**: In the Attendance tab, scan a member, select an offline wave and a week, press Attend, and confirm the success popup; verify the record appears in the attendance table. Scan the same member again the same day and confirm the "already attended" message and no duplicate record.

**Acceptance Scenarios**:

1. **Given** the admin is in the Members tab, **When** they look for the Scan QR action, **Then** it is no longer there; it now lives in the Attendance tab, and the previous scan-to-member-info navigation still works unchanged.
2. **Given** the admin opens the Attendance tab and starts a scan, **When** a valid member QR is read, **Then** the admin is taken to that student's info screen.
3. **Given** the student info screen during an attendance flow, **When** it loads, **Then** it shows a wave dropdown listing only **offline** waves ordered most-recently-created first, and a week dropdown whose options are the weeks of the currently selected wave.
4. **Given** an offline wave and a week are selected, **When** the admin presses **Attend** and the student has no attendance recorded today, **Then** a success popup confirms the student attended and presents **Next** and **Back** options.
5. **Given** the success popup, **When** the admin presses **Next**, **Then** the scanner reopens to capture the next attendee.
6. **Given** the success popup, **When** the admin presses **Back**, **Then** they return to the admin home page.
7. **Given** a student already marked present today, **When** the admin presses **Attend** for them again (same or different week), **Then** the system shows an "already attended" message and does not create a second record for that day.
8. **Given** any recorded attendance, **When** the admin views the Attendance tab table, **Then** the record (student, wave, week, date, and that it was an in-person scan) is listed.

---

### User Story 3 - Admin records online attendance via CSV upload (Priority: P2)

For online waves there is no in-person scan. The admin selects an online wave and week, downloads a fixed CSV template (a single `email` column), fills it with the emails of attendees, and uploads it. Every matching member is marked present for that wave/week, subject to the same once-per-day rule.

**Why this priority**: Online waves still need attendance, but the scan flow (US2) is the primary, higher-frequency path and gates the shared attendance data model.

**Independent Test**: On the Attendance tab, download the template, upload a CSV of member emails for an online wave/week, and verify each listed member appears in the attendance table; rows for emails already marked today or not matching any member are reported and skipped.

**Acceptance Scenarios**:

1. **Given** the Attendance tab, **When** the admin chooses the CSV path, **Then** a fixed downloadable template with only an `email` column is available on the page.
2. **Given** an online wave and week are selected, **When** the admin uploads a valid CSV of emails, **Then** each email matching a member is marked present for that wave/week and appears in the attendance table marked as a CSV import.
3. **Given** a CSV containing an email already marked present today, **When** it is processed, **Then** that row is skipped (no duplicate) and reported back to the admin.
4. **Given** a CSV containing an email that matches no member, **When** it is processed, **Then** that row is skipped and reported as unmatched, without aborting the rest of the upload.
5. **Given** the online attendance path, **When** the admin views the wave dropdown for CSV, **Then** only **online** waves are offered (scan is offline-only; CSV is online-only).

---

### User Story 4 - Admin manages the points-award table (Priority: P2)

An admin opens the Points tab and sees a small, editable table that maps each rewarded action to the number of points it grants. The defaults are: attendance = 10, assignment upload = 20, feedback = 30. The admin can change any of these values, and the change governs how student totals are computed.

**Why this priority**: The points configuration is the control surface that makes the student-facing gamification (US5) meaningful and tunable, but it depends on the award rules existing.

**Independent Test**: Open the Points tab, change the per-action values, save, and confirm the new values persist and are reflected in student point totals.

**Acceptance Scenarios**:

1. **Given** the admin opens the Points tab for the first time, **When** the page loads, **Then** the table shows the three actions with default values 10 (attendance), 20 (assignment), 30 (feedback).
2. **Given** the admin edits a value to a valid non-negative whole number, **When** they save, **Then** the new value persists and applies to student totals.
3. **Given** an invalid value (negative, blank, non-numeric), **When** the admin tries to save it, **Then** the change is rejected with a clear message and the prior value is kept.

---

### User Story 5 - Student earns and sees gamification points (Priority: P3)

To encourage participation, every student starts at zero points and accrues them automatically: each attendance grants the attendance value, each assignment upload grants the assignment value, and each feedback submission grants the feedback value (per the admin-managed table). When a student submits feedback, a thank-you popup thanks them and shows how many points the feedback just earned.

**Why this priority**: This is the motivational payoff layer; it depends on attendance (US2/US3), the existing assignment-upload flow, feedback submission, and the points table (US4).

**Independent Test**: As a new student, confirm the points total starts at zero; perform one attendance, one assignment upload, and one feedback submission; confirm the total reflects the configured values and that submitting feedback shows a thank-you popup naming the awarded points.

**Acceptance Scenarios**:

1. **Given** a newly added member, **When** they view their points, **Then** the total is zero.
2. **Given** a student marked present, **When** their points update, **Then** their total increases by the configured attendance value.
3. **Given** a student who uploads an assignment, **When** their points update, **Then** their total increases by the configured assignment value (re-uploading the same assignment does not grant it again).
4. **Given** a student who submits feedback, **When** the submission succeeds, **Then** a thank-you popup appears thanking them and stating the points awarded (the configured feedback value), and their total increases by that amount.
5. **Given** the admin later changes a value in the points table, **When** a student next views their total, **Then** the total reflects the updated configuration consistently across students.

---

### Edge Cases

- **Reset for an admin email on the student page**: a reset requested on the *student* surface for an admin-only email must not grant student-side recovery; the generic confirmation is shown but no student reset occurs.
- **Reset link reuse / expiry**: following a consumed or expired link shows a clear error and a way to request a new one.
- **Scanning a non-member QR / arbitrary QR** in the Attendance tab: the decoded value is validated and a non-member or malformed code is rejected without navigating off-app.
- **Wave with no weeks**: if a selected wave has no weeks, the week dropdown is empty and **Attend** cannot be completed; the admin sees why.
- **Day boundary**: "once per day" is one record per student per calendar day across all waves/weeks (FR-028), evaluated against a single consistent calendar day (see Assumptions); a scan just after midnight is a new day.
- **Wrong wave selected for a student**: choosing an offline wave the scanned student is not enrolled in is rejected with a clear message (FR-027); no record is created.
- **Empty or malformed CSV** (missing `email` header, blank file, extra columns): the admin gets a clear validation error and no partial garbage is recorded.
- **CSV with duplicate emails in one file**: each member is marked at most once.
- **Feedback resubmission**: a student editing/resubmitting feedback for the same week does not earn the feedback points more than once for that feedback.
- **Points value set to zero**: an action configured at 0 grants nothing but is still recorded as an action.
- **Concurrent double-scan**: two near-simultaneous Attend presses for the same student/day result in exactly one attendance record.

## Requirements *(mandatory)*

### Functional Requirements

**Feature 1 — Student password reset**

- **FR-001**: The student sign-in page MUST present a "Forgot password?" entry point.
- **FR-002**: The system MUST let a member request a password reset by submitting their account email and MUST respond with a generic confirmation that does not reveal whether the email belongs to an account (no enumeration).
- **FR-003**: The system MUST send a password-reset email only to addresses belonging to a member account, reusing the existing reset email mechanism but targeting the student account population.
- **FR-004**: Following the emailed link MUST lead the member to a confirm step and then to a set-new-password screen, without consuming the recovery token on initial page view.
- **FR-005**: On submitting a valid new password, the system MUST update the member's account credential and invalidate existing sessions, after which the new password works for sign-in.
- **FR-006**: Expired or already-used reset links MUST produce a clear error with a path to request a new link.
- **FR-007**: The student reset flow MUST NOT alter the existing admin reset flow, and the two populations MUST remain separate.

**Feature 2 — Attendance tracking**

- **FR-008**: The admin navigation MUST include an **Attendance** tab.
- **FR-009**: The **Scan QR** action MUST be moved from the Members tab to the Attendance tab; the existing scan-to-member-info validation and navigation behavior MUST be preserved (no regression in how a scanned member QR resolves to the member info screen).
- **FR-010**: From the Attendance tab, scanning a valid member QR MUST take the admin to that student's info screen within the attendance flow.
- **FR-011**: The student info screen, when reached via attendance, MUST present a wave dropdown listing only **offline** waves, ordered most-recently-created first, and a week dropdown populated from the selected wave's weeks.
- **FR-012**: With an offline wave and week selected, pressing **Attend** MUST record the student as present for that wave/week on the current day, then show a success popup offering **Next** and **Back**.
- **FR-013**: **Next** MUST reopen the scanner for the next attendee; **Back** MUST return to the admin home page.
- **FR-014**: The system MUST allow at most one attendance record per student per day; an attempt to mark an already-attended student again that day MUST show an "already attended" message and create no duplicate.
- **FR-015**: For **online** waves, attendance MUST be recordable only by uploading a CSV; the Attendance page MUST provide a fixed, downloadable template containing a single `email` column.
- **FR-016**: A CSV upload MUST mark each matching member present for the selected online wave/week, skipping and reporting rows that are unmatched or already marked that day, without aborting the whole upload.
- **FR-017**: The Attendance tab MUST display a table of attendance records showing at least the student, wave, week, date, and capture method (scan vs CSV).
- **FR-018**: Attendance reads and writes MUST respect wave isolation and authorization: only admins record attendance and view the full attendance table; a student may read only their own attendance records (required to display their own points total); data stays scoped to its wave.

**Feature 3 — Gamification points**

- **FR-019**: The admin navigation MUST include a **Points** tab showing an editable table that maps each rewarded action (attendance, assignment upload, feedback) to its point value.
- **FR-020**: The default point values MUST be attendance = 10, assignment = 20, feedback = 30, and the admin MUST be able to edit each to any valid non-negative whole number.
- **FR-021**: Invalid point values (negative, blank, non-numeric) MUST be rejected with a clear message, preserving the prior value.
- **FR-022**: Every student's points total MUST start at zero and reflect only points earned after this capability is in effect.
- **FR-023**: The system MUST award the attendance value for each recorded attendance, the assignment value for each distinct assignment upload (not per re-upload of the same assignment), and the feedback value for each feedback submission (not per re-edit of the same feedback).
- **FR-024**: A student's displayed total MUST stay consistent with the current admin-configured point values (changing a value in the table updates totals consistently across students).
- **FR-025**: Submitting feedback MUST persist the feedback and show a thank-you popup that thanks the student and states the points awarded for that feedback.
- **FR-026**: The student surface MUST display the student's own current points total.

- **FR-027**: When recording offline attendance, the scanned student MUST belong to the selected offline wave; if the chosen wave is not the student's enrolled wave, the attendance MUST be rejected with a clear message and no record created. (The offline-wave dropdown therefore serves to confirm the student's wave and pick the session's week.)
- **FR-028**: The once-per-day limit MUST be one attendance per student per calendar day across all waves and weeks; once a student is marked present on a given day, any further attempt that day (scan or CSV, same or different wave/week) MUST be rejected as "already attended."
- **FR-029**: Student point totals MUST be computed from each student's rewarded-action counts multiplied by the current admin-configured point values; editing a point value MUST therefore apply retroactively and consistently to every student's total (the points table is the single source of truth).

### Key Entities *(include if feature involves data)*

- **Attendance record**: one student being present for a specific wave and week on a specific date, with the capture method (in-person scan or CSV import). At most one per student per calendar day across all waves/weeks (FR-028); the wave must be the student's own (FR-027).
- **Point-award configuration**: the mapping of rewarded action (attendance, assignment, feedback) to its current point value; admin-editable; small fixed set of rows.
- **Student feedback**: a student's submitted feedback (e.g., per week), newly persisted by this feature so it can both count toward points and trigger the thank-you popup.
- **Student points total**: a per-student quantity derived as the student's rewarded-action counts × the current point-award configuration; starts at zero and recomputes whenever the configuration changes (FR-029).
- **Wave (tenant)**: existing entity; already carries an online/offline type and an ordered set of weeks, both of which drive the attendance dropdowns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member who has forgotten their password can regain access entirely on their own — from requesting a reset to signing in with a new password — in under 5 minutes, with zero admin involvement.
- **SC-002**: Requesting a reset for any email returns an identical confirmation, so an observer cannot determine from the response whether an account exists (0% enumeration signal).
- **SC-003**: During an in-person session, an admin can mark a scanned student present in under 15 seconds per student and immediately continue to the next attendee.
- **SC-004**: Re-scanning an already-marked student the same day never creates a duplicate; duplicate-attendance records for a student/day stay at 0.
- **SC-005**: An admin can mark an entire online wave's attendees present from a single CSV upload, with every unmatched or duplicate row clearly reported and 100% of the rest applied.
- **SC-006**: All attendance captured by scan and by CSV is visible in the attendance table with student, wave, week, date, and method.
- **SC-007**: A newly added member's points total reads zero before any rewarded action.
- **SC-008**: After one attendance, one assignment upload, and one feedback submission, a student's total equals the sum of the three configured values, and changing a configured value updates totals consistently.
- **SC-009**: Submitting feedback always shows a thank-you popup that states the exact points awarded for that feedback.

## Assumptions

- **Student accounts exist in the auth system**: members are real accounts with passwords (set during onboarding), so password reset operates on the same account, reusing the admin reset email template/mechanism but for the student population. This mirrors the existing admin recovery flow.
- **Wave type already exists**: waves (tenants) already distinguish `online` vs `offline`, and each wave has an ordered list of weeks; the attendance dropdowns reuse these. No new wave-type concept is introduced.
- **"Most recently created first"** orders the offline-wave dropdown by wave creation time, newest at top.
- **Calendar day for the once-per-day rule** is a single consistent timezone (the project's operating timezone), evaluated by date (not a rolling 24-hour window); the limit is one record per student per day across all waves/weeks (FR-028).
- **Scanned attendance stays within the student's own wave** (FR-027): the offline-wave dropdown confirms that wave and selects the session's week; recording against a different wave is rejected.
- **CSV scope**: the online-wave CSV upload is performed in the context of a selected online wave and week (the same wave/week selectors used for scanning, but for the CSV path); the template carries exactly one `email` column.
- **Points are derived from rewarded actions** (attendance, assignment uploads, feedback) × the admin-configured values, recomputed on every edit so the editable table is the single source of truth (FR-029).
- **Feedback becomes persisted** by this feature (today it is display-only), since both the points award and the thank-you popup require a real submission. Feedback is assumed to be one submission per student per week, earning its points once.
- **Assignment-upload points** count once per assignment slot (the upload flow is latest-wins), not once per re-upload.
- **Mobile-first, accessible, brand-consistent, wave-isolated, and tested** per the project constitution apply to every screen and flow added here (Attendance tab, Points tab, student reset screens, popups, and tables).
