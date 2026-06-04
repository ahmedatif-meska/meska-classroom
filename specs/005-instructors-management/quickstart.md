# Quickstart: Instructors Management

How to configure, run, and verify this feature locally. Builds on the existing 002/004 Supabase
setup; **no new environment variable** is required.

## Prerequisites

- The 002/004 stack already configured: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (service-role key is **not** used by
  this feature).
- An admin account you can sign in with (seed via `npm run seed:admin` if needed).

## One-time setup

1. **Create the bucket** (operator) — in the Supabase dashboard → Storage, create a bucket named
   exactly **`instructor-images`** and mark it **public** (clarified 2026-06-04: the operator
   provisions the bucket; the migration does not create it).
2. **Apply the migration** `supabase/migrations/0005_instructors.sql` (creates the `instructors`
   table + RLS policies and the `is_admin()` `storage.objects` **write** policy for the bucket).
   Apply via your usual path (Supabase SQL editor / CLI / MCP `apply_migration`). Verify in
   Storage that the bucket is public and the write policy is present.
3. **Install the sanitizer dependency** (added in Phase 2): `npm install` after the
   `package.json` change lands.
4. **Image host** for `next/image`: `next.config.ts` `images.remotePatterns` includes your
   Supabase project host (`<project-ref>.supabase.co`, path `/storage/v1/object/public/**`).

## Run

```bash
npm run dev      # start the dev server
npm run lint     # clean
npm run build    # passes
npm test         # full Vitest suite passes (incl. the new instructor tests)
```

Sign in at `/admin`, then open **Instructors** in the sidebar (`/admin/instructors`).

## Verify (golden path)

1. **List + empty state** — With no instructors, the page shows the empty state
   ("No instructors yet…"). The sidebar shows the **Instructors** entry.
2. **Add** — Click **Add Instructor**. In the form: enter a name, pick a PNG/JPEG/WebP image
   (≤5 MB; a preview appears), and write a description using the toolbar (bold, italic,
   underline, a list, a larger font size). Save. The new instructor appears as a row/card with
   its photo, name, and a clamped formatted description preview.
3. **Validation** — Try saving with an empty name (blocked, message). Try a `.gif`/oversized
   file (blocked, message). No instructor is created in either case.
4. **Edit** — Open an instructor's edit action; the form is pre-filled. Change the name, replace
   the image, re-format the description, save → the row reflects all changes. Cancel an edit →
   nothing changes.
5. **Remove** — Trigger remove on a row → confirm dialog → confirm → the instructor disappears.
   Cancel the dialog → it stays.
6. **Authorization** — Visit `/admin/instructors` signed out → redirected to `/admin`. (Server
   Actions also deny a non-admin caller before any write.)

## Verify (mobile, per Principle IV)

At **320 / 390 / 430 / 768px and desktop**:
- The list renders as **stacked cards below `sm`** (no horizontal page scroll, no clipped photo
  or controls); as a table at `sm`+.
- The add/edit **modal scrolls internally**; the rich-text toolbar buttons are touch-friendly,
  keyboard-focusable, and labelled; the name input uses ≥16px font.
- Images lazy-load and reserve space (no layout shift / CLS regression).

## Security check

- A description containing `<script>`, `onerror=`, or `javascript:` is **stored stripped** (the
  Server Action sanitizes before insert/update) and renders inertly — confirmed by
  `lib/instructors/sanitize.test.ts`.
- The service-role key never appears in client/request-rendered output (this feature does not use
  it; all writes go through the cookie/RLS client under `is_admin()` policies).
