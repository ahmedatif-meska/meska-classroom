# Feature Specification: Wave Management

**Feature Branch**: `008-wave-management`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "i want to create a create wave feature. take care this is the most critical feature in the app. feature goal: allowing admins to create edit and manage waves... a Waves tab with a create-wave button, waves listed as beautiful cards sorted descending; a wave can be created either from the Waves tab or inline while adding members; a wave has name, description, type (online/offline) and weeks; each week has an optional description, materials, and assignments; the wave description must reflect on the student dashboard and is authored the same way the instructor description is."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates a wave and sees it listed (Priority: P1)

An administrator opens the new **Waves** area, clicks **Create wave**, and on a single creation page gives the wave a name, writes a rich-text description, and chooses a type (**Online** or **Offline**). After saving, the wave appears as a card in the Waves list, which is sorted so the most recently created wave appears first.

**Why this priority**: A wave is the organizing container for every member, week, material, and assignment in the app. Without the ability to create and see waves, no member can be assigned and no course content can exist. This is the minimum viable slice and the foundation the rest of the feature builds on.

**Independent Test**: Sign in as an admin, create a wave with a name, description, and type, and confirm it renders as a card at the top of the Waves list and persists across a page reload.

**Acceptance Scenarios**:

1. **Given** an admin on the Waves area, **When** they click **Create wave**, fill in a name, author a description, select a type, and save, **Then** the wave is persisted and shown as a card in the Waves list.
2. **Given** several existing waves, **When** the admin views the Waves list, **Then** waves are displayed as cards ordered from newest to oldest (descending by creation time).
3. **Given** the create form, **When** the admin submits without a name or without a type, **Then** the wave is not created and a clear inline validation message is shown.
4. **Given** the create form, **When** the admin authors a description with formatting (bold, lists, links, etc.), **Then** the saved description preserves the safe formatting and discards any unsafe markup.
5. **Given** a non-admin (student or signed-out visitor), **When** they attempt to reach the Waves area or the create action, **Then** access is denied with a generic message and no wave data is exposed.

---

### User Story 2 - Student sees their wave's description on the dashboard (Priority: P1)

A student signs in and, on their dashboard, sees the description of the wave they are enrolled in, rendered with the formatting the admin authored. A student never sees the description or any content of a wave they are not enrolled in.

**Why this priority**: The user explicitly requires the wave description to reflect on the student dashboard, and it is the primary student-facing payoff of authoring a wave. It also exercises the non-negotiable wave-isolation boundary end to end.

**Independent Test**: Enroll a test student in a wave that has a description, sign in as that student, and confirm the description appears on their dashboard; confirm a student in a different wave does not see it.

**Acceptance Scenarios**:

1. **Given** a student enrolled in a wave that has a description, **When** they open their dashboard, **Then** the wave's description is displayed with its authored formatting.
2. **Given** a student enrolled in a wave with no description, **When** they open their dashboard, **Then** a sensible empty state is shown (no broken or blank region).
3. **Given** two waves with different descriptions, **When** a student enrolled in wave A views their dashboard, **Then** they see only wave A's description and never wave B's.

---

### User Story 3 - Admin structures a wave into weeks with materials and assignments (Priority: P2)

From a wave's page, an admin adds one or more **weeks**. Each week can carry an optional description and can hold **materials** and **assignments** that the admin attaches to that week.

**Why this priority**: Weeks, materials, and assignments are the substance of a wave, but a wave is usable and demonstrable (with members and a description) before they exist, so this builds on top of the P1 MVP.

**Independent Test**: Open an existing wave, add a week, give it a description, attach a material and an assignment, save, and confirm they persist and render under the correct week on reload.

**Acceptance Scenarios**:

1. **Given** an admin on a wave's page, **When** they add a week, **Then** the week is created under that wave and listed in order.
2. **Given** a week, **When** the admin adds an optional description, **Then** it is saved and shown with the week.
3. **Given** a week, **When** the admin uploads a material file (e.g. PPT or PDF) with a title, **Then** the material is attached to that week and listed as downloadable.
4. **Given** a week, **When** the admin adds an assignment (title, instructions, optional due date), **Then** the assignment is attached to that week and listed.
5. **Given** a week with no description, materials, or assignments, **When** the wave is viewed, **Then** the empty week renders with a clear empty state rather than an error.

---

### User Story 4 - Student downloads materials and submits assignments (Priority: P2)

A student, on their dashboard, sees their wave's weeks, downloads the materials (PPT/PDF) for a week, and uploads a file as their submission for an assignment. Everything is scoped to their own wave; they can never reach another wave's files or another student's submission.

**Why this priority**: This is the student-facing payoff of the weeks/materials/assignments authored in User Story 3, and it exercises file-level wave isolation — a non-negotiable boundary. It depends on US3 content existing.

**Independent Test**: As a student enrolled in a wave that has a week with a material and an assignment, download the material, upload a submission, and confirm the admin can see that submission; confirm a student in another wave cannot reach either file.

**Acceptance Scenarios**:

1. **Given** a student enrolled in a wave with week materials, **When** they open their dashboard, **Then** they can download each material of their own wave.
2. **Given** an assignment in the student's wave, **When** the student uploads a submission file, **Then** it is stored as their submission and the admin can view/download it.
3. **Given** a student in wave A, **When** they attempt (by any means) to fetch a material or submission belonging to wave B, **Then** access is denied.
4. **Given** a student who already submitted, **When** they upload again, **Then** their latest submission replaces the previous one for that assignment.

---

### User Story 5 - Admin edits and manages an existing wave (Priority: P2)

An admin opens an existing wave and can rename it, edit its description, change its type, and edit or remove its weeks, materials, and assignments. Changes are reflected to enrolled students.

**Why this priority**: "Manage" is an explicit goal; once waves exist they must be maintainable. It depends on P1 (waves existing) and overlaps P2 (weeks/content).

**Independent Test**: Edit an existing wave's name, description, and type; confirm the changes persist and that an enrolled student sees the updated description.

**Acceptance Scenarios**:

1. **Given** an existing wave, **When** the admin edits its name, description, or type and saves, **Then** the changes persist and the card and student view reflect them.
2. **Given** a wave with weeks/content, **When** the admin edits or removes a week, material, or assignment, **Then** the change persists.
3. **Given** a wave that has enrolled members, **When** the admin attempts to delete the wave, **Then** the system prevents data loss for those members [see Edge Cases / FR-018].

---

### User Story 6 - Admin creates a wave inline while adding members (Priority: P3)

While adding members, where an admin must choose which wave to assign them to, the admin can instead choose to create a new wave. Doing so takes them to the same wave-creation experience used from the Waves tab; after creating the wave it is available to assign the members to.

**Why this priority**: A convenience shortcut that removes a context switch. Valuable but not required for the core create/manage/view loop, and it reuses the P1 creation flow.

**Independent Test**: Start adding members, choose the create-a-wave option from the wave chooser, create a wave, and confirm the new wave can then be selected for the members being added.

**Acceptance Scenarios**:

1. **Given** the add-members wave chooser, **When** the admin selects the create-a-wave option, **Then** they reach the same wave-creation experience used from the Waves tab.
2. **Given** a wave just created via the inline path, **When** the admin returns to assign members, **Then** the new wave is selectable.

---

### Edge Cases

- **Duplicate wave name**: Two waves with the same name are allowed; cards and lists rely on creation order and identifiers, not name uniqueness.
- **Deleting a non-empty wave**: Blocked with a clear explanation; the admin must reassign/remove members and clear content first (FR-018) — never silently orphans members or stored files.
- **Very long description or many weeks/materials**: The Waves list and wave page must stay performant and readable (bounded/paginated reads, lazy media on mobile).
- **Unsafe content in description**: Authored rich text must be sanitized server-side before it is ever stored or shown to a student.
- **Unsupported or oversized upload**: Uploading a material/submission of a disallowed type or beyond the size limit is rejected with a clear message and stores nothing.
- **Student fetching another wave's file**: A student requesting a material or submission outside their own wave (by guessing a path or signed link) is denied — file access is wave-scoped server-side.
- **Resubmission**: A student uploading a new submission replaces their prior one for that assignment (latest wins); no history kept in v1.
- **Concurrent edits**: Two admins editing the same wave — last write wins is acceptable for v1.
- **Type change after content exists**: Changing a wave's type later is allowed and affects only the label, not enrollment or files.
- **Empty Waves list**: First-run state with zero waves shows an inviting empty state with the create action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an admin-only **Waves** area, reachable from the admin navigation, that lists all waves as cards.
- **FR-002**: The Waves list MUST be sorted in descending order by creation time (newest first).
- **FR-003**: Admins MUST be able to create a wave by providing a **name** (required), a **description** (optional, rich text), and a **type** that is exactly one of **Online** or **Offline** (required).
- **FR-004**: The system MUST reject wave creation when the name is empty or the type is not chosen, showing a clear, inline validation message and creating nothing.
- **FR-005**: Wave descriptions MUST be authored using the same rich-text authoring experience used for instructor descriptions, and MUST be sanitized server-side before storage so stored markup can never contain unsafe content.
- **FR-006**: Admins MUST be able to start wave creation from two entry points — the Waves area, and the wave-selection step of the add-members flow — both leading to the same creation experience.
- **FR-007**: The system MUST display an enrolled student's own wave description on their dashboard, rendered with the authored (sanitized) formatting.
- **FR-008**: A student MUST never be able to see the description, weeks, materials, or assignments of any wave they are not enrolled in (wave isolation, enforced server-side).
- **FR-009**: Admins MUST be able to add one or more **weeks** to a wave, each with an **optional description**.
- **FR-010**: Weeks within a wave MUST be presented in a deterministic, admin-meaningful order.
- **FR-011**: Admins MUST be able to attach **materials** to a week by uploading document files (at minimum PowerPoint and PDF). Each material has a title and the uploaded file.
- **FR-011a**: A student enrolled in the wave MUST be able to **download** the materials of their own wave's weeks; a student MUST NOT be able to download (or otherwise access) materials of any wave they are not enrolled in.
- **FR-012**: Admins MUST be able to attach **assignments** to a week. An assignment has a title, instructions, and an optional due date.
- **FR-012a**: A student enrolled in the wave MUST be able to **upload a submission file** for an assignment in their own wave. A student MUST only be able to submit to assignments in their own wave, and MUST only be able to see their own submissions.
- **FR-012b**: Admins MUST be able to view and download the submissions students have made for an assignment. Grading and written feedback are explicitly OUT OF SCOPE for this feature.
- **FR-012c**: All uploaded files (materials and submissions) MUST be stored privately and access-controlled so that wave isolation holds for files exactly as it does for database rows: students reach only their own wave's materials and only their own submissions; admins reach all.
- **FR-013**: Admins MUST be able to edit an existing wave's name, description, and type, with changes persisting and reflecting to enrolled students.
- **FR-014**: Admins MUST be able to edit and remove a wave's weeks, materials, and assignments (removing a material or submission also removes its stored file).
- **FR-015**: Every wave-management action (create, edit, delete of waves and their content) MUST be restricted to authenticated admins; non-admins MUST receive a generic denial that leaks no wave data.
- **FR-016**: All wave-scoped reads MUST be bounded/paginated as needed so the Waves list and wave pages remain performant on mobile.
- **FR-017**: Every screen of this feature (Waves list, create/edit wave, week/material/assignment authoring, the student-facing wave view, and student download/upload) MUST define loading, empty, and error states and meet the project's mobile-first, accessible, brand-consistent standards.
- **FR-018**: Deleting a wave MUST be **blocked while the wave is non-empty** — i.e. while it still has enrolled members, weeks, materials, assignments, or submissions. The admin is told why and must reassign/remove members and clear content first. (This prevents orphaned members and orphaned stored files. Default policy; soft-archive is a possible future change.)
- **FR-019**: A wave's type (Online/Offline) is a **per-wave attribute** chosen at creation and editable later, and MUST be visible to admins on the wave card and the wave's page. The two pre-seeded generic "Online"/"Offline" waves were reference data only and MUST be removed; there are no existing members to migrate.

### Key Entities *(include if feature involves data)*

- **Wave**: The top-level container and the isolation boundary for member and course data. Key attributes: name, description (sanitized rich text), type (Online | Offline), creation time (drives list ordering). A wave has many weeks and many enrolled members. (In this codebase a wave is the existing tenant/cohort concept.)
- **Week**: A unit of a wave's schedule. Key attributes: belongs to exactly one wave, optional description, ordering position. A week has many materials and many assignments.
- **Material**: A downloadable resource attached to a week. Key attributes: title, the uploaded file (at least PowerPoint and PDF), belongs to exactly one week. Stored privately; downloadable by enrolled students and admins.
- **Assignment**: A task attached to a week. Key attributes: title, instructions, optional due date, belongs to exactly one week. Has many submissions.
- **Submission**: A student's uploaded response to an assignment. Key attributes: belongs to exactly one assignment and exactly one student, the uploaded file, submitted time. Stored privately; readable by its owning student and admins only.
- **Member (student)**: An existing entity; each member is enrolled in exactly one wave and, on their dashboard, sees only that wave's description, weeks, and materials, can download those materials, and can upload submissions — all scoped to their own wave only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a complete wave (name, description, type) and see it as the first card in the list in under 2 minutes, with no page errors.
- **SC-002**: 100% of newly created waves appear in the list ordered newest-first, with zero ordering regressions across reloads.
- **SC-003**: A student enrolled in a wave sees that wave's description on their dashboard within one normal page load, and in testing 0 students ever see another wave's description (wave-isolation denial case covered by an automated test).
- **SC-004**: An admin can add a week with a description, upload a material (PPT/PDF), and add an assignment to an existing wave in under 2 minutes, and they persist across reloads.
- **SC-005**: Every screen in the feature renders correctly and is operable via keyboard and touch from 320px width through desktop, meeting WCAG 2.1 AA contrast.
- **SC-006**: Attempting to delete a wave that still has members or content is always blocked with a clear explanation, and in testing never results in orphaned members or orphaned stored files.
- **SC-007**: Non-admins are denied every wave-management action with a generic message in 100% of attempts, with no wave data leaked.
- **SC-008**: In testing, 0 students can download another wave's materials and 0 students can read another student's submission (file-level wave-isolation denial cases covered by automated tests).
- **SC-009**: A student can download a material and upload an assignment submission from their dashboard, each in under 1 minute on a mobile device, and the admin can then see that submission.

## Assumptions

- **Wave == tenant/cohort**: This feature evolves the existing tenant (wave) concept rather than introducing a parallel "waves" table; member data continues to be scoped by the member's wave, and existing wave-isolation enforcement is reused.
- **Type is a per-wave attribute**: Each wave carries its own Online/Offline type, set at creation and editable later. The two pre-seeded generic "Online"/"Offline" waves were reference data and are removed; the roster is starting fresh with no members to migrate.
- **Description authoring reuses the instructor pattern**: The same rich-text editor and the same server-side sanitization approach are used; no new authoring paradigm is introduced.
- **One wave per member**: A member belongs to exactly one wave (consistent with the current single wave-selection on add-members). Multi-wave enrollment is out of scope.
- **Materials are documents, not media streams**: Materials are downloadable document files (PowerPoint, PDF at minimum). In-app slide/PDF rendering is not required — download is sufficient. (Exact accepted file types and size limits are an implementation detail to be set in the plan.)
- **Assignments are submit-only**: Students upload a submission file; admins can view/download submissions. No grading, scoring, or written feedback in this feature.
- **One submission per student per assignment (latest wins)**: A student re-uploading replaces their previous submission for that assignment, unless the plan decides otherwise. (Resubmission history is not required for v1.)
- **Private file storage with wave-scoped access**: Materials and submissions live in private storage; access is authorized server-side so wave isolation holds at the file level. (See Dependencies for the buckets to provision.)
- **Delete is block-while-non-empty**: A wave cannot be deleted while it has members or content; this avoids orphaned rows and files. Soft-archive is a possible future enhancement, not in scope now.
- **English-only, LTR**: Consistent with the constitution; no internationalization.
- **Names are not required to be globally unique**: Ordering and identity rely on creation time / identifiers, not on name uniqueness; duplicate names are permitted.
- **Last-write-wins** for concurrent admin edits in v1.
- **Reasonable bounds**: List and detail reads are paginated/bounded per the performance principle; exact page sizes are an implementation detail.

## Dependencies

- Existing admin authentication and authorization (admin session gating).
- Existing wave (tenant) data and wave-isolation enforcement (`is_admin()` / `jwt_tenant_id()` helpers).
- Existing rich-text authoring and server-side sanitization (as used for instructor descriptions).
- Existing add-members flow and its wave-selection step (entry point for inline creation).
- Existing student dashboard (surface for the wave description, weeks, and materials).
- **Two new PRIVATE Supabase Storage buckets** to be created by the operator in the dashboard (mirroring how `instructor-images` was provisioned), with RLS write/read policies added by migration:
  - **`wave-materials`** — admin-write, read by admins and students enrolled in the owning wave. Object paths embed the wave id as the first folder so wave-scoped read policies are enforceable (e.g. `<wave_id>/<week_id>/<file>`). Downloads via short-lived signed URLs.
  - **`assignment-submissions`** — student-write/read for their own files, admin-read for all. Object paths embed the wave id (and student id) as folders (e.g. `<wave_id>/<assignment_id>/<student_id>/<file>`).
  - Unlike `instructor-images`, both buckets are **private** — wave files must never be world-readable.
