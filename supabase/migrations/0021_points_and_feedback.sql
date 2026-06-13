-- 0021_points_and_feedback.sql
-- Feature 012 (US4/US5) — gamification points configuration + persisted weekly
-- feedback.
--
-- point_rules is GLOBAL config (no tenant_id) — the platform-wide mapping of
-- rewarded action → point value, admin-editable. Students read it to display
-- their derived total (counts × current values, recomputed on read — FR-029),
-- so SELECT is widened to any authenticated user exactly like the instructors
-- directory (0015 precedent); writes stay admin-only.
--
-- wave_feedback persists the per-week student feedback that was UI-only before
-- this feature. One row per student per week (unique key) so the feedback
-- points award exactly once; re-submission upserts the same row. tenant_id is
-- denormalized for the flat wave-isolation RLS (Principle VI, mirrors
-- wave_submissions in 0008).

-- 1) Point rules — three fixed rows, seeded with the defaults (FR-020).
create table if not exists public.point_rules (
  action     text primary key check (action in ('attendance', 'assignment', 'feedback')),
  points     int not null check (points >= 0),
  updated_at timestamptz not null default now()
);

insert into public.point_rules (action, points) values
  ('attendance', 10),
  ('assignment', 20),
  ('feedback', 30)
  on conflict (action) do nothing;

alter table public.point_rules enable row level security;

drop policy if exists point_rules_read on public.point_rules;
create policy point_rules_read on public.point_rules
  for select using (auth.uid() is not null);

drop policy if exists point_rules_admin_write on public.point_rules;
create policy point_rules_admin_write on public.point_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) Weekly student feedback.
create table if not exists public.wave_feedback (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  week_id           uuid not null references public.wave_weeks (id) on delete cascade,
  student_id        uuid not null references public.students (id) on delete cascade,
  session_rating    int check (session_rating between 1 and 5),
  instructor_rating int check (instructor_rating between 1 and 5),
  comment           text,
  created_at        timestamptz not null default now(),
  unique (week_id, student_id)
);

create index if not exists wave_feedback_student_idx
  on public.wave_feedback (student_id);

alter table public.wave_feedback enable row level security;

-- Admin: full access (review feedback).
drop policy if exists wave_feedback_admin_all on public.wave_feedback;
create policy wave_feedback_admin_all on public.wave_feedback
  for all using (public.is_admin()) with check (public.is_admin());

-- Student: read/insert/update ONLY their own row in their own wave. The action
-- additionally verifies the week belongs to the caller's wave before writing
-- (own-wave weeks only — mirrors submitAssignment's assignment check).
drop policy if exists wave_feedback_student_select on public.wave_feedback;
create policy wave_feedback_student_select on public.wave_feedback
  for select using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );

drop policy if exists wave_feedback_student_insert on public.wave_feedback;
create policy wave_feedback_student_insert on public.wave_feedback
  for insert with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );

drop policy if exists wave_feedback_student_update on public.wave_feedback;
create policy wave_feedback_student_update on public.wave_feedback
  for update using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  ) with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
