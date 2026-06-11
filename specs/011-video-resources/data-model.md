# Data Model: Week Video Resources

**Feature**: 011-video-resources | **Date**: 2026-06-12

One new table, `public.wave_videos`, modeled on `public.wave_materials`
(feature 008). No Storage bucket, no new auth/role concepts.

---

## Entity: Week Video (`public.wave_videos`)

A single Google-Drive-hosted video attached to one week of one wave.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `tenant_id` | `uuid` | `not null`, FK → `public.tenants(id) on delete cascade` | The wave. Denormalized for the flat RLS predicate (isolation invariant). |
| `week_id` | `uuid` | `not null`, FK → `public.wave_weeks(id) on delete cascade` | Removing a week removes its videos. |
| `title` | `text` | `not null` | Admin-entered caption shown to students. Length bounded in app validation (see rules). |
| `drive_file_id` | `text` | `not null` | Google Drive file id extracted from the shared link by `parseDriveFileId`. The raw share URL is **not** stored. |
| `position` | `int` | `not null`, `default 1` | Admin display order within the week (FR-009). |
| `created_at` | `timestamptz` | `not null`, `default now()` | |

**Indexes**:

- `wave_videos_week_idx` on `(week_id)` — student/admin per-week reads (mirrors `wave_materials_week_idx`).
- `wave_videos_tenant_position_idx` on `(tenant_id, position)` — ordered reads.

**Relationships**:

- `wave_weeks` 1 — N `wave_videos` (a week has zero, one, or many videos).
- `tenants` (wave) 1 — N `wave_videos` (denormalized scope; cascades on wave delete).

---

## Validation rules (enforced server-side; mirrored client-side for UX)

Pure helpers live in `lib/waves/video.ts` (Supabase-free, unit-tested):

- **Title**: required, trimmed non-empty, ≤ 200 chars (FR-003). Reject otherwise
  with `strings.wavesVideoTitleRequired` / over-length message.
- **Drive link**: `parseDriveFileId(input)` MUST return a non-null id (FR-002). The
  action stores the returned id, never the raw input. Reject `null` with
  `strings.wavesVideoLinkInvalid`.
- **Scope**: `tenant_id` (wave) and `week_id` come from the admin form; the action is
  admin-gated (`assertAdminSession`) and RLS re-checks `is_admin()` on write
  (Principle VI). A non-admin caller is denied with the generic forbidden message.

---

## State & lifecycle

Videos have no status field — a row exists or it does not.

- **Create**: admin submits title + Drive link → validate → insert (`position` =
  current max for the week + 1).
- **Update** (Phase 3 / US3): admin edits title and/or link; re-validate; re-store id.
- **Reorder** (Phase 3 / US3): admin moves a video up/down → swap `position` values
  with its neighbour. Student order follows `position` ascending.
- **Delete**: admin removes the row. No Storage cleanup is needed (no owned object).
- **Cascade**: deleting the week or the wave removes the video rows automatically
  (`on delete cascade`); no orphaned files exist because none were ever stored.

---

## RLS policies (the wave-isolation boundary — Principle VI)

Identical shape to `wave_materials` (migration 0008), using the existing
`public.is_admin()` / `public.jwt_tenant_id()` helpers:

```sql
alter table public.wave_videos enable row level security;

-- Admin sees all; a student sees only its own wave's videos.
create policy wave_videos_select on public.wave_videos
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());

-- Authoring is admin-only.
create policy wave_videos_write on public.wave_videos
  for all using (public.is_admin()) with check (public.is_admin());
```

**Cross-wave denial (tested)**: a student whose `jwt_tenant_id()` is Wave B can never
`select` a Wave A video row — extends `tests/integration/rls.test.ts`.

---

## Derived data (not stored)

- **Embed URL**: `https://drive.google.com/file/d/<drive_file_id>/preview`, built at
  render from the stored id. Never persisted, never trusted from input.
- **Watch/open URL** (caption fallback): `https://drive.google.com/file/d/<drive_file_id>/view`.
