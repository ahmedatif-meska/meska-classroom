# Feature Specification: Student Home & Weeks Navigation

**Feature Branch**: `010-student-home-weeks`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "in the student panel: (1) change Dashboard to Home; (2) replace 'Dashboard / Overview of your student workspace' with 'Welcome to [student name] 👋'; (3) instead of 'Your wave' say 'You are in wave [wave name]'; (4) add a Weeks tab in the left sidebar that expands to a drop-down list of the weeks created in the student's wave (week 1, week 2, … only as many as exist); (5) inside a week show Resources and Assignments to download, each as a labelled drop-down (Resources holds the materials, Assignments holds the assignments); (6) do not show materials and assignments on the Home screen — only inside the weeks; (7) add an 'About instructors' section on Home that shows the instructors created in the admin panel."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A student lands on a personalized Home (Priority: P1)

A student signs in and arrives on a page now titled **Home** (in both the page heading and the left-sidebar navigation, where it previously read "Dashboard"). Instead of the generic "Dashboard / Overview of your student workspace," the page greets them by name — **"Welcome to [their name] 👋"**. The wave section no longer reads "Your wave"; it reads **"You are in wave [wave name]"** and shows the wave's authored description. The Home page is a clean overview: it does **not** list any materials or assignments (those now live inside weeks), and the student's QR code remains available.

**Why this priority**: This is the first thing every student sees and the framing for everything else. It is a self-contained, demonstrable slice (rename + greeting + wave label) that delivers immediate value and can ship before weeks navigation or instructors exist.

**Independent Test**: Sign in as a student enrolled in a named wave, confirm the navigation item and page heading read "Home," the greeting shows the student's own name with the 👋 emoji, the wave section reads "You are in wave [wave name]" with the wave description, and no materials or assignments appear anywhere on Home.

**Acceptance Scenarios**:

1. **Given** a signed-in student, **When** they open the student panel, **Then** the sidebar navigation entry and the page heading both read "Home" (never "Dashboard").
2. **Given** a signed-in student whose roster name is known, **When** Home loads, **Then** the page greets them with "Welcome to [their name] 👋".
3. **Given** a student enrolled in a wave that has a name, **When** Home loads, **Then** the wave section reads "You are in wave [wave name]" and shows the wave's authored description (or a sensible empty state if the wave has no description).
4. **Given** the student's wave has materials and assignments, **When** the student views Home, **Then** no materials and no assignments are shown on Home (they appear only inside weeks — see User Story 2).
5. **Given** a student whose display name is unavailable, **When** Home loads, **Then** the greeting falls back gracefully (e.g., to their account email) rather than showing an empty or broken name.

---

### User Story 2 - A student browses weeks and downloads each week's Resources and Assignments (Priority: P1)

The student's left sidebar has a **Weeks** entry with an expand/collapse arrow. Expanding it reveals a drop-down list of exactly the weeks that exist in the student's wave — if the wave has two weeks, the student sees "Week 1" and "Week 2," and no more. Selecting a week opens that week's content. Within a week, the student sees a **Resources** group (a labelled drop-down) containing that week's materials and an **Assignments** group (a labelled drop-down) containing that week's assignments, each item downloadable. The student can submit their assignment files exactly as before. A student only ever sees the weeks and content of their own wave.

**Why this priority**: Relocating materials and assignments out of Home and into per-week Resources/Assignments groups is the core structural change the user asked for and the primary way students reach course content. It is independently testable and delivers the main day-to-day value.

**Independent Test**: Enroll a student in a wave that has two weeks (each with at least one material and one assignment), sign in, expand **Weeks**, confirm exactly "Week 1" and "Week 2" appear, open a week, confirm its Resources drop-down lists that week's materials (downloadable) and its Assignments drop-down lists that week's assignments (downloadable + submittable), and confirm a student in a different wave never sees these.

**Acceptance Scenarios**:

1. **Given** a student whose wave has N weeks, **When** they expand the **Weeks** navigation entry, **Then** exactly N week entries are listed in the wave's week order, and a wave with zero weeks shows a clear empty state rather than an empty or broken list.
2. **Given** the expanded Weeks list, **When** the student selects a week, **Then** that week's content opens showing a **Resources** group and an **Assignments** group as labelled, collapsible drop-downs.
3. **Given** a selected week with materials, **When** the student opens its **Resources** drop-down, **Then** every material of that week is listed and downloadable, and a week with no materials shows a clear empty state.
4. **Given** a selected week with assignments, **When** the student opens its **Assignments** drop-down, **Then** every assignment of that week is listed, downloadable, and submittable exactly as in the current flow, and a week with no assignments shows a clear empty state.
5. **Given** a student in wave A, **When** they browse weeks and their content, **Then** they only ever see wave A's weeks, materials, and assignments — never another wave's (wave isolation, enforced server-side).
6. **Given** a student who downloads a material or assignment file, **When** they request it, **Then** the file downloads through the same secure, wave-scoped access used today (no broadening of file access).

---

### User Story 3 - A student sees the instructors on Home (Priority: P2)

On the Home page, below the wave section, the student sees an **About instructors** section presenting the instructors that administrators have created in the admin panel — each with their photo, name, and formatted biography/description. Whatever instructors an admin adds, edits, or removes in the admin panel is reflected to students here. When no instructors exist, the section shows a friendly empty state (or is omitted) rather than a broken region.

**Why this priority**: Surfacing instructors enriches the student's Home but is additive — Home is fully usable (greeting, wave, QR) and weeks navigation works without it. It also depends on changing instructor visibility (today instructors are admin-only), so it is sequenced after the core P1 slices.

**Independent Test**: As an admin, create two instructors with photos and descriptions; sign in as a student and confirm both appear in the Home "About instructors" section with their photo, name, and formatting; remove one as an admin and confirm it disappears for the student.

**Acceptance Scenarios**:

1. **Given** administrators have created instructors, **When** a student opens Home, **Then** an "About instructors" section lists those instructors, each showing photo, name, and formatted description.
2. **Given** an admin adds, edits, or removes an instructor, **When** a student next views Home, **Then** the change is reflected (added/edited instructors appear/update; removed instructors no longer appear).
3. **Given** no instructors have been created, **When** a student opens Home, **Then** the section shows a friendly empty state (or is not rendered) without any error or broken layout.
4. **Given** an instructor description authored with formatting, **When** it is shown to the student, **Then** the supported formatting is rendered and any unsafe markup is stripped (sanitized), exactly as in the admin view.

---

### Edge Cases

- **Student not yet assigned to a wave (or wave deleted):** Home still renders the greeting and QR; the wave line and weeks reflect the unassigned state (e.g., a clear "not in a wave yet" message), and the Weeks list is empty/disabled rather than erroring.
- **Wave with no weeks:** The Weeks navigation still appears but expands to a clear empty state; Home is unaffected.
- **Week with no materials and/or no assignments:** The respective Resources/Assignments drop-down shows a clear empty state; an entirely empty week renders cleanly.
- **Very long week list or many materials/assignments:** Navigation and week content stay readable and performant on mobile (bounded/lazy as needed); the Weeks drop-down remains scrollable/usable at 320px.
- **Student display name missing or unusual characters:** The greeting degrades gracefully (fallback identifier) and never renders a broken or empty greeting.
- **Instructors visibility:** Making instructors visible to students must not expose any admin-only management capability — students can view instructor display info only, never add/edit/remove.
- **Unsafe markup in an instructor or wave description:** Rich text is sanitized before it is shown to a student.
- **Mobile drawer:** On small screens the Weeks expand/collapse and week selection work inside the existing mobile navigation drawer, keyboard-accessible with visible focus.
- **Deep link / refresh on a selected week:** Reloading while viewing a week returns the student to a coherent state (the same week or Home), not an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The student navigation entry and the page heading currently labeled "Dashboard" MUST be relabeled **"Home"** everywhere they appear in the student panel.
- **FR-002**: The Home page MUST replace the "Dashboard / Overview of your student workspace" heading and subtitle with a greeting of the form **"Welcome to [student name] 👋"**, using the student's roster display name.
- **FR-003**: When the student's display name is unavailable, the greeting MUST fall back to a sensible identifier (e.g., the account email) and never render empty or broken.
- **FR-004**: The wave section on Home MUST be labeled **"You are in wave [wave name]"** (replacing "Your wave") and MUST continue to show the wave's authored, sanitized description, with a sensible empty state when the wave has no description.
- **FR-005**: The Home page MUST NOT display any materials or assignments; these MUST appear only within weeks (see FR-009–FR-011).
- **FR-006**: The student sidebar MUST include a **Weeks** navigation entry with an expand/collapse control (an arrow/disclosure affordance) that toggles a drop-down list of weeks.
- **FR-007**: The expanded **Weeks** list MUST contain exactly the weeks that exist in the signed-in student's own wave, presented in the wave's defined week order, labeled per week (e.g., "Week 1", "Week 2", …); it MUST never list weeks from another wave.
- **FR-008**: When the student's wave has no weeks, the **Weeks** entry MUST present a clear empty state rather than an empty or broken list.
- **FR-009**: Selecting a week MUST open that week's content, which MUST present a **Resources** group and an **Assignments** group, each as a labelled, collapsible drop-down.
- **FR-010**: The **Resources** group for a week MUST list that week's materials as downloadable items, with a clear empty state when the week has no materials; downloads MUST use the existing secure, wave-scoped file access (no broadening of access).
- **FR-011**: The **Assignments** group for a week MUST list that week's assignments as downloadable items and MUST preserve the existing assignment-submission capability (a student can upload their submission), with a clear empty state when the week has no assignments.
- **FR-012**: A student MUST only ever see the weeks, materials, and assignments of the wave they are enrolled in; cross-wave content MUST be denied, enforced server-side (wave isolation — non-negotiable).
- **FR-013**: The Home page MUST include an **About instructors** section that displays the instructors created in the admin panel, each showing at least their photo, name, and formatted (sanitized) description.
- **FR-014**: Instructor information shown to students MUST reflect the current admin-managed set — instructors added, edited, or removed by an admin MUST appear, update, or disappear for students accordingly.
- **FR-015**: Making instructor display information visible to students MUST NOT grant students any ability to create, edit, remove, or otherwise manage instructors; those actions remain admin-only and enforced server-side.
- **FR-016**: When no instructors exist, the **About instructors** section MUST show a friendly empty state or be omitted, with no broken layout or error.
- **FR-017**: The student's QR code section MUST remain available on Home, unchanged in function.
- **FR-018**: All new and changed student-facing surfaces (Home greeting, wave label, Weeks navigation and its drop-down, per-week Resources/Assignments drop-downs, About instructors) MUST define loading, empty, and error states and meet the project's mobile-first, responsive (320px→desktop), keyboard-accessible (visible focus), WCAG 2.1 AA, and brand-consistency standards, including correct behavior inside the existing mobile navigation drawer.
- **FR-019**: All user-facing text introduced by this feature (e.g., "Home", the greeting template, "You are in wave …", "Weeks", "Resources", "Assignments", "About instructors", and empty/error states) MUST be sourced from the project's central UI copy, with no inline string literals, and remain English-only / LTR.
- **FR-020**: Any rich text shown to students (wave description, instructor description) MUST be sanitized before rendering.

### Key Entities *(include if feature involves data)*

- **Student (member)**: The signed-in user. Relevant attributes here: display name (for the greeting) and the single wave they are enrolled in (scopes all weeks/materials/assignments they can see).
- **Wave**: The student's cohort/container. Relevant attributes: name (for "You are in wave [name]") and authored description. Has many weeks. (Already exists.)
- **Week**: A unit of the wave's schedule, with an order/position and label. Holds materials and assignments. Listed in the Weeks navigation. (Already exists.)
- **Material (Resource)**: A downloadable file attached to a week; shown to the student under the week's **Resources** group. (Already exists; surfaced under a new "Resources" label in the student UI.)
- **Assignment**: A task attached to a week with a downloadable file and a student submission capability; shown under the week's **Assignments** group. (Already exists.)
- **Instructor**: An admin-managed person with a photo, name, and formatted description, surfaced to students in the Home "About instructors" section. (Already exists in the admin panel; this feature makes the display information student-visible.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of student-panel surfaces that previously read "Dashboard" now read "Home" (navigation entry and page heading), verified across viewports.
- **SC-002**: A signed-in student sees the greeting "Welcome to [their own name] 👋" on first Home load, and in testing the name shown is always their own (never another student's).
- **SC-003**: The wave section reads "You are in wave [their wave's name]" for 100% of students enrolled in a named wave, and never shows another wave's name (wave-isolation denial case covered by an automated test).
- **SC-004**: On Home, 0 materials and 0 assignments are rendered; 100% of materials and assignments are reachable only by selecting a week.
- **SC-005**: Expanding **Weeks** lists exactly the number of weeks in the student's wave (no more, no fewer) in correct order, for waves with 0, 1, and many weeks.
- **SC-006**: A student can, in under 1 minute on a mobile device, expand Weeks, open a week, download a material from its Resources group, and submit an assignment from its Assignments group.
- **SC-007**: Instructors created/edited/removed in the admin panel are reflected in the student's "About instructors" section within one normal page load, and students can perform no instructor-management action in 100% of attempts.
- **SC-008**: In testing, 0 students can see any week, material, assignment, or file of a wave they are not enrolled in (file- and row-level wave-isolation denial cases covered by automated tests).
- **SC-009**: Every new/changed surface renders and is operable via keyboard and touch with no horizontal scroll, clipping, or inaccessible controls at 320, 390, 430, 768px, and desktop, meeting WCAG 2.1 AA contrast.

## Assumptions

- **Weeks, materials, and assignments already exist** (feature 008 — wave weeks, materials, assignments, submissions, and wave-scoped file storage). This feature **restructures how they are presented** to the student (out of an inline Home list into per-week Resources/Assignments drop-downs reached via a Weeks navigation entry); it does not introduce a new content model.
- **"Resources" is the student-facing label for materials.** Materials are surfaced unchanged; only the displayed group label becomes "Resources." Assignments keep the "Assignments" label.
- **Instructors are global (not wave-scoped).** The existing instructor directory has no wave association, so every student sees the same admin-managed instructor list on Home. Per-wave instructor assignment is out of scope; if desired it should be specified separately. This feature changes instructor **read** visibility to include students while keeping all instructor **management** admin-only.
- **Greeting name source**: the student's roster display name is used, falling back to their account email when unavailable. The 👋 ("waving hand") emoji is the intended "hi" emoji.
- **One wave per student** (consistent with the current model): the greeting, wave label, and weeks all reflect that single wave.
- **Week selection mechanism is a design decision**: whether selecting a week navigates to a dedicated view or reveals the week's content in place is left to planning, provided the observable behavior (Resources + Assignments drop-downs for the selected week, isolated to the student's wave) holds. The user's reference images establish the *interaction pattern* (a labelled entry with a disclosure arrow that expands a list/group), not a specific route structure.
- **Assignment submission is unchanged**: the existing browser→Storage upload and wave-scoped submission flow is reused as-is inside the new Assignments group; this feature does not alter submission semantics.
- **No change to file access security**: downloads continue to use the existing short-lived, wave-scoped signed access; surfacing materials under "Resources" does not broaden who can reach a file.
- **QR code stays on Home**: the existing member QR section remains, unchanged.
- **English-only, LTR**, brand tokens, and central UI copy conventions are followed, consistent with the constitution and existing student panel.

## Dependencies

- Existing student authentication, session, and wave-isolation enforcement (`is_admin()` / `jwt_tenant_id()` RLS helpers; the student route protection in `proxy.ts`).
- Existing wave content from feature 008: wave weeks, materials, assignments, submissions, and the private wave-scoped file storage with signed-URL downloads.
- Existing instructor directory (feature 005): instructor records, photos, and sanitized descriptions — **with a read-visibility change** so that students (not only admins) can read the instructor display information, while management stays admin-only. (This is the one data-access change the feature requires and MUST be enforced via the project's row-level security boundary, not in application code alone.)
- Existing rich-text sanitization used for wave and instructor descriptions.
- Existing student dashboard shell and its mobile navigation drawer (the surface the Weeks navigation and Home content plug into).
- Existing central UI copy and brand tokens.
