# Quickstart: Week Video Resources

**Feature**: 011-video-resources

How to set up, run, and manually verify the feature end-to-end. Commands assume the
repo root and the standard env from `CLAUDE.md`.

## Prerequisites

- `.env.local` populated (Supabase URL + anon key; service role for seeding only).
- Migrations applied **including** the new `0016_wave_videos.sql`.
- At least one wave with one week, and one member enrolled in that wave (use the
  admin members + waves pages, or the seed script for the bootstrap admin).
- A Google Drive video shared as **"Anyone with the link can view"**, and its share
  link copied.

## Run

```bash
npm run dev        # Next.js dev server (Turbopack)
# Admin:   http://localhost:3000/admin   →  Waves → <a wave> → a week → Videos
# Student: http://localhost:3000/student →  sign in as the enrolled member → Weeks → <that week>
```

## Apply the migration

Apply `supabase/migrations/0016_wave_videos.sql` in order (via the Supabase MCP
`apply_migration`, the dashboard SQL editor, or the CLI). It creates `wave_videos`
with RLS; no bucket is created (videos are Drive links, not uploaded files).

## Manual verification (golden path)

**Admin — add a video (US1)**

1. Open a wave → a week → the **Videos** section.
2. Enter a title, paste the Google Drive share link, press **Add video**.
3. The video appears in the week's video list with an "Open in Drive" link.
4. Paste a non-Drive URL (e.g. `https://example.com/x`) → expect an inline validation
   error and no row added.

**Student — watch (US2)**

5. Sign in as the enrolled member, open the same week.
6. The **Videos** section shows the video's title and a play poster above Resources.
7. Press play → the Google Drive player mounts inline and plays. (2 taps total: open
   week, press play — SC-003.)
8. Open a week with no videos → the Videos area shows the empty state and Resources /
   Assignments still render (FR-010).

**Manage (US3)**

9. Add a second video, reorder, rename one, and remove one — confirm each change
   shows in both admin and student views.

## Wave-isolation check (Principle VI — must pass)

- Sign in as a member of **Wave B** and open (or guess) a **Wave A** week URL → the
  page 404s and no Wave A video is ever shown.
- Automated: `npx vitest run tests/integration/rls.test.ts` (extended with the
  `wave_videos` cross-wave denial case).

## Tests

```bash
npx vitest run tests/lib/waves/video.test.ts          # parseDriveFileId / embed URLs
npx vitest run tests/components/StudentWeekContent.test.tsx   # student video render + empty state
npx vitest run tests/app/waves-video-actions.test.ts  # addVideo/removeVideo gate + validation
npx vitest run tests/integration/rls.test.ts          # cross-wave denial for wave_videos
npm test                                              # full suite
npm run build && npm run lint                         # type + lint gates
```

## Responsive / a11y validation (Principle IV)

Validate the student Videos section and admin Videos form at **320 / 390 / 430 /
768px and desktop**: the player keeps a 16:9 frame with no horizontal page scroll,
the play button is touch-friendly with visible focus and a labelled action, inputs
use ≥16px font on mobile, and the section meets WCAG 2.1 AA contrast on white and
`#EEF3F8`.

## Notes / known limits

- The app cannot verify or change a Drive file's sharing setting; if a video shows
  Drive's "request access" page, the admin must re-share it as "Anyone with the link
  can view" (FR-012). The "unavailable" state is best-effort (see `research.md`).
- If a Content-Security-Policy is added later, it MUST allow
  `frame-src https://drive.google.com`.
