# Implementation Plan: Week Video Resources

**Branch**: `011-video-resources` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-video-resources/spec.md`

## Summary

Admins attach Google-Drive-hosted videos to a wave's week by pasting a share link;
enrolled students play them inline on the week page. Videos are a new wave-scoped
content type (`wave_videos`) modeled exactly on `wave_materials` (feature 008) —
**except the payload is a Google Drive file id in a text column, not uploaded file
bytes**, so there is no Storage bucket and no browser→Storage upload. A pure
validator extracts and stores the Drive file id; the student page renders a
click-to-load Drive `/preview` `iframe` façade so heavy third-party frames never load
until the student presses play. Wave isolation is enforced by the same flat
`tenant_id = jwt_tenant_id()` RLS as the rest of the wave content, with a cross-wave
denial test. No new dependencies.

## Technical Context

**Language/Version**: TypeScript (strict), React 19 (React Compiler on), Next.js 16 App Router — per `CLAUDE.md`.

**Primary Dependencies**: Existing only — Supabase (Postgres + Auth + RLS), Tailwind v4, Vitest + React Testing Library. **No new dependency.**

**Storage**: Postgres table `public.wave_videos` (new). **No Storage bucket** — videos are external Google Drive links, not uploaded bytes.

**Testing**: Vitest (jsdom) — pure-lib unit tests, component tests, Server Action tests (mocked Supabase + gates), and an extension to the RLS integration test for the cross-wave denial case.

**Target Platform**: Responsive web, mobile-first (320px → desktop); latest two versions of Chrome/Edge/Firefox/Safari + iOS Safari + Android Chrome.

**Project Type**: Web application (Next.js App Router; Student + Admin panels).

**Performance Goals**: No CWV regression vs baseline **LCP < 2.5s / CLS < 0.1 / INP < 200ms** on mid-tier Android over Slow-4G. Per-feature budget: the videos section adds **zero eager third-party iframes** on week open — Drive frames mount only on play (click-to-load façade); the poster is lightweight server-rendered markup.

**Constraints**: Wave isolation NON-NEGOTIABLE (server-side `tenant_id` filter + RLS + cross-wave test). No file in any Server Action body (trivially met — no file at all). Brand tokens only; English/LTR; WCAG 2.1 AA. `iframe` embeds `https://drive.google.com/file/d/<id>/preview` ONLY (built from the stored id, never raw input).

**Scale/Scope**: One new migration, one pure lib module, ~4 Server Actions, one admin per-week section (replacing a placeholder), one student section (replacing a placeholder), copy + tests. Small/medium.

## Constitution Check

*GATE: must pass before Phase 0 and re-checked after design. Constitution v2.2.0.*

- **I. Code Quality** — TS strict; pure validator extracted to `lib/waves/video.ts`; reuses 008 patterns; no manual memoization; handles long/admin-supplied titles (bounded, truncated in UI). **PASS**
- **II. Testing (NON-NEGOTIABLE)** — ships unit tests (`parseDriveFileId`/embed URLs), component tests (student render + empty state), action tests (gate + validation), and the cross-wave denial test for `wave_videos`. **PASS**
- **III. UX Consistency** — brand tokens only; loading (façade)/empty/unavailable/error states defined; logo/nav untouched. **PASS**
- **IV. Mobile-First & Accessible** — `aspect-video` fluid frame, no horizontal scroll, touch-friendly labelled play `<button>` with visible focus, ≥16px mobile inputs, AA contrast; validated 320/390/430/768/desktop. **PASS**
- **V. Performance** — RSC-first; the only client island is the play toggle; Drive iframes lazy + click-to-load (no eager third-party frames); reads bounded per week; **no file routed through a Server Action body** (none exists). **PASS**
- **VI. Wave Isolation (NON-NEGOTIABLE)** — `wave_videos.tenant_id` denormalized; RLS `select` = `is_admin() or tenant_id = jwt_tenant_id()`, writes `is_admin()` only; student query filters `tenant_id`+`week_id`; admin actions gated by `assertAdminSession`; cross-wave denial tested. **PASS**
- **VII. Artifact Structure (NON-NEGOTIABLE)** — phases below are `Phase → User Story → Acceptance Criteria → Test Scenarios`; each implemented phase ships a `walkthrough.md` section. **PASS**

**No violations → Complexity Tracking is empty.** A new table is a routine extension of the existing 008 data model (not a new architectural layer); no new dependency, API route, state library, or component library is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/011-video-resources/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0 — 5 decisions (Drive-id storage, façade, RLS reuse, CSP)
├── data-model.md        # Phase 1 — wave_videos table + RLS + validation
├── quickstart.md        # Phase 1 — run + manual verification
├── contracts/
│   └── ui-contracts.md  # Phase 1 — Server Actions + admin/student UI + copy
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit-specify)
├── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md       # per-phase output (/speckit-implement)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0016_wave_videos.sql                 # NEW — table + RLS (no bucket)

lib/waves/
├── video.ts                             # NEW — parseDriveFileId, driveEmbedUrl, driveWatchUrl, MAX_VIDEO_TITLE_LEN
└── content.ts                           # EDIT — add AdminVideo type + videos to fetchWaveContent

lib/strings.ts                           # EDIT — replace placeholder video keys with Drive video copy

app/admin/waves/
└── actions.ts                           # EDIT — addVideo / updateVideo / reorderVideo / removeVideo

components/
├── WaveBuilder.tsx                       # EDIT — replace VideoLinksSection placeholder with persisted per-week Videos
├── WaveWeeks.tsx                         # EDIT — per-week Videos manager (parity with the materials section)
├── StudentWeekContent.tsx               # EDIT — replace VideoPlaceholder with a real per-week Videos section
└── WeekVideoPlayer.tsx                  # NEW — 'use client' click-to-load Drive iframe façade (smallest island)

tests/
├── lib/waves/video.test.ts              # NEW — parseDriveFileId shapes + reject non-Drive; embed URLs
├── app/waves-video-actions.test.ts      # NEW — addVideo/updateVideo/reorderVideo/removeVideo gate + validation
├── components/StudentWeekContent.test.tsx  # EDIT — video render, ordering, empty state, click-to-load
├── components/WaveWeeks.test.tsx (or WaveBuilder.test.tsx)  # EDIT/NEW — admin Videos section add/remove/validation
└── integration/rls.test.ts              # EDIT — wave_videos cross-wave denial case
```

**Structure Decision**: Extends the existing feature-008 wave-content structure in
place — same `app/admin/waves/actions.ts`, same `lib/waves/`, same student
`StudentWeekContent`. The only new files are the migration, the pure `video.ts`
helper, and the small `WeekVideoPlayer` client island. No new route, panel, or
top-level structure.

## Implementation Phases

### Phase 1 — Foundation & admin authoring

#### User Story 1.1 (US1): As an admin I want to attach a Google Drive video to a week so that my students have something to watch

- Description: Create `wave_videos` (table + RLS), the pure `parseDriveFileId`/embed
  helpers, the `addVideo` + `removeVideo` Server Actions, and the per-week **Videos**
  manager in the admin wave builder (title + Drive link → add; list with remove),
  replacing the non-persisted `VideoLinksSection`/`VideoPlaceholder` placeholder copy.
  Extend `fetchWaveContent` so the admin view lists each week's saved videos.

#### Acceptance Criteria (for the phase)

- [ ] Migration `0016_wave_videos.sql` creates `public.wave_videos` with `tenant_id`,
      `week_id`, `title`, `drive_file_id`, `position`, `created_at`, the two indexes,
      and RLS (`select` = admin-or-own-wave; writes admin-only). No bucket is created.
- [ ] `parseDriveFileId` returns the correct id for `/file/d/<id>/view`,
      `/file/d/<id>/preview`, `open?id=<id>`, `uc?id=<id>`, and a bare id; returns
      `null` for empty, non-Drive hosts, and illegal-character input.
- [ ] `addVideo` is admin-gated, stores the **parsed file id** (not the raw URL),
      assigns `position` = week max + 1, and rejects an invalid link or empty/over-long
      title with the documented error — never partially writes.
- [ ] `removeVideo` is admin-gated and deletes only the targeted row.
- [ ] A non-admin caller invoking any video action receives the generic forbidden
      message and causes no write.
- [ ] The admin per-week Videos section shows added videos, an "Open in Drive" link,
      the sharing-setting helper copy, and an empty state; brand tokens only; AA + ≥16px
      inputs on mobile.
- [ ] `npm run build` and `npm run lint` pass clean.

#### Test Scenarios (for the phase)

1. **Given** the migration is applied, **When** the schema is inspected, **Then**
   `wave_videos` exists with RLS enabled and the documented columns/indexes.
2. **Given** a valid Drive share link in each supported shape, **When**
   `parseDriveFileId` runs, **Then** it returns the same id; **And** for
   `https://example.com/x`, an empty string, and an id with a space, it returns `null`.
3. **Given** an authenticated admin, **When** `addVideo` runs with a valid link and
   title, **Then** a row is inserted with the parsed id and the next `position`.
4. **Given** an authenticated admin, **When** `addVideo` runs with a non-Drive link,
   **Then** it returns `wavesVideoLinkInvalid` and inserts nothing.
5. **Given** a non-admin session, **When** `addVideo` or `removeVideo` runs, **Then**
   it returns `wavesForbidden` and performs no write (admin-gate denial).
6. **Given** a week with two videos, **When** the admin removes one, **Then** only
   that row is gone and the other remains.

---

### Phase 2 — Student playback

#### User Story 2.1 (US2): As a student I want to play a week's video inline so that I can learn without leaving the app

- Description: Replace the static `VideoPlaceholder` in `StudentWeekContent` with a
  real **Videos** section that loads the week's `wave_videos` (RLS + explicit
  `tenant_id`/`week_id` filter), renders each as a poster + labelled play button
  ordered by `position`, and on play mounts the Drive `/preview` `iframe` via the new
  `WeekVideoPlayer` client island. Define the empty and best-effort "unavailable"
  states and the always-present "Open in Google Drive" fallback.

#### Acceptance Criteria (for the phase)

- [ ] A student enrolled in the wave sees every video for the week, by `position`
      ascending, each with its title and a play control, above Resources.
- [ ] Pressing play mounts a Google Drive `/preview` `iframe`
      (`loading="lazy"`, `allow="autoplay; fullscreen"`, `allowFullScreen`,
      `referrerPolicy="no-referrer"`, no `allow-popups`); no Drive iframe is present in
      the DOM before play (click-to-load façade — performance budget).
- [ ] The `iframe src` is always `…/file/d/<stored id>/preview` built from the stored
      file id — the raw admin input is never used as `src`.
- [ ] A week with no videos shows the empty state and leaves Resources/Assignments
      unchanged.
- [ ] The video frame is always a stable `aspect-video` container with an
      always-present "Open in Google Drive" link (best-effort unavailable state).
- [ ] A student not enrolled in the wave cannot see the wave's videos: the week page
      404s and RLS independently denies the rows (cross-wave denial).
- [ ] Player is keyboard-accessible with visible focus and an accessible play label;
      no horizontal page scroll at 320px; AA contrast; `npm run build`/`lint` clean.

#### Test Scenarios (for the phase)

1. **Given** a week with two videos in positions 1 and 2, **When** an enrolled student
   opens the week, **Then** both render in order with titles and play buttons, and no
   `iframe` is in the DOM yet.
2. **Given** a rendered video, **When** the student activates its play button, **Then**
   an `iframe` whose `src` ends in `/file/d/<id>/preview` is mounted.
3. **Given** a week with no videos, **When** an enrolled student opens it, **Then** the
   Videos empty state shows and the Resources/Assignments sections still render.
4. **Given** a student whose wave is B, **When** they open a Wave A week id, **Then**
   the page 404s and no Wave A video is returned (RLS cross-wave denial —
   `tests/integration/rls.test.ts`).

---

### Phase 3 — Video management (edit, reorder)

#### User Story 3.1 (US3): As an admin I want to edit, reorder, and remove a week's videos so that the content stays correct over time

- Description: Add `updateVideo` (re-validate title + link, re-store id) and
  `reorderVideo` (swap `position` with the adjacent video) Server Actions, and the
  corresponding edit + move-up/move-down controls in the admin Videos section. Student
  order continues to follow `position`.

#### Acceptance Criteria (for the phase)

- [ ] `updateVideo` is admin-gated, re-validates, and re-stores the re-parsed file id;
      invalid input is rejected with no write.
- [ ] `reorderVideo` swaps `position` with the adjacent same-week video and is a no-op
      at the ends; it is admin-gated.
- [ ] After a reorder, the student week page reflects the new order on next view.
- [ ] Edit/reorder/remove controls are touch-friendly, labelled, keyboard-accessible,
      AA contrast; `npm run build`/`lint` clean.

#### Test Scenarios (for the phase)

1. **Given** a saved video, **When** the admin edits its title and link to valid
   values, **Then** the row stores the new title and re-parsed id.
2. **Given** a saved video, **When** `updateVideo` runs with a non-Drive link, **Then**
   it returns `wavesVideoLinkInvalid` and the row is unchanged.
3. **Given** two videos at positions 1 and 2, **When** the admin moves the second up,
   **Then** their positions swap and the student page shows the new order.
4. **Given** a non-admin session, **When** `updateVideo` or `reorderVideo` runs,
   **Then** it returns `wavesForbidden` and performs no write.

## Complexity Tracking

> No constitution violations — table intentionally empty.
