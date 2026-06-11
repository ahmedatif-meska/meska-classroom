# Feature Specification: Week Video Resources

**Feature Branch**: `011-video-resources`

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "in the admin panel i want to add feature to allow admin upload videos then it will be previewed in the student week page. the upload will be like the following: i will upload the video on google drive then will share link within the app with full access then it will be previewed to the student and student can play the video there"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin adds a video to a week (Priority: P1)

An admin uploads a video to Google Drive, sets the file's sharing so that anyone with the link can view it, copies that share link, and pastes it into the wave-management area for a specific week along with a title. The video is then saved as a resource attached to that week for that wave.

**Why this priority**: Without the ability to attach a video to a week, there is nothing for students to watch. This is the foundational slice that makes every other part of the feature possible.

**Independent Test**: Can be fully tested by signing in as an admin, opening a wave's week, pasting a valid Google Drive share link with a title, saving, and confirming the video now appears in that week's video list in the admin view — delivering the core "video is attached" value on its own.

**Acceptance Scenarios**:

1. **Given** an admin viewing a specific week of a wave, **When** they submit a valid Google Drive share link with a title, **Then** the video is saved to that week and appears in the week's video list.
2. **Given** an admin submitting a link that is not a recognizable Google Drive share link, **When** they try to save, **Then** the system rejects it with a clear message and does not save anything.
3. **Given** an admin submitting an empty title or empty link, **When** they try to save, **Then** the system rejects the submission with a validation message.

---

### User Story 2 - Student watches a week's video (Priority: P1)

A student opens their week page and sees the videos the admin attached to that week. Each video shows its title and an inline player. The student presses play and watches the video without leaving the app and without needing a separate Google account or download.

**Why this priority**: Delivering the video to the student is the entire point of the feature; an attached-but-unwatchable video has no value. Together with Story 1 this forms the MVP.

**Independent Test**: Can be tested by signing in as a student enrolled in a wave that has a week with a video, opening that week, and confirming the video title and an inline player are shown and the video plays in place.

**Acceptance Scenarios**:

1. **Given** a week that has one or more videos and a student enrolled in that wave, **When** the student opens the week page, **Then** each video's title and an inline player are displayed.
2. **Given** a displayed video, **When** the student presses play, **Then** the video plays inline on the page.
3. **Given** a week that has no videos, **When** the student opens the week page, **Then** the video area shows a clear empty state and the rest of the page (resources, assignments) is unaffected.
4. **Given** a student who is not enrolled in a wave, **When** they attempt to view that wave's week videos, **Then** they are denied access and see no videos from that wave.

---

### User Story 3 - Admin manages existing videos (Priority: P2)

An admin can see all videos attached to a week, edit a video's title or link, reorder them, and remove a video that is no longer relevant. Changes are reflected for students on their next view of the week.

**Why this priority**: Content changes over time — links break, titles get corrected, videos get retired. Management makes the feature maintainable, but the feature still delivers value without it, so it is P2.

**Independent Test**: Can be tested by attaching two videos to a week, then renaming one, reordering them, and deleting one, and confirming each change is reflected in both the admin and student views.

**Acceptance Scenarios**:

1. **Given** a week with an existing video, **When** the admin edits its title or link to valid values and saves, **Then** the updated values are shown.
2. **Given** a week with multiple videos, **When** the admin reorders them, **Then** students see them in the new order.
3. **Given** a week with an existing video, **When** the admin removes it, **Then** it no longer appears in the admin or student view for that week.

---

### Edge Cases

- **Broken or revoked link**: A previously valid Google Drive link is later deleted or its sharing is restricted. The student sees the video entry with a graceful "video unavailable" state rather than a broken or blank player, and the rest of the page still works.
- **Link without public access**: An admin pastes a Google Drive link that is restricted to specific accounts (not "anyone with the link"). The app cannot validate the access level on the admin's behalf; it accepts a well-formed Drive link but the admin is warned that the file must be shared as "anyone with the link can view" for students to watch it.
- **Non-video Drive file**: An admin pastes a Drive link pointing to a non-video file (e.g., a document). The student player area shows whatever Google Drive renders; the admin guidance states the link must point to a video file.
- **Very long title**: A title beyond the allowed length is rejected with a clear message at the boundary.
- **Many videos in one week**: A week with a large number of videos remains usable and performant on mobile (lazy-loaded players).
- **Wave isolation**: A video attached to Wave A's week is never visible to a student enrolled only in Wave B, even if they guess the week's address.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an admin to attach a video to a specific week of a specific wave by providing a Google Drive share link and a title.
- **FR-002**: The system MUST validate that the provided link is a recognizable Google Drive share link before saving, and reject submissions that are not.
- **FR-003**: The system MUST require a non-empty title within an allowed length and a non-empty link for each video.
- **FR-004**: The system MUST store each video as a resource scoped to its week and its wave, so that videos are isolated per wave.
- **FR-005**: The system MUST display, on the student week page, every video attached to that week with its title and an inline player.
- **FR-006**: Students MUST be able to play a week's video inline within the app without leaving the page, without signing into a third-party account, and without downloading a file.
- **FR-007**: The system MUST only show a wave's week videos to students enrolled in that wave, enforced on the server, and MUST deny access to non-enrolled users.
- **FR-008**: The system MUST allow an admin to edit a video's title and link, reorder a week's videos, and remove a video.
- **FR-009**: The student-visible order of a week's videos MUST follow the order the admin sets.
- **FR-010**: The system MUST present a clear empty state when a week has no videos, without disrupting the week's other sections (resources, assignments).
- **FR-011**: The system MUST present a graceful "video unavailable" state when a video cannot be played (e.g., the link was removed or its access was revoked), without breaking the rest of the page.
- **FR-012**: The system MUST guide the admin that the Google Drive file must be shared as "anyone with the link can view" and point to a video file, since the app cannot grant that access on the admin's behalf.
- **FR-013**: Only admins MUST be able to add, edit, reorder, or remove week videos; students MUST have view-and-play access only.

### Key Entities *(include if feature involves data)*

- **Week Video**: A video resource attached to a single week of a single wave. Key attributes: title, Google Drive share link (or the file identifier derived from it), display order within the week, the week it belongs to, and the wave (tenant) it is scoped to. Related to the existing Week entity (one week has many videos) and inherits the wave-isolation scope used by other week content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add a video to a week and have it appear to enrolled students in under 1 minute from pasting the link.
- **SC-002**: 95% of valid Google Drive share links pasted by an admin are accepted and play for students on the first attempt.
- **SC-003**: Students can start playing a week's video in 2 taps or fewer from opening the week page (open the week, press play).
- **SC-004**: A student enrolled only in one wave can never see another wave's week videos (0 cross-wave leaks), verified by test.
- **SC-005**: Week pages with videos show no broken/blank player to the student — every video resolves to either a working player or a clear "unavailable" state — across mobile widths from 320px to desktop.

## Assumptions

- **Hosting via Google Drive only (v1)**: Videos are not uploaded as file bytes into the app's own storage. The admin hosts the video on Google Drive and shares a link; the app embeds/links to that hosted video. Direct in-app video file upload is out of scope for this version.
- **Public link sharing is the admin's responsibility**: For a student to watch, the Drive file must be shared as "anyone with the link can view." The app cannot set or verify Google Drive's access level on the admin's behalf; it validates link shape and warns the admin about the required sharing setting.
- **Videos are a distinct section of the week**: Videos appear as their own area on the student week page alongside the existing Resources and Assignments sections, rather than being folded into the existing file-resource list.
- **Per-week, per-wave scope**: Videos reuse the established wave-content model — each video belongs to exactly one week of one wave and is subject to the same wave-isolation rules as other week content.
- **Multiple videos per week**: A week may have zero, one, or many videos; ordering is admin-controlled.
- **Admin-managed in the existing wave-management surface**: Admins add and manage week videos from the same admin area where they manage the week's other content, reusing existing admin authorization.
- **Inline playback uses Google Drive's player**: "Play the video there" means an embedded player on the page; the app does not re-encode, transcode, or host the media itself.
