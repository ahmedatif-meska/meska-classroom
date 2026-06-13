-- 0020_wave_attendance.sql
-- Feature 012 (US2/US3) — attendance tracking. One row == one student present on
-- one calendar day (the local business day, computed app-side in a fixed
-- timezone — lib/attendance/day.ts). tenant_id is denormalized for the flat
-- wave-isolation RLS used by every wave-scoped table (Principle VI, 0008).
--
-- The once-per-day rule (FR-028) is GLOBAL per student — one record per student
-- per day across ALL waves/weeks — so the unique key deliberately excludes
-- tenant_id/week_id. The "student belongs to the selected wave" rule (FR-027)
-- and the "scan is offline-only / CSV is online-only" rule (FR-015) are enforced
-- in the admin-gated Server Actions before any write.

create table if not exists public.wave_attendance (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  week_id     uuid not null references public.wave_weeks (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  attended_on date not null,
  method      text not null check (method in ('scan', 'csv')),
  created_at  timestamptz not null default now(),
  unique (student_id, attended_on)
);

create index if not exists wave_attendance_tenant_week_idx
  on public.wave_attendance (tenant_id, week_id);
create index if not exists wave_attendance_student_idx
  on public.wave_attendance (student_id);

alter table public.wave_attendance enable row level security;

-- Admin: full access (records attendance, views the records table).
drop policy if exists wave_attendance_admin_all on public.wave_attendance;
create policy wave_attendance_admin_all on public.wave_attendance
  for all using (public.is_admin()) with check (public.is_admin());

-- Student: read ONLY their own rows in their own wave (drives their points
-- total, FR-023/FR-026). No student INSERT/UPDATE/DELETE — attendance is
-- admin-recorded only (FR-018).
drop policy if exists wave_attendance_student_select on public.wave_attendance;
create policy wave_attendance_student_select on public.wave_attendance
  for select using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
