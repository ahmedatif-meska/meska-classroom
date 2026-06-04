# Feature Specification: Instructors Management

**Feature Branch**: `005-instructors-management`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "in the admin panel add instructors tab which allows admins to add or remove edit instructors when add instructor a beautiful form appear to add his image and description in the description allow font manuplation option to be exist after saving the instructors will be visible as table under each other in a beautiful view"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the list of instructors (Priority: P1)

A signed-in administrator opens the admin panel and selects the **Instructors** entry in the navigation. They land on the Instructors page, which presents every instructor as a row in a clean, well-styled table — stacked one under another — showing each instructor's photo (thumbnail), name, a preview of the formatted description, and the date the instructor was added. When no instructors exist yet, the page shows a friendly empty state inviting the administrator to add the first instructor.

**Why this priority**: The list is the foundation of the feature — it is the surface every other action (add, edit, remove) is launched from and confirmed against. Without it there is nothing to manage. It is the minimum viable slice.

**Independent Test**: Sign in as an administrator, open the Instructors page, and confirm every existing instructor appears as a row showing photo, name, description preview, and added date — and that an empty state appears when none exist.

**Acceptance Scenarios**:

1. **Given** an authenticated administrator and a set of existing instructors, **When** they open the Instructors page, **Then** every instructor is listed as a row showing photo, name, description preview, and the date added.
2. **Given** no instructors exist yet, **When** the administrator opens the Instructors page, **Then** a friendly empty state is shown with a clear call to add the first instructor.
3. **Given** the admin navigation, **When** the administrator looks at the menu, **Then** an "Instructors" entry is present and routing to it opens this page.
4. **Given** an instructor whose formatted description contains rich formatting, **When** the row preview is shown, **Then** the preview renders the instructor's formatting (or a safe truncated form of it) without breaking the table layout.

---

### User Story 2 - Add a new instructor (Priority: P1)

An administrator clicks **Add Instructor** on the Instructors page. A polished form opens, collecting the new instructor's name, a profile image (uploaded and previewed before saving), and a description authored in a rich-text editor that offers font/formatting controls — at minimum bold, italic, underline, font size, and lists — so the administrator can style the description. On save, the system validates the input, stores the instructor (image and formatted description included), closes the form, and the new instructor appears in the list. The form can be dismissed without saving, discarding any entered data and uploaded image.

**Why this priority**: Adding instructors is the primary purpose of the feature and the second half of the MVP — viewing plus adding delivers the core value of self-service instructor management.

**Independent Test**: Open the form, enter a name, upload an image (seeing a preview), compose a description using the formatting controls, save, and confirm the new instructor appears in the list with the image and the chosen formatting preserved.

**Acceptance Scenarios**:

1. **Given** the Instructors page, **When** the administrator clicks "Add Instructor", **Then** a form opens with fields for name, an image upload (with preview), and a rich-text description editor exposing font/formatting controls.
2. **Given** the form with a valid name, an uploaded image, and a description, **When** the administrator saves, **Then** the instructor is created, the form closes, and the new instructor appears in the list.
3. **Given** the rich-text editor, **When** the administrator applies formatting (e.g., bold, italic, underline, font size, lists) to the description, **Then** that formatting is retained on save and reflected when the description is viewed again.
4. **Given** the image upload control, **When** the administrator selects an image, **Then** a preview of the chosen image is shown before saving.
5. **Given** the form, **When** the administrator submits with a missing required field (e.g., empty name), **Then** submission is blocked with a clear validation message and no instructor is created.
6. **Given** the administrator selects a file that is not a supported image type or exceeds the allowed size, **When** they attempt to use it, **Then** the upload is rejected with a clear message and no instructor is created from that file.
7. **Given** the form is open with entered data, **When** the administrator cancels or closes it, **Then** the form closes, no instructor is created, and the entered data and uploaded image are discarded.

---

### User Story 3 - Edit an existing instructor (Priority: P2)

From the Instructors list, an administrator opens the edit action on an instructor's row. The same polished form opens, pre-populated with the instructor's current name, image, and formatted description. The administrator can change any of these — replace the image, rename, or re-format the description — and save. After saving, the list reflects the updated details. The administrator can cancel an edit without changing anything.

**Why this priority**: Editing keeps instructor information accurate over time but depends on the list (US1) and on the create form (US2) already existing; it is valuable but secondary to being able to view and add instructors.

**Independent Test**: With at least one instructor present, open its edit form, change the name and description formatting and replace the image, save, and confirm the row reflects every change; separately confirm that cancelling leaves the instructor unchanged.

**Acceptance Scenarios**:

1. **Given** an instructor in the list, **When** the administrator triggers the edit action, **Then** the form opens pre-populated with that instructor's current name, image, and formatted description.
2. **Given** the edit form, **When** the administrator changes the name, replaces the image, and/or re-formats the description and saves, **Then** the instructor is updated and the list reflects the new details.
3. **Given** the edit form is open, **When** the administrator cancels, **Then** no changes are persisted and the instructor remains as it was.
4. **Given** the edit form, **When** the administrator clears a required field (e.g., name) and tries to save, **Then** saving is blocked with a clear validation message and the prior values are preserved.

---

### User Story 4 - Remove an instructor (Priority: P2)

From the Instructors list, an administrator removes an instructor using the row's remove action. The system asks for confirmation before removing. After confirmation, the instructor (and the association to their image) no longer appears in the list. Cancelling the confirmation leaves the instructor in place.

**Why this priority**: Removal rounds out lifecycle management but depends on the list (US1) and is secondary to creating and editing instructors.

**Independent Test**: With at least one instructor present, trigger remove on a row, confirm, and verify the instructor disappears from the list; separately confirm that cancelling the confirmation keeps the instructor.

**Acceptance Scenarios**:

1. **Given** the Instructors list with at least one instructor, **When** the administrator triggers remove on a row and confirms, **Then** that instructor is removed and no longer appears in the list.
2. **Given** the remove action is triggered, **When** the confirmation prompt appears and the administrator cancels, **Then** no instructor is removed.
3. **Given** an instructor has been removed, **When** the list is shown again, **Then** the removed instructor does not reappear.

---

### Edge Cases

- What happens when an image upload fails or is interrupted partway? (The instructor is not saved with a broken image; the administrator is told the upload did not complete and can retry.)
- What happens when the description is left empty but a name and image are provided? (Description handling follows the required/optional decision in Requirements; if optional, an empty description is allowed and the row shows a neutral placeholder.)
- What happens when the formatted description is very long? (The list preview is truncated to keep rows readable; the full formatted description is available in the edit form / a detail view.)
- How does the table behave with many instructors on a small (320px) screen? (The list adopts a documented mobile strategy — stacked cards or horizontal scroll — with no clipped controls or broken layout.)
- What happens when a pasted or authored description contains unsupported or unsafe formatting/markup? (Only the supported formatting is retained; unsafe markup is stripped/sanitized so it cannot affect the page.)
- What happens when two administrators edit or remove the same instructor at nearly the same time? (The operations resolve without leaving a broken or duplicated row; a removed instructor stays removed.)
- What happens to an instructor's stored image when the instructor is removed or its image is replaced? (The prior image association is no longer referenced by the list.)

## Clarifications

### Session 2026-06-04

- Q: Are instructor photos stored where they can be viewed without an admin login? → A: Yes — instructor photos are publicly readable by direct URL (they are display assets); instructor **records/metadata** (name, description, the list itself) remain admin-only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The admin navigation MUST present an **"Instructors"** entry that routes to the Instructors page, consistent in placement and styling with the existing admin navigation entries.
- **FR-002**: The Instructors page MUST list all existing instructors, each row showing at least: profile image (thumbnail), name, a preview of the formatted description, and the date the instructor was added.
- **FR-003**: The Instructors page MUST present a defined empty state (when no instructors exist), loading state, and error state, consistent with the project's brand and UX standards.
- **FR-004**: The page MUST provide an "Add Instructor" action that opens a form to create a new instructor.
- **FR-005**: The add/edit form MUST collect an instructor name, a profile image, and a description.
- **FR-006**: The form MUST allow the administrator to upload a profile image and MUST show a preview of the selected image before saving.
- **FR-007**: The form MUST validate uploaded images against supported image types and a maximum size, rejecting unsupported or oversized files with a clear message and creating no instructor from them.
- **FR-008**: The description field MUST be a rich-text editor that provides font/formatting controls — at minimum bold, italic, underline, font size, and lists — and MUST preserve the applied formatting when saved and when the description is later viewed or edited.
- **FR-009**: The system MUST sanitize the rich-text description so that only supported formatting is stored and rendered, and any unsafe or unsupported markup is removed (it MUST NOT be able to execute or alter the page).
- **FR-010**: The form MUST require a non-empty name; submission MUST be blocked with a clear validation message when a required field is missing or invalid, and no instructor is created or updated.
- **FR-011**: On successful save of a new instructor, the system MUST persist the instructor (name, image, and formatted description), close the form, and show the new instructor in the list.
- **FR-012**: The administrator MUST be able to dismiss the add/edit form (cancel or close) without saving, discarding entered data and any not-yet-saved uploaded image.
- **FR-013**: The page MUST provide a per-row edit action that opens the form pre-populated with the instructor's current name, image, and formatted description, and persists changes only on save.
- **FR-014**: The page MUST provide a per-row remove action that requires explicit confirmation before removing an instructor; after a confirmed removal the instructor MUST no longer appear in the list, and cancelling the confirmation MUST remove nothing.
- **FR-015**: All Instructors actions (view, add, edit, remove, image upload) MUST be available only to authenticated administrators and MUST be enforced server-side; a request without a valid admin session MUST be denied.
- **FR-016**: The list MUST keep rows readable when descriptions are long by showing a truncated preview, while the full formatted description remains accessible via edit (or a detail view).
- **FR-017**: The Instructors page, form, table, image upload, and rich-text editor MUST be responsive (320px through desktop), keyboard accessible, show visible focus, and meet the project's accessibility (WCAG 2.1 AA) and brand standards.
- **FR-018**: Reads of the instructor list MUST be bounded/paginated if the number of instructors grows large, so the page remains performant on mobile.

### Key Entities *(include if feature involves data)*

- **Instructor**: A person presented in the admin Instructors list. Attributes: name, profile image (an uploaded image reference), formatted description (rich text limited to supported formatting), and the timestamp the instructor was added. Managed exclusively by administrators.
- **Instructor image**: An uploaded image asset associated with exactly one instructor, constrained to supported types and a maximum size, replaceable on edit and no longer referenced by the list once the instructor is removed. The image bytes are **publicly readable by direct URL** (a display asset); the instructor's record and the list remain admin-only.
- **Formatted description**: The instructor's biography/description authored via the rich-text editor, retaining only the supported formatting (e.g., bold, italic, underline, font size, lists) and sanitized of unsafe markup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can open the Instructors page and see the complete, accurate list (photo, name, description preview, added date) within 3 seconds on a typical mobile connection.
- **SC-002**: An administrator can add a new instructor — from clicking "Add Instructor" to the instructor appearing in the list, including uploading an image and formatting a description — in under 2 minutes.
- **SC-003**: 100% of formatting applied in the editor (bold, italic, underline, font size, lists) is preserved exactly after saving and re-opening the instructor for edit.
- **SC-004**: 100% of attempts to save an instructor with a missing required field, an unsupported image type, or an oversized image are rejected with a clear message and create or modify no instructor.
- **SC-005**: An administrator can edit any instructor's name, image, and description and see every change reflected in the list on the first save attempt.
- **SC-006**: After a confirmed removal, the instructor never reappears in the list; cancelling a removal leaves the instructor present 100% of the time.
- **SC-007**: 0 instances of unsafe markup from a description are stored or able to affect the page, verified by automated tests.
- **SC-008**: The Instructors page, form, and rich-text editor are usable with no horizontal scroll, clipping, or inaccessible controls at 320, 390, 430, 768px, and desktop widths.

## Assumptions

- **Admin-only scope (for now)**: Instructors are created and managed in the admin panel, and "visible as a table" refers to the admin Instructors list. Surfacing instructors on a student-facing or public page is **out of scope** for this feature and may be introduced in a later amendment. (If public visibility is desired, it should be specified separately.) *Note*: per the 2026-06-04 clarification, the uploaded image **bytes** are publicly readable by direct URL even though the instructor records/list are admin-only — see Clarifications.
- **Image storage is provisioned by the operator** *(clarified 2026-06-04)*: The administrator creates the public storage location (a Supabase Storage bucket named `instructor-images`) out of band; the feature's migration provisions only the admin-only **write** authorization for it, not the location itself. This is an implementation note carried in the plan/data-model.
- **Name is required**: The user described "his image and description"; a name is assumed to be a required identifying field for each instructor, since a list of unnamed people would not be usable. Name, image, and description are the core fields; no role/title/contact fields are included unless added later.
- **Image is expected but the exact constraints follow project conventions**: Supported image types (e.g., common web formats such as PNG/JPEG/WebP) and a maximum file size are enforced; the precise allowed types and size limit are an implementation decision deferred to planning, guided by performance and the lazy-media principle.
- **"Font manipulation" means a rich-text editor**: The requested formatting capability is interpreted as an inline rich-text editor with a toolbar (bold, italic, underline, font size, lists at minimum). The exact set of controls beyond this minimum is a planning decision; arbitrary custom fonts/typefaces are not assumed — "font size"/emphasis styling is the baseline.
- **Description optionality**: The description is treated as optional unless planning decides otherwise; when empty, the list shows a neutral placeholder. (Name and image are the firmer requirements.)
- **Authorization scope**: Any authenticated administrator may add, edit, or remove instructors. Finer-grained permissions among administrators are out of scope.
- **Builds on existing admin panel infrastructure**: This feature reuses the established admin shell, navigation, table, and authentication patterns (e.g., the admin dashboard/admins surfaces) and the project's brand tokens and component conventions.
- **Removal semantics**: "Remove" makes the instructor disappear from the list and the admin surfaces. Whether the underlying record/image is hard-deleted or soft-deleted/retained is an implementation choice deferred to planning; the observable behavior (gone from list) is what this spec guarantees.
- **Ordering**: Instructors are listed in a consistent, predictable order (e.g., most recently added first, or by name); the exact default ordering is a planning decision.
