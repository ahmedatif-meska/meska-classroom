---
description: "Task list for feature 011 — Week Video Resources"
---

# Tasks: Week Video Resources

**Input**: Design documents from `specs/011-video-resources/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED (Principle II — NON-NEGOTIABLE). Every wave-scoped path includes the cross-wave access-denial test (Principle VI). Tests are written FIRST and must FAIL before implementation.

**Phase mapping to plan.md**: plan.md groups work as *Phase 1 — Foundation & admin authoring (US1)*, *Phase 2 — Student playback (US2)*, *Phase 3 — Video management (US3)*. Here that is split into Setup + Foundational (the shared prerequisites of plan Phase 1) followed by one phase per user story, per the tasks structure.

**Note on dead code**: `components/WaveWeeks.tsx` is pre-existing and imported nowhere — the live admin authoring surface is `components/WaveBuilder.tsx` (used by `app/admin/waves/new` and `app/admin/waves/[id]`). Tasks touch `WaveBuilder` only; `WaveWeeks` is left untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (maps to spec.md user stories)

---

## Phase 1: Setup (Shared copy)

**Purpose**: Add the user-facing strings used by both admin and student surfaces.

- [X] T001 [P] In `lib/strings.ts`, replace the unused placeholder keys `videoLinksLabel` / `videoLinkPlaceholder` / `videoAddLabel` / `videoRemoveLabel` with the Google-Drive video copy from `contracts/ui-contracts.md` §E (`wavesVideosLabel`, `wavesVideoTitlePlaceholder`, `wavesVideoLinkPlaceholder`, `wavesVideoLinkHelp`, `wavesVideoAddLabel`, `wavesVideoRemoveLabel`, `wavesVideoMoveUpLabel`, `wavesVideoMoveDownLabel`, `wavesVideosEmptyNote`, `wavesVideoTitleRequired`, `wavesVideoLinkInvalid`, `wavesVideoSaveFailed`, `studentVideosLabel`, `studentWeekNoVideos`, `studentVideoPlayLabel`, `studentVideoOpenInDrive`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The database table and the pure Drive-link domain helper that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create migration `supabase/migrations/0016_wave_videos.sql` defining `public.wave_videos` (`id`, `tenant_id` FK→tenants ON DELETE CASCADE, `week_id` FK→wave_weeks ON DELETE CASCADE, `title` not null, `drive_file_id` not null, `position` int not null default 1, `created_at`), indexes `wave_videos_week_idx` and `wave_videos_tenant_position_idx`, RLS enabled with `wave_videos_select` (`is_admin() or tenant_id = jwt_tenant_id()`) and `wave_videos_write` (`is_admin()` using+check). No Storage bucket. Per `data-model.md`.
- [X] T003 Apply migration `0016_wave_videos.sql` to the Supabase project (Supabase MCP `apply_migration` or dashboard SQL editor) and confirm the table + RLS exist.
- [X] T004 [P] Write FAILING unit tests in `tests/lib/waves/video.test.ts` for `parseDriveFileId` (each shape in `research.md` Decision 2 returns the same id; non-Drive host, empty string, and illegal-character id return `null`), and for `driveEmbedUrl`/`driveWatchUrl` output, per `contracts/ui-contracts.md` §B.
- [X] T005 Implement `lib/waves/video.ts` — `parseDriveFileId`, `driveEmbedUrl` (`…/file/d/<id>/preview`), `driveWatchUrl` (`…/file/d/<id>/view`), and `MAX_VIDEO_TITLE_LEN = 200` — Supabase-free, making T004 pass.

**Checkpoint**: Table + RLS live, domain helper green. User stories can begin.

---

## Phase 3 — Admin authoring (US1)

**Purpose** (plan Phase 1): An admin attaches and removes a week's Google Drive videos; saved videos appear in the admin wave builder. Acceptance criteria + test scenarios: see plan.md Phase 1.

### User Story 3.1 (US1): Admin adds a Google Drive video to a week (Priority: P1) 🎯 MVP

**Goal**: Admin pastes a Drive share link + title on a week and the video is saved (and removable), scoped to that wave + week.

**Independent Test**: As an admin, add a video to a week with a valid Drive link → it appears in the week's video list; paste a non-Drive URL → inline validation error, nothing saved; remove a video → only it disappears.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [X] T006 [P] [US1] Write FAILING Server Action tests in `tests/app/waves-video-actions.test.ts` (mock `@/lib/supabase/server` + `@/lib/auth/adminGate`): `addVideo` stores the **parsed** `drive_file_id` (not the raw URL) with `position` = week max + 1; rejects a non-Drive link with `wavesVideoLinkInvalid` and an empty/over-200-char title with `wavesVideoTitleRequired`; `removeVideo` deletes only the targeted row; a non-admin session yields `wavesForbidden` with no write (admin-gate denial).
- [X] T007 [P] [US1] Write FAILING admin component test in `tests/components/WaveBuilder.test.tsx` for the per-week Videos section: rendering a saved video with its title + "Open in Drive" link, the add form with the sharing-setting helper copy, the empty state, and an inline `role="alert"` on invalid input.

#### Implementation for User Story 3.1

- [X] T008 [US1] In `app/admin/waves/actions.ts`, add `type VideoState = { error?: string; saved?: boolean }` and the `addVideo` + `removeVideo` Server Actions: admin-gated via `adminClient()`, validate title (trimmed, ≤ `MAX_VIDEO_TITLE_LEN`) and `parseDriveFileId(formData.get("drive_link"))`, insert with `tenant_id`/`week_id`/`title`/`drive_file_id`/`position` (max+1), `logError` on failure, `revalidatePath(wavePath(waveId))` on success. Per `contracts/ui-contracts.md` §A.
- [X] T009 [P] [US1] In `lib/waves/content.ts`, add `export type AdminVideo = { id: string; title: string; driveFileId: string; position: number }`, add `videos: AdminVideo[]` to `AdminWeek`, and load `wave_videos` (`id, week_id, title, drive_file_id, position`, ordered by `position`) in `fetchWaveContent`, mapping per week.
- [X] T010 [US1] In `components/WaveBuilder.tsx`, replace the non-persisted `VideoLinksSection` placeholder with a persisted per-week **Videos** manager wired to `addVideo`/`removeVideo`: title input, Drive-link input, "Add video" button, the `wavesVideoLinkHelp` sharing copy, a list of saved videos (title + `studentVideoOpenInDrive` link + remove control), and the `wavesVideosEmptyNote` empty state — seeded from `existing.weeks[*].videos`; brand tokens only, ≥16px inputs, labelled controls, visible focus.
- [X] T011 [US1] Run `npx vitest run tests/lib/waves/video.test.ts tests/app/waves-video-actions.test.ts tests/components/WaveBuilder.test.tsx`, then `npm run build` and `npm run lint`; confirm all green/clean.

**Checkpoint**: Admin can attach/remove a week's Drive videos; MVP authoring is independently testable.

---

## Phase 4 — Student playback (US2)

**Purpose** (plan Phase 2): Enrolled students see and play a week's videos inline. Acceptance criteria + test scenarios: see plan.md Phase 2.

### User Story 4.1 (US2): Student watches a week's video inline (Priority: P1) 🎯 MVP

**Goal**: A student opens the week page, sees each video's title + a play poster ordered by `position`, and on play the Drive `/preview` iframe mounts inline.

**Independent Test**: As an enrolled student, open a week with videos → titles + play buttons render with no iframe in the DOM; press play → a `…/file/d/<id>/preview` iframe mounts; open a week with no videos → empty state, Resources/Assignments unaffected.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [X] T012 [P] [US2] Extend `tests/components/StudentWeekContent.test.tsx`: with two videos (positions 1,2) both render in order with titles + play buttons and **no `iframe`** is present pre-play; activating a play button mounts an `iframe` whose `src` ends in `/file/d/<id>/preview`; a week with no videos shows `studentWeekNoVideos` while Resources/Assignments still render.
- [X] T013 [P] [US2] Extend `tests/integration/rls.test.ts` with the **cross-wave denial** case for `wave_videos`: a Wave-B student session cannot `select` a Wave-A video row (Principle VI).

#### Implementation for User Story 4.1

- [X] T014 [P] [US2] Create `components/WeekVideoPlayer.tsx` (`'use client'`) — the smallest interactive island: renders an `aspect-video` poster with a labelled play `<button>` (`Play: <title>`); on press swaps in a Google Drive `/preview` `iframe` (`loading="lazy"`, `allow="autoplay; fullscreen"`, `allowFullScreen`, `referrerPolicy="no-referrer"`, no `allow-popups`, a `title`); always renders a `studentVideoOpenInDrive` fallback link. Takes `embedUrl`, `watchUrl`, `title`.
- [X] T015 [US2] In `components/StudentWeekContent.tsx`, replace the static `VideoPlaceholder` with a **Videos** section above Resources: query `wave_videos` filtered `tenant_id = tenantId` AND `week_id = week.id` ordered by `position`, render each via `WeekVideoPlayer` (build `embedUrl`/`watchUrl` from `lib/waves/video.ts`), and show the `studentWeekNoVideos` empty state when none. Remove the now-unused `VideoPlaceholder`.
- [X] T016 [US2] Run `npx vitest run tests/components/StudentWeekContent.test.tsx tests/integration/rls.test.ts`, then `npm run build`/`npm run lint`; confirm green/clean.

**Checkpoint**: Students play a week's videos inline; cross-wave isolation verified. With Phase 3 this is the full MVP.

---

## Phase 5 — Video management (US3)

**Purpose** (plan Phase 3): Admin edits and reorders a week's videos; student order follows. Acceptance criteria + test scenarios: see plan.md Phase 3.

### User Story 5.1 (US3): Admin edits, reorders, and removes a week's videos (Priority: P2)

**Goal**: Admin can rename/relink a video and move it up/down; the student page reflects the new order.

**Independent Test**: Add two videos, rename one, reorder them, remove one → each change shows in both admin and student views.

#### Tests for User Story 5.1 (REQUIRED — Principle II) ⚠️

- [X] T017 [P] [US3] Extend `tests/app/waves-video-actions.test.ts`: `updateVideo` re-stores the re-parsed `drive_file_id` for valid input and rejects a non-Drive link with `wavesVideoLinkInvalid` (no write); `reorderVideo` swaps `position` with the adjacent same-week video and is a no-op at the ends; both return `wavesForbidden` with no write for a non-admin session.

#### Implementation for User Story 5.1

- [X] T018 [US3] In `app/admin/waves/actions.ts`, add `updateVideo` (admin-gated; re-validate title + `parseDriveFileId`; update `title`+`drive_file_id`) and `reorderVideo` (admin-gated; `direction` ∈ up/down; swap `position` with the neighbour; no-op at ends), each `revalidatePath(wavePath(waveId))`. Per `contracts/ui-contracts.md` §A.
- [X] T019 [US3] In `components/WaveBuilder.tsx`, add per-video edit (title + link) and move-up/move-down controls wired to `updateVideo`/`reorderVideo` — touch-friendly, labelled (`wavesVideoMoveUpLabel`/`wavesVideoMoveDownLabel`), keyboard-accessible, visible focus.
- [X] T020 [US3] Run `npx vitest run tests/app/waves-video-actions.test.ts`, then `npm run build`/`npm run lint`; confirm green/clean.

**Checkpoint**: Full video management; student ordering reflects admin order.

---

## Phase 6 — Polish & Cross-Cutting Concerns

- [X] T021 Validate Quality Gates for the admin Videos form and student Videos section at **320 / 390 / 430 / 768px and desktop**: no horizontal page scroll, 16:9 player frame, ≥16px mobile inputs, visible focus, labelled controls, WCAG 2.1 AA contrast on white and `#EEF3F8` (Principle IV).
- [X] T022 Confirm the performance budget: no Drive `iframe` is in the DOM before play on a week with multiple videos (click-to-load façade), and the videos section does not block the reading content (Principle V).
- [X] T023 Confirm no Content-Security-Policy blocks `frame-src https://drive.google.com` (no custom CSP exists today; record the requirement for any future CSP), per `research.md` Decision 5.
- [X] T024 Run `npm test` (full suite) and execute `specs/011-video-resources/quickstart.md` manual verification end-to-end.
- [X] T025 Write `specs/011-video-resources/walkthrough.md` covering each implemented phase (run steps, route/component paths, numbered desktop + mobile golden-path verification, known gaps) per Principle VII.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories** (table + `video.ts`).
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on Phase 2 (uses `video.ts` + the table). Independent of US1 but naturally demoed after it.
- **US3 (Phase 5)**: depends on Phase 2 and on US1's `addVideo`/Videos-section scaffolding in `WaveBuilder`.
- **Polish (Phase 6)**: depends on all desired stories.

### Within Each User Story

- Tests written and FAILING before implementation (Principle II).
- Domain/model before actions; actions before UI; UI before verification.

### Parallel Opportunities

- T001 (Setup) and T004 (foundational tests) are independent.
- Within US1: T006 and T007 (tests) run in parallel; T009 (`content.ts`) is `[P]` vs T008 (`actions.ts`) — different files.
- Within US2: T012, T013, T014 are different files — parallel; T015 depends on T014.

---

## Parallel Example: User Story 1 (US1)

```bash
# Tests first (different files):
Task: "T006 action tests in tests/app/waves-video-actions.test.ts"
Task: "T007 admin component test in tests/components/WaveBuilder.test.tsx"

# Then implementation across different files:
Task: "T008 addVideo/removeVideo in app/admin/waves/actions.ts"
Task: "T009 AdminVideo + fetchWaveContent in lib/waves/content.ts"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational (table + `video.ts`).
2. Phase 3 (US1): admin authoring → validate independently.
3. Phase 4 (US2): student playback + cross-wave denial → validate independently.
4. **STOP and VALIDATE**: an admin can attach a Drive video and an enrolled student plays it inline; a non-enrolled student sees nothing. Deploy/demo.

### Incremental Delivery

5. Phase 5 (US3): edit/reorder → validate.
6. Phase 6: polish, responsive/a11y, perf, quickstart, walkthrough.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Videos store a Google Drive **file id** (text) — there is no Storage upload, so none of the browser→Storage / 4.5 MB body-cap machinery applies here.
- The `iframe src` is always built from the stored id (`…/file/d/<id>/preview`) — never the raw admin input.
- The "video unavailable" state is best-effort (cross-origin iframe can't report load failure); guarantee a stable `aspect-video` frame + the "Open in Google Drive" fallback (FR-011, `research.md` Decision 3).
- Commit after each task or logical group.
