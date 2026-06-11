# Walkthrough: Week Video Resources (011)

This feature lets an admin attach Google-Drive-hosted videos to a wave's week and
have enrolled students play them inline on the week page. Videos store only a Google
Drive **file id** (text) — there is no Storage upload.

## How to run

```bash
npm run dev            # http://localhost:3000
# Admin:   /admin → sign in → Waves → <a wave> → a week → Videos section
# Student: /student → sign in as an enrolled member → Weeks → <that week>
```

Prerequisites: migrations applied **including `0016_wave_videos.sql`**; at least one
wave with a week and one enrolled member; a Google Drive video shared as "Anyone with
the link can view" with its share link copied.

Verify gates: `npm test` · `npm run lint` · `npm run build` (all green).

---

## Phase 1 — Foundation & admin authoring (US1)

**Implemented**

- Migration `supabase/migrations/0016_wave_videos.sql` — `public.wave_videos`
  (`tenant_id`, `week_id`, `title`, `drive_file_id`, `position`, `created_at`),
  indexes, and RLS (`select` = admin-or-own-wave; writes admin-only).
- `lib/waves/video.ts` — pure `parseDriveFileId`, `driveEmbedUrl`, `driveWatchUrl`,
  `MAX_VIDEO_TITLE_LEN`.
- Server Actions in `app/admin/waves/actions.ts` — `addVideo`, `removeVideo`
  (+ `updateVideo`, `reorderVideo` for Phase 3), all admin-gated.
- `lib/waves/content.ts` — `AdminVideo` type + videos loaded per week in
  `fetchWaveContent`.
- `components/WaveBuilder.tsx` — the per-week **Videos** section (replaces the old
  non-persisted `VideoLinksSection` placeholder). New videos are added to the draft
  and persisted on the wave **Save**; saved videos support immediate remove/edit/reorder.
- Copy in `lib/strings.ts` (replaced the dead YouTube/Vimeo placeholder keys).

**Golden-path verification (desktop + mobile)**

1. Open a wave → a week → the **Videos** section.
2. Enter a title, paste a Google Drive share link, press **Add video** → the video
   appears in the list. Press the wave **Save** → it is persisted.
3. Paste `https://example.com/x` → an inline error (`Enter a valid Google Drive share
   link.`) shows and nothing is added.
4. Remove a saved video → it disappears (server delete).
5. Mobile (320–430px): the title/link inputs are full-width, ≥16px font, no
   horizontal scroll; the Add button and remove control are touch-friendly with
   visible focus.

**Tests**: `tests/lib/waves/video.test.ts`, `tests/app/admin/waves/videos.test.ts`,
`tests/components/WaveVideosSection.test.tsx`.

---

## Phase 2 — Student playback (US2)

**Implemented**

- `components/WeekVideoPlayer.tsx` (`'use client'`) — click-to-load façade: a poster
  with a labelled play button; the Google Drive `/preview` iframe mounts only on play
  (`loading="lazy"`, `allow="autoplay; fullscreen"`, `referrerPolicy="no-referrer"`),
  with an always-present "Open in Google Drive" caption link.
- `components/StudentWeekContent.tsx` — a **Videos** section above Resources that
  loads `wave_videos` (filtered `tenant_id` + `week_id`, ordered by `position`) and
  renders a `WeekVideoPlayer` per video; shows the empty state when none. The old
  static `VideoPlaceholder` is removed.

**Golden-path verification (desktop + mobile)**

1. As an enrolled student, open a week that has videos → each video shows its title
   and a play poster, in admin order, above Resources. No iframe is loaded yet.
2. Press play → the Drive player mounts inline and plays (2 taps total: open week,
   press play).
3. Open a week with no videos → "No videos for this week yet." shows and
   Resources/Assignments still render.
4. Mobile (320–430px): the player keeps a 16:9 frame with no horizontal scroll; the
   play button has a visible focus ring and an accessible label (`Play: <title>`).

**Wave isolation**: a student in Wave B opening a Wave A week id gets a 404 (the week
resolves to null), and RLS independently denies the video rows.

**Tests**: `tests/components/StudentWeekContent.test.tsx` (render order, no-iframe-
before-play, `/preview` src on play, empty state), `tests/integration/rls.test.ts`
(wave_videos cross-wave denial).

---

## Phase 3 — Video management (US3)

**Implemented**

- `updateVideo` (re-validate title + re-parse link → re-store file id) and
  `reorderVideo` (swap `position` with the adjacent same-week video; no-op at the
  ends) Server Actions.
- `WaveBuilder` Videos section: per-saved-video edit (title + link) and
  move-up/move-down controls, acting immediately with optimistic local state.

**Golden-path verification**

1. Rename a saved video → the new title shows; an invalid link is rejected.
2. Move a video up/down → the order changes, and the student week page reflects the
   new order on next view.

**Tests**: `tests/app/admin/waves/videos.test.ts` (updateVideo re-stores parsed id,
rejects non-Drive; reorderVideo swaps / no-ops at ends; both deny non-admins).

---

## Known gaps / limitations

- **"Unavailable" is best-effort**: a cross-origin Drive iframe can't report load
  failure to the page, and the app can't verify/set Drive's sharing level. If a file
  is not shared "Anyone with the link can view", the student sees Drive's own
  "request access" screen inside the stable frame plus the "Open in Google Drive"
  fallback (FR-011/FR-012; see `research.md` Decision 3).
- **Reorder/edit during initial wave creation**: edit/reorder controls act on
  already-saved videos. A video added to a brand-new wave during creation becomes
  editable/reorderable after the wave is saved (and the page re-seeds).
- **CSP**: no custom Content-Security-Policy exists today, so embeds work out of the
  box; any future CSP MUST allow `frame-src https://drive.google.com`.
