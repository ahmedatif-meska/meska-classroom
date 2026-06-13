# Feature Specification: Admin Analytics Dashboard

**Feature Branch**: `013-admin-analytics-dashboard`

**Created**: 2026-06-13

**Status**: Draft

**Input**: User description: "based on all the tables we created we want to create an beautiful interactive dashboard in the admin panel include as much info as we have examples: no of online and offline waves, no of members in each wave, attendance rate per wave and more for all what's relevant — use charts, numbers, icons, whatever you see best. I want it very catchy to the eye in the dashboard admin panel"

## User Scenarios & Testing *(mandatory)*

The admin dashboard (`/admin/dashboard`) is currently a near-empty landing page. This feature turns it into a live, visually engaging analytics home that surfaces — at a glance — the health of the whole platform: how many waves exist and of which kind, how many members each wave holds, how engaged those members are (attendance, submissions, feedback, points), and how much content has been built. Every number is read live from the existing data; no new data is collected from users.

### User Story 1 - At-a-glance program overview (Priority: P1)

As an administrator opening the dashboard, I see a row of prominent summary cards that immediately tell me the size and shape of the whole program: total waves (split into online vs offline), total members, total instructors, the overall attendance rate, and total points awarded across the program. Each card pairs a large number with a clear label and an icon so I can grasp the state of the platform in seconds without scrolling or clicking.

**Why this priority**: This is the core of the request ("very catchy to the eye", "no of online and offline waves") and delivers standalone value — even with nothing else, the admin gets an instant program snapshot the moment the dashboard loads. It is the minimum viable dashboard.

**Independent Test**: Sign in as an admin and open the dashboard with seeded data; confirm the summary cards display correct totals (waves, online/offline split, members, instructors, overall attendance rate, total points) that match the underlying records, and that the cards render legibly from 320px wide up to desktop.

**Acceptance Scenarios**:

1. **Given** a platform with 5 waves (3 online, 2 offline) and 120 members, **When** an admin opens the dashboard, **Then** the overview cards show "5 Waves", an online/offline split of 3 and 2, and "120 Members".
2. **Given** a freshly seeded platform with no waves and no members, **When** an admin opens the dashboard, **Then** every overview card shows a zero value with its label (never a blank, error, or "NaN").
3. **Given** an admin on a 320px-wide phone, **When** the dashboard loads, **Then** the summary cards stack vertically, remain fully readable, and no content is clipped or requires horizontal scrolling.

---

### User Story 2 - Per-wave breakdown (Priority: P2)

As an administrator, I see a breakdown of each individual wave showing its name, its type (online/offline) and lifecycle status (not started / in progress / completed) as colored tags, its member count, its attendance rate, its assignment-submission rate, and its average feedback rating. This lets me compare waves side by side and spot which cohorts are thriving and which need attention.

**Why this priority**: Directly requested ("no of members in each wave", "attendance rate per wave"). It builds on the overview by letting the admin drill from program-wide totals into the per-cohort detail that drives day-to-day decisions.

**Independent Test**: With several waves of differing sizes and engagement seeded, confirm each wave appears once with the correct member count, attendance rate, submission rate, average rating, and correctly colored type/status tags; confirm waves with no members or no activity show 0 (or "—") rather than errors.

**Acceptance Scenarios**:

1. **Given** a wave with 20 members where 15 have been marked present at least once, **When** the admin views the per-wave breakdown, **Then** that wave's row shows "20 members" and an attendance rate consistent with the defined attendance-rate formula.
2. **Given** a wave with status "in progress" and type "online", **When** it is displayed, **Then** it carries the same colored status and type tags used elsewhere in the admin Waves list (visual consistency).
3. **Given** a newly created wave with zero members and no attendance, submissions, or feedback, **When** it is displayed, **Then** its engagement metrics read 0 / "—" and the row still renders cleanly.
4. **Given** the per-wave breakdown on a narrow phone screen, **When** it is displayed, **Then** it remains usable (e.g. horizontally scrollable or reflowed) without clipping data.

---

### User Story 3 - Visual charts (Priority: P3)

As an administrator, I see charts that make the distributions easy to read at a glance: the online/offline wave split, waves by lifecycle status, members per wave, and a points leaderboard (top members by total points). Charts use the brand palette and each has an accessible text equivalent so the information is available to assistive technology and when a chart cannot render.

**Why this priority**: The user explicitly asked for charts and visual appeal ("use charts, numbers, icons", "very catchy to the eye"). It enhances comprehension of the same data exposed in US1/US2 but is not required for the dashboard to be useful, so it follows them.

**Independent Test**: With representative data seeded, confirm each chart renders with values matching the underlying counts, uses brand colors, exposes an accessible text alternative (e.g. an adjacent data summary or accessible labels), and degrades to a readable fallback when there is no data.

**Acceptance Scenarios**:

1. **Given** 3 online and 2 offline waves, **When** the wave-type chart renders, **Then** it visually represents a 3:2 split and its accessible text states the same figures.
2. **Given** members distributed unevenly across waves, **When** the members-per-wave chart renders, **Then** each wave's bar (or segment) is proportional to its member count and labeled with the wave name.
3. **Given** no data for a chart's metric, **When** the dashboard loads, **Then** the chart area shows a clear empty state instead of a broken or blank graphic.

---

### User Story 4 - Engagement & content insights (Priority: P4)

As an administrator, I see secondary insight panels covering engagement and the volume of content built: total assignment submissions and overall submission rate, average session and instructor feedback ratings, total feedback responses, and content totals (weeks, learning materials, videos, assignments). This rounds out the picture of how much has been created and how learners are responding.

**Why this priority**: Fulfills "include as much info as we have" and "all what's relevant". It is the richest but least essential layer — valuable context once the headline numbers, per-wave detail, and charts are in place.

**Independent Test**: With submissions, feedback, and content seeded, confirm the insight panels show correct totals and averages (e.g. average ratings rounded sensibly, submission rate consistent with its defined formula) and show neutral empty states when a metric has no underlying data.

**Acceptance Scenarios**:

1. **Given** feedback rows with session ratings averaging 4.2, **When** the feedback panel renders, **Then** it shows an average session rating of approximately 4.2 out of 5 and the count of responses it is based on.
2. **Given** 4 weeks, 12 materials, 6 videos, and 8 assignments across all waves, **When** the content panel renders, **Then** it shows those four totals with clear labels and icons.
3. **Given** no submissions or feedback yet, **When** the panels render, **Then** they show "0" / "No responses yet" rather than misleading averages or errors.

---

### Edge Cases

- **No data at all** (fresh platform): every metric shows a zero or neutral empty state; the page never errors or shows blank cards.
- **Division-by-zero guards**: rates (attendance, submission) for a wave with zero members, or averages with zero responses, must resolve to 0 or "—", never "NaN"/"Infinity".
- **Pending vs active members**: the spec must state whether member counts include not-yet-onboarded ("pending") members (see Assumptions).
- **Wave with no weeks/sessions**: attendance rate has no denominator; show "—" rather than a misleading 0% or an error.
- **Very large numbers of waves/members**: the layout (cards, table, charts) must remain readable and performant; long lists must not break the layout.
- **Long wave names**: must truncate or wrap gracefully in cards, tables, and chart labels without breaking layout.
- **Non-admin reaching the page**: blocked by existing admin route protection; the dashboard exposes only admin-visible, program-wide data (no wave-isolation concern for the admin viewer).
- **Stale vs live data**: figures reflect the moment the dashboard was loaded; the admin can refresh to recompute.

## Requirements *(mandatory)*

### Functional Requirements

**Overview (US1)**

- **FR-001**: The admin dashboard MUST display a program-overview section of summary cards, each pairing a large primary number, a descriptive label, and an icon.
- **FR-002**: The overview MUST show the total number of waves and a breakdown of that total into online waves and offline waves.
- **FR-003**: The overview MUST show the total number of members (across all waves) and the total number of instructors.
- **FR-004**: The overview MUST show an overall attendance rate for the program and the total points awarded across all members.
- **FR-005**: Every overview metric MUST display a zero (or equivalent neutral value) when there is no underlying data, never a blank, error, or "NaN".

**Per-wave breakdown (US2)**

- **FR-006**: The dashboard MUST list every wave with its name, its type (online/offline), and its lifecycle status (not started / in progress / completed).
- **FR-007**: Wave type and status MUST be shown using the same colored-tag visual language used in the existing admin Waves list (brand consistency).
- **FR-008**: For each wave the dashboard MUST show its member count, its attendance rate, its assignment-submission rate, and its average feedback rating.
- **FR-009**: For any per-wave metric without underlying data (no members, no attendance, no submissions, no feedback), the dashboard MUST show 0 or "—" and still render the row cleanly.

**Charts (US3)**

- **FR-010**: The dashboard MUST present at least the following charts: online vs offline wave split, waves by lifecycle status, members per wave, and a top-members-by-points leaderboard.
- **FR-011**: Charts MUST use the brand palette (brand blue accent on the light surface) and avoid colors outside the defined brand tokens.
- **FR-012**: Each chart MUST provide an accessible text equivalent of its data (e.g. accessible labels or an adjacent data summary) so the information is available without relying on color or visual shape alone.
- **FR-013**: Each chart MUST show a clear empty state when its metric has no data, rather than a broken or blank graphic.

**Engagement & content insights (US4)**

- **FR-014**: The dashboard MUST show total assignment submissions and an overall submission rate.
- **FR-015**: The dashboard MUST show the average session feedback rating, the average instructor feedback rating, and the total number of feedback responses, each rating presented on its 1–5 scale.
- **FR-016**: The dashboard MUST show content-volume totals: number of weeks, learning materials, videos, and assignments across the program.

**Cross-cutting**

- **FR-017**: All displayed figures MUST be derived live from the current data each time the dashboard is loaded; the admin MUST be able to obtain up-to-date figures by reloading.
- **FR-018**: The dashboard MUST be accessible only to authenticated administrators (consistent with existing admin route protection) and MUST expose program-wide data across all waves to that admin.
- **FR-019**: The dashboard MUST define and use a single, documented formula for "attendance rate" and "submission rate" consistently in both the overview and per-wave sections (see Assumptions).
- **FR-020**: The dashboard MUST define a loading state, an empty state (for a platform with no data), and an error state, consistent with the project's defined-states requirement.
- **FR-021**: The dashboard MUST be fully responsive and accessible from 320px through desktop: cards stack, tables scroll or reflow, charts resize, all text meets contrast requirements, and interactive elements are keyboard-accessible with visible focus.
- **FR-022**: All user-facing text on the dashboard MUST come from the project's centralized copy source (no inline string literals), in English, left-to-right.
- **FR-023**: The dashboard MUST NOT introduce any new data collection from users; it only reads and aggregates existing records.

### Key Entities *(include if feature involves data)*

All entities already exist; the dashboard only reads and aggregates them.

- **Wave (tenant)**: a cohort. Provides name, type (online/offline), and lifecycle status. The unit most metrics are grouped by.
- **Member (student)**: a learner belonging to one wave. Provides per-wave and total member counts and onboarding status (pending/active).
- **Instructor**: a directory entry. Provides the instructor total.
- **Attendance record**: one member present on one calendar day. Drives attendance counts and rates.
- **Assignment & submission**: an assignment belongs to a wave's week; a submission is one member's response. Drives submission counts and rates.
- **Feedback response**: a member's per-week session rating, instructor rating, and optional comment. Drives average ratings and response counts.
- **Point rule**: the platform-wide point value for each rewarded action (attendance, assignment, feedback). Combined with per-member counts to derive points totals and the leaderboard.
- **Content items (weeks, materials, videos, assignments)**: drive the content-volume totals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can determine the total number of waves, the online/offline split, and total members within 5 seconds of the dashboard loading, without scrolling on a desktop screen or clicking anything.
- **SC-002**: 100% of the metrics shown match the underlying records for any given data set (verified against seeded fixtures).
- **SC-003**: The dashboard renders correctly with no clipped content or horizontal overflow at 320px, 390px, 430px, 768px, and desktop widths.
- **SC-004**: With an empty platform (no waves, members, or activity), the dashboard loads successfully and shows neutral zero/empty states for every metric, with zero errors.
- **SC-005**: Every chart's information is available as an accessible text equivalent, so a screen-reader user can obtain the same figures a sighted user sees.
- **SC-006**: All rate and average metrics resolve to a valid value (a number or "—") for every data set, with no occurrence of "NaN", "Infinity", or a blank where a number is expected.
- **SC-007**: The dashboard introduces no measurable Core Web Vitals regression on mobile relative to the current dashboard page.

## Assumptions

- **Attendance rate definition**: Lacking an explicit per-session schedule, "attendance rate" for a wave is defined as the share of that wave's members who have been marked present at least once (members with ≥1 attendance record ÷ total members in the wave). The overall attendance rate applies the same definition program-wide. A wave with zero members shows "—". This is a documented default; it can be refined during planning/clarification if a session-count denominator is preferred.
- **Submission rate definition**: For a wave, "submission rate" is the share of expected submissions received, defined as (distinct member-submissions received ÷ (number of members × number of assignments in the wave)). A wave with no members or no assignments shows "—".
- **Member counts include all roster members** (both active and pending/not-yet-onboarded). If only active members are desired, this can be adjusted; pending vs active is noted as an edge case.
- **Points totals are derived** from each member's counted rewarded actions (attendance days, accepted submissions, feedback responses) multiplied by the current point-rule values — consistent with how points are computed elsewhere in the app — and recomputed on read so they reflect the latest rule values.
- **The dashboard reads live data on each load** (server-rendered), with reload as the refresh mechanism; no auto-refresh, real-time streaming, or historical time-series storage is in scope for this feature.
- **Scope is read-only analytics**: no export/download, no date-range filtering, no drill-down navigation beyond what the existing admin pages already provide, and no configurable widgets in this feature (these are possible future enhancements).
- **The dashboard reuses the existing admin shell** (sidebar layout) and brand tokens; charts use a lightweight rendering approach consistent with the project's no-heavy-dependency posture, decided at planning time.
- **The audience is administrators only**; the page is reached through the existing protected admin route and shows program-wide data, so wave-isolation does not restrict the admin viewer.
