# Phase 1 Data Model: Instructors Management

This feature adds **one new table** (`instructors`) with RLS policies and an admin-only **write
policy** on the **operator-provisioned** Storage bucket `instructor-images` — both gated to
`is_admin()`, consistent with the 002/004 admin-only boundary. It touches **no** `auth.users` and
adds **no** service-role usage (writes go through the cookie/RLS client, R5). The rich-text
description is stored as **sanitized HTML** (R2).

> **Bucket ownership (clarified 2026-06-04)**: the administrator creates the **public-read**
> `instructor-images` bucket out of band (Supabase dashboard). Migration `0005` therefore does
> **not** create the bucket — it provisions only the `instructors` table, its RLS, and the
> `storage.objects` **write** policy that gates uploads/deletes to `is_admin()`. Public **read**
> of the bytes comes from the bucket being public (operator-set).

---

## Migration `0005_instructors.sql`

### `instructors` — new table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid primary key default gen_random_uuid()` | Stable id for edit/remove targeting. |
| `name` | `text not null` | Required, non-empty after trim (FR-005/FR-010). |
| `description_html` | `text` (nullable) | **Sanitized** rich-text HTML (R2). Optional (empty → list placeholder). |
| `image_path` | `text` (nullable) | Object path in the `instructor-images` bucket; public URL derived from it. |
| `created_at` | `timestamptz not null default now()` | List ordering (desc) + "added" column. |
| `updated_at` | `timestamptz not null default now()` | Bumped on edit. |

```sql
create table if not exists public.instructors (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description_html text,
  image_path       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.instructors enable row level security;

-- Admin-only, mirroring admin_profiles (002/0002). No student/anon read or write.
create policy instructors_select on public.instructors
  for select using (public.is_admin());
create policy instructors_write on public.instructors
  for all using (public.is_admin()) with check (public.is_admin());
```

> Reuses the existing `public.is_admin()` SECURITY-stable function from `0002_rls_policies.sql`
> (reads the tamper-proof `app_metadata.role` JWT claim). No new role primitive is introduced.

### Storage bucket `instructor-images` (operator-created) + write policy

The bucket is created by the operator in the Supabase dashboard as **public-read** (display
assets, R4). The migration adds only the **admin-only write** policy on `storage.objects`:

```sql
-- Bucket is created out of band (operator, dashboard) as a PUBLIC bucket so next/image can fetch
-- <project>.supabase.co/storage/v1/object/public/instructor-images/...  — NOT created here.

-- Writes (insert/update/delete) restricted to admins; reads are public via the public bucket.
create policy instructor_images_admin_write on storage.objects
  for all
  using (bucket_id = 'instructor-images' and public.is_admin())
  with check (bucket_id = 'instructor-images' and public.is_admin());
```

**RLS summary**: every `instructors` row read/write requires `is_admin()`; every
`instructor-images` mutation requires `is_admin()`; object **reads** are public (the bytes are
display photos). Row metadata stays admin-gated, so the admin-only scope holds.

---

## Entity: Instructor (`instructors` row + storage object)

The unit listed, added, edited, and removed.

| Field | Source | Used for |
|-------|--------|----------|
| id | `instructors.id` | edit / remove target; React key |
| name | `instructors.name` | Name column / card title |
| description | `instructors.description_html` (sanitized) | Description preview (clamped, R8) + edit form |
| image | derived public URL from `instructors.image_path` | Thumbnail + form preview |
| added | `instructors.created_at` | "Added" column / card meta |

**Validation rules** (from spec / FR):

- `name`: required, non-empty after trim (FR-010). Enforced in the pure validator **and** by the
  `not null` column.
- `description_html`: optional; whatever is submitted is **sanitized server-side** to the R2/R3
  allowlist before insert/update (FR-009). Never stored unsanitized.
- image file (when provided): MIME in {`image/png`, `image/jpeg`, `image/webp`} and size ≤ the
  configured max (e.g. 5 MB), checked **client- and server-side** (Principle V, FR-007). A
  rejected file creates/updates nothing.

**State**: an instructor simply **exists** until removed; there is no lifecycle status.

```
(add)  ──> exists ──(edit: name / image / description)──> exists
                └──(remove: confirm)──> row deleted + best-effort storage-object delete (R11)
```

---

## Invariants

- **Admin-only**: `instructors` and `instructor-images` writes/reads (row reads) require
  `is_admin()` server-side; no student/anon path exists (no wave/tenant scoping is introduced,
  so there is **no new cross-wave path** — Principle VI is satisfied by the admin gate, and the
  per-action denial case is the test, §contracts C6).
- **Description is never stored unsanitized**: the sanitizer runs on write; rendering trusts the
  stored value and re-sanitizes on read as defense-in-depth (R2).
- **No service-role expansion**: all writes use the cookie/RLS client; the service-role key
  remains seed/004-only (R5).
- **Storage/row consistency**: image cleanup on remove/replace is best-effort and never blocks
  the row mutation (R11); an orphaned object is harmless (admin-write, public-read display asset).
