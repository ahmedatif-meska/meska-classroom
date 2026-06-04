-- 0005_instructors.sql
-- Feature 005-instructors-management — the admin-managed instructors directory.
-- Adds the `instructors` table (admin-only via RLS) and the admin-only WRITE
-- policy on the operator-created public `instructor-images` Storage bucket.
--
-- NOTE (clarified 2026-06-04): the `instructor-images` bucket is created by the
-- operator in the Supabase dashboard as a PUBLIC bucket. This migration does NOT
-- create the bucket — it provisions only the table, its RLS, and the storage
-- write authorization. No auth.users change; no service-role usage.

create table if not exists public.instructors (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description_html text,
  image_path       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.instructors enable row level security;

-- Admin-only, mirroring admin_profiles (0002). No student/anon read or write.
drop policy if exists instructors_select on public.instructors;
create policy instructors_select on public.instructors
  for select using (public.is_admin());

drop policy if exists instructors_write on public.instructors;
create policy instructors_write on public.instructors
  for all using (public.is_admin()) with check (public.is_admin());

-- Storage: writes (insert/update/delete) to the instructor-images bucket are
-- restricted to admins. Reads are public (the bucket is public, operator-set),
-- so next/image can fetch the photos by URL.
drop policy if exists instructor_images_admin_write on storage.objects;
create policy instructor_images_admin_write on storage.objects
  for all
  using (bucket_id = 'instructor-images' and public.is_admin())
  with check (bucket_id = 'instructor-images' and public.is_admin());
