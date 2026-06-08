-- 0008_waves.sql
-- Feature 008-wave-management — evolve the wave (tenant) into a managed entity and
-- add its week/material/assignment/submission content with wave-isolated RLS at
-- BOTH the row and file level (constitution Principle VI). A wave IS a
-- public.tenants row (wave == tenant); child tables denormalize tenant_id so the
-- student read policy is the flat `tenant_id = jwt_tenant_id()` (no joins).
--
-- All admin writes run on the cookie/RLS client under is_admin(); student
-- submission writes run under the student policies below. No service-role usage.

-- 1) Remove the two pre-seeded generic reference waves (006). They were reference
--    data only; the roster is starting fresh (no members reference them).
delete from public.tenants where name in ('Online', 'Offline');

-- 2) Evolve the wave row: a sanitized rich-text description + an Online/Offline type.
alter table public.tenants add column if not exists description_html text;
alter table public.tenants add column if not exists type text;
alter table public.tenants
  drop constraint if exists tenants_type_check;
alter table public.tenants
  add constraint tenants_type_check check (type in ('online', 'offline'));
-- Safe: the table is empty of typeless rows after step 1 (documented assumption).
alter table public.tenants alter column type set not null;

-- 3) Weeks within a wave.
create table if not exists public.wave_weeks (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  position         int  not null default 1,
  title            text,
  description_html text,
  created_at       timestamptz not null default now()
);
create index if not exists wave_weeks_tenant_position_idx
  on public.wave_weeks (tenant_id, position);

-- 4) Materials attached to a week (downloadable files).
create table if not exists public.wave_materials (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  week_id    uuid not null references public.wave_weeks (id) on delete cascade,
  title      text not null,
  file_path  text not null,
  created_at timestamptz not null default now()
);
create index if not exists wave_materials_week_idx on public.wave_materials (week_id);

-- 5) Assignments attached to a week.
create table if not exists public.wave_assignments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  week_id           uuid not null references public.wave_weeks (id) on delete cascade,
  title             text not null,
  instructions_html text,
  due_at            timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists wave_assignments_week_idx on public.wave_assignments (week_id);

-- 6) Student submissions for an assignment (one current submission per student → upsert).
create table if not exists public.wave_submissions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  assignment_id uuid not null references public.wave_assignments (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  file_path     text not null,
  submitted_at  timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists wave_submissions_assignment_idx
  on public.wave_submissions (assignment_id);

-- 7) RLS — the wave-isolation boundary (Principle VI). Helpers is_admin() /
--    jwt_tenant_id() are from 0002.
alter table public.wave_weeks       enable row level security;
alter table public.wave_materials   enable row level security;
alter table public.wave_assignments enable row level security;
alter table public.wave_submissions enable row level security;

-- weeks / materials / assignments: admin sees all + writes; a student sees only
-- its own wave's rows and never writes (authoring is admin-only).
drop policy if exists wave_weeks_select on public.wave_weeks;
create policy wave_weeks_select on public.wave_weeks
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());
drop policy if exists wave_weeks_write on public.wave_weeks;
create policy wave_weeks_write on public.wave_weeks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wave_materials_select on public.wave_materials;
create policy wave_materials_select on public.wave_materials
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());
drop policy if exists wave_materials_write on public.wave_materials;
create policy wave_materials_write on public.wave_materials
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wave_assignments_select on public.wave_assignments;
create policy wave_assignments_select on public.wave_assignments
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());
drop policy if exists wave_assignments_write on public.wave_assignments;
create policy wave_assignments_write on public.wave_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- submissions: admins have full access (review/download/cleanup); a student may
-- read/insert/update ONLY their own submission in their own wave.
drop policy if exists wave_submissions_admin_all on public.wave_submissions;
create policy wave_submissions_admin_all on public.wave_submissions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wave_submissions_student_select on public.wave_submissions;
create policy wave_submissions_student_select on public.wave_submissions
  for select using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );

drop policy if exists wave_submissions_student_insert on public.wave_submissions;
create policy wave_submissions_student_insert on public.wave_submissions
  for insert with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );

drop policy if exists wave_submissions_student_update on public.wave_submissions;
create policy wave_submissions_student_update on public.wave_submissions
  for update using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  ) with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );

-- 8) Storage buckets — PRIVATE (unlike the public instructor-images). Created here
--    so the feature is self-contained; the wave id is the first path segment.
insert into storage.buckets (id, name, public)
  values ('wave-materials', 'wave-materials', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('assignment-submissions', 'assignment-submissions', false)
  on conflict (id) do nothing;

-- wave-materials: admin write/all; a student reads only its own wave's files
-- (first path folder == its tenant id).
drop policy if exists wave_materials_admin_all on storage.objects;
create policy wave_materials_admin_all on storage.objects
  for all
  using (bucket_id = 'wave-materials' and public.is_admin())
  with check (bucket_id = 'wave-materials' and public.is_admin());

drop policy if exists wave_materials_student_read on storage.objects;
create policy wave_materials_student_read on storage.objects
  for select
  using (
    bucket_id = 'wave-materials'
    and (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  );

-- assignment-submissions: admin read/all; a student reads/writes ONLY files under
-- its own wave folder AND its own student-id folder (third segment).
drop policy if exists assignment_submissions_admin_all on storage.objects;
create policy assignment_submissions_admin_all on storage.objects
  for all
  using (bucket_id = 'assignment-submissions' and public.is_admin())
  with check (bucket_id = 'assignment-submissions' and public.is_admin());

drop policy if exists assignment_submissions_student_rw on storage.objects;
create policy assignment_submissions_student_rw on storage.objects
  for all
  using (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = public.jwt_tenant_id()::text
    and (storage.foldername(name))[3] = (select id::text from public.students where user_id = auth.uid())
  )
  with check (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = public.jwt_tenant_id()::text
    and (storage.foldername(name))[3] = (select id::text from public.students where user_id = auth.uid())
  );
